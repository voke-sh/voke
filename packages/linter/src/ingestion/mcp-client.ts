/**
 * Live MCP client ingestion (ING-01, ING-02, D-08..D-11).
 *
 * Implements:
 * - buildHeaders: parse raw CLI "--header 'Key: Value'" strings
 * - maskHeaders: replace all values with "[MASKED]" (D-09)
 * - connectWithFallback: StreamableHTTP primary + SSE fallback, headers on both (D-11)
 * - fetchAllTools: paginated listTools, abort-on-any-page-failure (D-10)
 * - ingestLive: orchestrate → sorted, content-hashed VokeSnapshot (D-01..D-03, #1/#5/#6)
 *
 * Determinism guarantees:
 * - D-02: meta.capturedAt is the ONLY wall-clock value; lives in meta, excluded from hashes.
 * - D-03: toolId = tool.name; tools sorted ascending by toolId.
 * - D-08: fail fast on connect error — no retry, no backoff.
 * - D-09: raw header values never stored on VokeSnapshot or in logs.
 * - D-10: any pagination page failure aborts ingest entirely (PartialPageError).
 * - D-11: StreamableHTTP primary, SSE fallback; auth headers forwarded to both transports.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { toolContentHash } from '../canonicalize/hash.js';
import { schemaDepth, DEPTH_HARD_CAP } from './schema-checks.js';
import { ConnectError, PartialPageError, DepthExceededError } from '../errors.js';
import type { VokeSnapshot, ToolSnapshot } from './types.js';

// Phase 4 will wire the real version from package.json; for Phase 2, use 0.0.0
const VOKE_VERSION = '0.0.0';

// MTQS version this ingestion targets
const MTQS_VERSION = '0.1';

// Default timeout per listTools page request (milliseconds)
const LIST_TOOLS_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// buildHeaders — parse raw "--header 'Key: Value'" strings (RESEARCH Pattern 1)
// ---------------------------------------------------------------------------

/**
 * Parses an array of raw header strings of the form "Key: Value" into a plain
 * Record<string, string>. Throws if any header lacks a colon separator.
 *
 * The first ":" is used as the separator so that values containing ":" (e.g. URLs)
 * are handled correctly.
 */
export const buildHeaders = (rawHeaders: string[]): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const raw of rawHeaders) {
    const idx = raw.indexOf(':');
    if (idx === -1) {
      throw new Error(
        `Invalid header format: "${raw}". Expected "Key: Value" (must contain a colon).`,
      );
    }
    result[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
  }
  return result;
};

// ---------------------------------------------------------------------------
// maskHeaders — replace all header values with [MASKED] (D-09)
// ---------------------------------------------------------------------------

/**
 * Returns a copy of the headers object with every value replaced by "[MASKED]".
 * Use this before including headers in any log, error message, or serialized output.
 * Raw header values must NEVER appear in a VokeSnapshot, LintReport, or log.
 */
export const maskHeaders = (headers: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const key of Object.keys(headers)) {
    result[key] = '[MASKED]';
  }
  return result;
};

// ---------------------------------------------------------------------------
// connectWithFallback — D-11 StreamableHTTP primary + SSE fallback
// ---------------------------------------------------------------------------

/**
 * Attempts to connect to the MCP server via StreamableHTTPClientTransport.
 * If that throws (legacy server), retries with SSEClientTransport.
 * Auth headers are forwarded to BOTH transports (Pitfall 6 guard).
 * If both fail, throws ConnectError(exitCode=2) — D-08 fail fast, no retry.
 */
const connectWithFallback = async (
  url: URL,
  headers: Record<string, string>,
): Promise<{ client: Client; transport: StreamableHTTPClientTransport | SSEClientTransport }> => {
  // Primary: StreamableHTTP
  try {
    const client = new Client({ name: 'voke', version: VOKE_VERSION });
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(transport);
    return { client, transport };
  } catch (primaryError) {
    // Legacy server — fall back to SSE. Also forward headers (Pitfall 6).
    try {
      const client = new Client({ name: 'voke', version: VOKE_VERSION });
      const transport = new SSEClientTransport(url, {
        requestInit: { headers },
      });
      await client.connect(transport);
      return { client, transport };
    } catch (fallbackError) {
      // Both transports failed — fail fast with ConnectError (D-08, exit code 2)
      const combinedCause = `StreamableHTTP: ${String(primaryError)}; SSE: ${String(fallbackError)}`;
      throw new ConnectError(url.toString(), combinedCause);
    }
  }
};

// ---------------------------------------------------------------------------
// fetchAllTools — paginated listTools with abort-on-page-failure (D-10, RESEARCH Pattern 3)
// ---------------------------------------------------------------------------

