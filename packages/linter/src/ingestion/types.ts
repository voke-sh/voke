/**
 * Ingestion data model types — verbatim from ARCHITECTURE.md (lines 127-164).
 *
 * These are plain TS interfaces; no Zod here (Zod validation of snapshots-on-read
 * goes in snapshot-reader.ts).
 *
 * Determinism notes:
 * - D-02: capturedAt lives in meta (separate from hashed body), excluded from
 *   snapshotContentHash and the byte-identical determinism test.
 * - D-03: toolId = tool.name; tools sorted ascending by toolId at ingest time.
 * - D-07: $ref strings are kept as-written (never dereferenced at ingestion time).
 */

/** Server identity captured at connect time. */
export interface ServerIdentity {
  url: string | null; // null for file-mode (offline snapshot) ingestion
  name: string; // from MCP server's initialize response (serverInfo.name)
  version: string; // from MCP server's initialize response (serverInfo.version)
  protocolVersion: string; // MCP protocol version negotiated during initialize
}

/**
 * Per-tool snapshot — the stable serialized form both L1 (lint) and L2 (diff) operate on.
 * contentHash enables O(1) change detection across snapshot versions.
 */
export interface ToolSnapshot {
  // Stable identity (D-03)
  toolId: string; // = tool.name (stable across server restarts)
  contentHash: string; // SHA-256 of canonical JSON of {name, description, inputSchema, outputSchema, annotations}

  // Surface (verbatim from tools/list response)
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>; // JSON Schema 2020-12 (MCP RC 2026-07-28)
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>; // readOnlyHint, destructiveHint, idempotentHint, openWorldHint
}

/**
 * Top-level snapshot produced by ingestion (live or offline).
 *
 * D-02: meta.capturedAt is provenance — excluded from hashing and the x3 determinism test.
 * D-01: VokeSnapshot is the raw tool surface; LintReport is the separate scored artifact.
 */
export interface VokeSnapshot {
  snapshotVersion: '1'; // format version (not MTQS version)
  mtqsVersion: string; // MTQS spec version this was linted against
  server: ServerIdentity;
  meta: {
    capturedAt: string; // ISO-8601 UTC — provenance only; excluded from content hash (D-02)
  };
  tools: ToolSnapshot[]; // sorted ascending by toolId (determinism point #1/#5)
}
