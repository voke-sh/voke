/**
 * Deterministic sorted-key JSON serializer.
 *
 * Invariants:
 * - Object keys are sorted with localeCompare('en', { sensitivity: 'variant' }) for
 *   locale-independent, byte-stable output (Pitfall 2 guard).
 * - Arrays are NEVER reordered (order is semantic in JSON Schema prefixItems, enum, etc.).
 * - undefined-valued keys are omitted (mirrors JSON.stringify behavior, Pitfall 7 guard).
 * - Internal $ref strings (D-07) are kept byte-for-byte — no dereferencing before hashing.
 *
 * This is the single source of byte-stable serialization used by:
 * - toolContentHash (per-tool identity, ING-04)
 * - surfaceContentHash (snapshotContentHash, ARCHITECTURE point #6)
 * - x3 byte-identical determinism test (ENG-04, D-12)
 */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }))
    .filter(k => (value as Record<string, unknown>)[k] !== undefined)
    .map(k => JSON.stringify(k) + ':' + canonicalJson((value as Record<string, unknown>)[k]));
  return '{' + sorted.join(',') + '}';
};
