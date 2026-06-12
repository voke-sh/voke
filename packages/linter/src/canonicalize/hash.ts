import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.js';

/**
 * Deterministic SHA-256 hash helper.
 *
 * Returns a 64-char lowercase hex digest of the UTF-8 encoded input string.
 * Uses node:crypto (built-in, synchronous, deterministic) — no external dep.
 */
export const sha256 = (input: string): string =>
  createHash('sha256').update(input, 'utf8').digest('hex');

/**
 * Per-tool content hash (ING-04, D-03).
 *
 * Hashes exactly the 5 canonical fields: name, description, inputSchema, outputSchema, annotations.
 * Key order is normalized via canonicalJson so the hash is stable regardless of JS object key
 * insertion order. undefined fields are omitted (canonicalJson mirrors JSON.stringify).
 */
export const toolContentHash = (tool: {
  name: string;
  description?: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  annotations?: unknown;
}): string =>
  sha256(
    canonicalJson({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
    }),
  );

/**
 * Surface content hash (ARCHITECTURE determinism point #6).
 *
 * Sorts tools ascending by toolId (locale-independent) before hashing, so the hash is
 * independent of the input array order (MCP protocol does not guarantee tool ordering).
 */
export const surfaceContentHash = (tools: ReadonlyArray<{ toolId: string }>): string => {
  const sorted = [...tools].sort((a, b) =>
    a.toolId.localeCompare(b.toolId, 'en', { sensitivity: 'variant' }),
  );
  return sha256(canonicalJson(sorted));
};
