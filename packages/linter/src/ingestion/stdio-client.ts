/**
 * Stdio MCP client ingestion (ING-06).
 *
 * Implements:
 * - ingestStdio: launch a subprocess via StdioClientTransport, fetch all tools,
 *   canonicalize, sort, and tear down — producing the same VokeSnapshot shape
 *   as ingestLive and readSnapshot.
 *
 * Determinism guarantees (mirrors ingestLive):
 * - D-02: meta.capturedAt is the ONLY wall-clock value; excluded from hashes.
 * - D-03: toolId = tool.name; tools sorted ascending by toolId.
 * - D-09: extraEnv values NEVER appear in error messages or snapshots (Pitfall 4).
 * - D-08: fail fast on launch error — no retry.
 * - D-10: any pagination page failure aborts ingest entirely (PartialPageError).
 *
 * Subprocess lifecycle:
 * - client.close() = stdin-end → 2s → SIGTERM → 2s → SIGKILL (SDK three-stage teardown).
 * - Do NOT add extra timeout logic — trust the SDK.
 * - stderr defaults to 'inherit' — subprocess error output is visible to the user.
 *
 * Pitfall guards:
 * - Pitfall 3: NEVER pass process.env to StdioClientTransport. The SDK merges
 *   getDefaultEnvironment() automatically. Pass ONLY opts.extraEnv (the additions).
 * - Pitfall 4: StdioLaunchError message uses only opts.command, NEVER opts.extraEnv values.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { toolContentHash } from '../canonicalize/hash.js';
import { schemaDepth, DEPTH_HARD_CAP } from './schema-checks.js';
import { StdioLaunchError, StdioTeardownError, PartialPageError, DepthExceededError } from '../errors.js';
import type { VokeSnapshot, ToolSnapshot } from './types.js';

// MTQS version this ingestion targets (mirrors mcp-client.ts constant)
const MTQS_VERSION = '0.1';

// Default timeout per listTools page request (milliseconds)
const LIST_TOOLS_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// IngestStdioOptions
// ---------------------------------------------------------------------------

/**
 * Options for stdio subprocess ingestion.
 */
export interface IngestStdioOptions {
  /** The executable command to launch (e.g. 'node', 'python', '/usr/local/bin/my-mcp'). */
  command: string;
  /** Arguments for the command (e.g. ['server.mjs', '--port', '0']). */
  args: string[];
  /**
   * Extra environment variables to pass into the subprocess.
   * The SDK merges getDefaultEnvironment() automatically — NEVER pass process.env here.
   * Values are NEVER stored in the VokeSnapshot or any error message (Pitfall 4).
   */
  extraEnv?: Record<string, string>;
  /**
   * Per-listTools-page timeout in ms; defaults to LIST_TOOLS_TIMEOUT_MS (30000).
   */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// fetchAllTools — paginated listTools with abort-on-page-failure (D-10)
// ---------------------------------------------------------------------------

/**
 * Fetches all tools via paginated tools/list calls.
 * Uses a do/while loop on nextCursor truthiness (Pitfall 3 guard).
 * Any page failure throws PartialPageError — never returns a partial list (D-10).
 *
 * IDENTICAL logic to mcp-client.ts fetchAllTools — reuse the same algorithm.
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
// ingestStdio — orchestrate stdio subprocess ingestion → sorted VokeSnapshot
// ---------------------------------------------------------------------------

/**
 * Launches an MCP server as a subprocess via StdioClientTransport, fetches the
 * complete paginated tool surface, and returns a sorted, content-hashed VokeSnapshot.
 *
 * Determinism enforced (identical to ingestLive):
 * - Tools sorted ascending by toolId via localeCompare('en', {sensitivity:'variant'})
 * - Per-tool contentHash = SHA-256 of canonical {name,description,inputSchema,outputSchema,annotations}
 * - meta.capturedAt is the ONLY wall-clock value; excluded from hashing (D-02)
 * - extraEnv values never included in snapshot or error messages (D-09/Pitfall 4)
 *
 * Subprocess lifecycle:
 * - StdioClientTransport handles process spawn; stderr defaults to 'inherit'
 * - client.close() issues stdin-end → 2s wait → SIGTERM → 2s wait → SIGKILL
 *   Do NOT add extra timeout logic — trust the SDK three-stage teardown.
 *
 * Failure modes:
 * - StdioLaunchError (exit 8): subprocess fails to start (command not found, permission denied)
 * - PartialPageError (exit 4): any listTools page fails
 * - DepthExceededError (exit 6): any tool inputSchema exceeds DEPTH_HARD_CAP
 * - StdioTeardownError (exit 9): client.close() throws
 *
 * @param opts - IngestStdioOptions with command, args, extraEnv, and timeoutMs
 * @returns Promise<VokeSnapshot> — the canonicalized tool surface
 */
export const ingestStdio = async (opts: IngestStdioOptions): Promise<VokeSnapshot> => {
  const { command, args, extraEnv, timeoutMs = LIST_TOOLS_TIMEOUT_MS } = opts;

  // Build StdioClientTransport — pass ONLY extraEnv (not process.env, Pitfall 3).
  // The SDK's getDefaultEnvironment() already includes the parent process env.
  // StdioServerParameters expects: command, args, env (the ADDITIONS only).
  const transportParams: StdioServerParameters = {
    command,
    args,
    ...(extraEnv !== undefined ? { env: extraEnv } : {}),
  };
  const transport = new StdioClientTransport(transportParams);

  const client = new Client({ name: 'voke', version: '0.0.0' });

  // Connect — launch the subprocess (Pitfall 4: message uses only command, not extraEnv)
  try {
    await client.connect(transport);
  } catch (err) {
    throw new StdioLaunchError(command, err);
  }

  // Read server identity from the SDK initialize response
  const serverInfo = client.getServerVersion();
  // stdio transport has no URL; set server.url = null
  const serverIdentity = {
    url: null as null,
    name: serverInfo?.name ?? 'unknown',
    version: serverInfo?.version ?? '0.0.0',
    // stdio transport does not expose protocolVersion via a getter; use 'unknown'
    protocolVersion: 'unknown',
  };

  // Fetch all tools with pagination
  const rawTools = await fetchAllTools(client, timeoutMs);

  // Map to ToolSnapshot using the EXACT inline logic from ingestLive:
  // schemaDepth guard → toolContentHash → copy fields
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
        annotations: tool.annotations as Record<string, unknown> | undefined,
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

  // Tear down the subprocess — trust the SDK three-stage shutdown (Pitfall 4: no extra timeout)
  try {
    await client.close();
  } catch (err) {
    throw new StdioTeardownError(command, err);
  }

  return {
    snapshotVersion: '1',
    mtqsVersion: MTQS_VERSION,
    server: serverIdentity,
    meta: { capturedAt },
    tools: sortedTools,
  };
};