/**
 * Fetches all tools via paginated tools/list calls.
 * Uses a do/while loop on nextCursor truthiness (Pitfall 3 guard).
 * Any page failure throws PartialPageError — never returns a partial list (D-10).
 */
const fetchAllTools = async (
  client: Client,
  timeoutMs = LIST_TOOLS_TIMEOUT_MS,
): Promise<Tool[]> => {
  const allTools: Tool[] = [];
  let cursor: string | undefined;
  do {
    try {
      const { tools, nextCursor } = await client.listTools({ cursor }, { timeout: timeoutMs });
      allTools.push(...(tools as Tool[]));
      cursor = nextCursor;
    } catch (err) {
      // Abort whole ingest on any page failure (D-10)
      throw new PartialPageError(err);
    }
  } while (cursor);
  return allTools;
};

// ---------------------------------------------------------------------------
// ingestLive — orchestrate live MCP ingestion → sorted VokeSnapshot
// ---------------------------------------------------------------------------

/**
 * Options for live ingestion.
 */
export interface IngestLiveOptions {
  /** Full URL of the MCP server endpoint (e.g., "http://localhost:3000/mcp") */
  url: string;
  /**
   * Raw header strings in "Key: Value" format (mirrors curl --header).
   * Used for bearer token auth and custom headers.
   * Values are NEVER stored on the returned VokeSnapshot (D-09).
   */
  rawHeaders?: string[];
}

/**
 * Connects to a live MCP server, fetches the complete paginated tool surface,
 * and returns a sorted, content-hashed VokeSnapshot.
 *
 * Determinism enforced:
 * - Tools sorted ascending by toolId via localeCompare('en', {sensitivity:'variant'}) (#1/#5)
 * - Per-tool contentHash = SHA-256 of canonical {name,description,inputSchema,outputSchema,annotations} (#6)
 * - meta.capturedAt is the ONLY wall-clock value; excluded from hashing (D-02)
 * - Raw header values never included in snapshot (D-09)
 *
 * Failure modes:
 * - ConnectError (exit 2): both transports fail to connect
 * - PartialPageError (exit 4): any listTools page fails
 * - DepthExceededError (exit 6): any tool inputSchema exceeds DEPTH_HARD_CAP
 */
export const ingestLive = async (opts: IngestLiveOptions): Promise<VokeSnapshot> => {
  const { url, rawHeaders = [] } = opts;

  // Parse and keep raw headers for transport auth (values are NEVER stored on snapshot)
  const headers = buildHeaders(rawHeaders);

  const serverUrl = new URL(url);

  // Connect to MCP server (StreamableHTTP primary, SSE fallback)
  const connectResult = await connectWithFallback(serverUrl, headers);
  const { client } = connectResult;

  // Read server identity from SDK initialize result.
  // getServerVersion() returns Implementation (name + version only; no protocolVersion).
  // The transport exposes protocolVersion via a getter after connect.
  const serverInfo = client.getServerVersion();
  // Extract negotiated protocolVersion from transport via duck-typed access
  // (StreamableHTTPClientTransport has a public protocolVersion getter per SDK types).
  const negotiatedProtocol =
    (connectResult.transport as { protocolVersion?: string }).protocolVersion ?? 'unknown';
  const serverIdentity = {
    url,
    name: serverInfo?.name ?? 'unknown',
    version: serverInfo?.version ?? '0.0.0',
    protocolVersion: negotiatedProtocol,
  };

  // Fetch all tools with pagination
  const rawTools = await fetchAllTools(client);

  // Map to ToolSnapshot, validate depth, compute contentHash
  const toolSnapshots: ToolSnapshot[] = rawTools.map(tool => {
    const depth = schemaDepth(tool.inputSchema as unknown);
    if (depth > DEPTH_HARD_CAP) {
      throw new DepthExceededError(tool.name, depth, DEPTH_HARD_CAP);
    }

    return {
      toolId: tool.name,
      contentHash: toolContentHash({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
        outputSchema: tool.outputSchema as Record<string, unknown> | undefined,
        annotations: (tool.annotations as Record<string, unknown> | undefined),
      }),
      name: tool.name,
      title: (tool as { title?: string }).title,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
      outputSchema: tool.outputSchema as Record<string, unknown> | undefined,
      annotations: tool.annotations as Record<string, unknown> | undefined,
    };
  });

  // Sort tools ascending by toolId (determinism points #1 and #5)
  const sortedTools = [...toolSnapshots].sort((a, b) =>
    a.toolId.localeCompare(b.toolId, 'en', { sensitivity: 'variant' }),
  );

  // capturedAt is the ONLY wall-clock value (D-02); lives in meta, excluded from hashes
  const capturedAt = new Date().toISOString();

  return {
    snapshotVersion: '1',
    mtqsVersion: MTQS_VERSION,
    server: serverIdentity,
    meta: { capturedAt },
    tools: sortedTools,
  };
};
