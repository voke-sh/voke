/**
 * Schema-safety checks for ING-05.
 *
 * Implements:
 * - isValidJsonSchema2020: Ajv2020 structural validity check (D-06)
 * - schemaDepth: bounded depth counter (D-04, D-05)
 * - hasExternalRef: external $ref detection WITHOUT fetching (D-07)
 *
 * Determinism guarantees:
 * - Ajv2020 instantiated ONCE at module load with strict:false, loadSchema NEVER wired.
 * - schemaDepth bails at DEPTH_HARD_CAP (32) to prevent OOM/stack overflow.
 * - hasExternalRef bails at depth 64 to prevent stack overflow on pathological schemas.
 * - No IO anywhere in this module.
 */
import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

// ---------------------------------------------------------------------------
// Ajv2020 singleton — instantiated once per module load (D-06)
// NEVER pass loadSchema — no network, no SSRF, determinism preserved
// ---------------------------------------------------------------------------
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);

/**
 * Returns true if the schema is structurally valid per JSON Schema 2020-12,
 * false otherwise. Never throws; never makes IO.
 *
 * Uses ajv's validateSchema which checks against the 2020-12 meta-schema.
 * strict:false means unusual-but-valid schemas (x-* extensions etc.) are NOT
 * rejected by ajv's own strictness mode — they may still get MTQS findings
 * from Phase 3 rules.
 */
/**
 * Result of validating a schema against the JSON Schema 2020-12 meta-schema.
 * `errors` is a SNAPSHOT (own array) — never the live ajv.errors reference.
 */
export interface SchemaValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

/**
 * Validates a schema against JSON Schema 2020-12 and returns the specific
 * meta-schema errors ajv produced. Never throws; never makes IO.
 *
 * Determinism guarantees:
 * - ajv error order is a stable function of the input; we preserve ajv's
 *   emission order (no sort, no reorder).
 * - ajv.errors is overwritten on every validateSchema call on the shared
 *   singleton. Because rules are synchronous and single-threaded, we snapshot
 *   ajv.errors into a NEW array IMMEDIATELY after the call, so the returned
 *   array can never be mutated by a later re-entrant call.
 * - No Date, no Math.random, no network — pure given the singleton config.
 */
export const validateJsonSchema2020 = (schema: unknown): SchemaValidationResult => {
  try {
    const valid = ajv.validateSchema(schema as object) === true;
    // Snapshot immediately — spread into a fresh array so the shared singleton's
    // live `errors` cannot leak out or be mutated by a subsequent call.
    const errors = valid ? [] : [...(ajv.errors ?? [])];
    return { valid, errors };
  } catch {
    return { valid: false, errors: [] };
  }
};

export const isValidJsonSchema2020 = (schema: unknown): boolean =>
  validateJsonSchema2020(schema).valid;

/**
 * Maximum number of individual schema errors rendered in a finding message.
 * Determinism cap: bounds message length without introducing nondeterminism
 * (we always show the FIRST N in ajv's stable emission order).
 */
const MAX_SHOWN = 3;

/**
 * Formats ajv schema errors into a single deterministic, human-readable string.
 *
 * - Empty array → '' (caller falls back to the generic prefix).
 * - Shows the FIRST MAX_SHOWN errors in ajv's original emission order (no sort).
 * - Each error renders as `${keyword} at ${schemaPath}: ${message}`.
 * - When more than MAX_SHOWN errors exist, appends ` (+N more)`.
 * - Pure: no Date, no Math.random, no IO — output is a function of the input only.
 */
export const formatSchemaErrors = (errors: ReadonlyArray<ErrorObject>): string => {
  if (errors.length === 0) return '';

  const shown = errors
    .slice(0, MAX_SHOWN)
    .map(e => {
      const location = e.schemaPath.length > 0 ? e.schemaPath : e.instancePath;
      return `${e.keyword} at ${location}: ${e.message ?? 'invalid'}`;
    })
    .join('; ');

  const overflow = errors.length - MAX_SHOWN;
  return overflow > 0 ? `${shown} (+${overflow} more)` : shown;
};

// ---------------------------------------------------------------------------
// Schema depth counter (D-04, D-05, RESEARCH.md Pattern 8)
// ---------------------------------------------------------------------------

/**
 * Hard safety cap for schema depth.
 * A schema exceeding this depth is rejected at ingestion (exits with code 6).
 * Chosen to be well above any real-world schema while bounding worst-case OOM/hang.
 */
export const DEPTH_HARD_CAP = 32;

/**
 * Keywords that wrap sub-schemas without adding a depth level themselves.
 * Branches recurse at the SAME depth as the wrapper (D-05).
 */
const COMPOSITION_KEYS = new Set(['oneOf', 'anyOf', 'allOf', 'if', 'then', 'else', 'not']);

/**
 * Counts the depth of a JSON Schema object.
 *
 * Depth algorithm (D-05):
 *   depth(schema) = 1 (for this schema node) + max depth from structural children
 *
 * The plan spec defines:
 *   "a flat {type:object, properties:{a:{type:string}}} returns depth 2 (root + one property level)"
 *
 * Only STRUCTURAL keywords contribute to depth. Non-structural keywords like
 * type, description, required, title, etc. do NOT recurse.
 *
 * Structural depth-adding keys: properties, items, $defs, definitions, additionalProperties.
 * Each causes child schemas to be counted at depth+1.
 *
 * Composition keywords (oneOf/anyOf/allOf/if/then/else/not) recurse into their
 * branches WITHOUT incrementing the depth counter (wrapper itself adds 0 levels).
 *
 * Bails early when current exceeds DEPTH_HARD_CAP (prevents OOM/stack overflow).
 *
 * @param schema - the schema to measure
 * @param current - the current accumulated depth (default 0 for root call)
 * @returns depth value; may be > DEPTH_HARD_CAP if schema exceeds the cap
 */
export const schemaDepth = (schema: unknown, current = 0): number => {
  // Early bail — prevents OOM and stack overflow on pathological schemas
  if (current > DEPTH_HARD_CAP) return current;

  // Base cases: primitives and null have no structural children
  if (typeof schema !== 'object' || schema === null) return current;

  // Arrays at the schema level are invalid JSON Schema; skip (don't add depth)
  if (Array.isArray(schema)) return current;

  // Count this schema node as 1 level
  const nodeDepth = current + 1;

  // Early bail after counting this node
  if (nodeDepth > DEPTH_HARD_CAP) return nodeDepth;

  const obj = schema as Record<string, unknown>;
  let maxChildDepth = nodeDepth;

  for (const [key, value] of Object.entries(obj)) {
    let d: number;

    if (COMPOSITION_KEYS.has(key)) {
      // Composition wrapper — recurse branches at `current` (not nodeDepth).
      // Per D-05: "a oneOf/anyOf/allOf wrapper itself adds 0 levels — recurse into
      // each branch and take the deepest." The branches are evaluated as if the wrapper
      // is transparent — at the same depth BEFORE this node was counted.
      if (Array.isArray(value)) {
        for (const branch of value) {
          d = schemaDepth(branch, current);
          if (d > maxChildDepth) maxChildDepth = d;
        }
      } else if (typeof value === 'object' && value !== null) {
        // not/if/then/else can be a single schema object
        d = schemaDepth(value, current);
        if (d > maxChildDepth) maxChildDepth = d;
      }
    } else if (key === 'properties' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Each property schema is one level deeper than this schema node
      for (const propSchema of Object.values(value as Record<string, unknown>)) {
        d = schemaDepth(propSchema, nodeDepth);
        if (d > maxChildDepth) maxChildDepth = d;
      }
    } else if (key === 'items') {
      // items can be a schema or array of schemas
      if (Array.isArray(value)) {
        for (const s of value) {
          d = schemaDepth(s, nodeDepth);
          if (d > maxChildDepth) maxChildDepth = d;
        }
      } else if (typeof value === 'object' && value !== null) {
        d = schemaDepth(value, nodeDepth);
        if (d > maxChildDepth) maxChildDepth = d;
      }
    } else if (key === '$defs' || key === 'definitions') {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (const s of Object.values(value as Record<string, unknown>)) {
          d = schemaDepth(s, nodeDepth);
          if (d > maxChildDepth) maxChildDepth = d;
        }
      }
    } else if (key === 'additionalProperties' && typeof value === 'object' && value !== null) {
      d = schemaDepth(value, nodeDepth);
      if (d > maxChildDepth) maxChildDepth = d;
    }
    // All other keys (type, description, required, title, etc.) are NOT structural
    // and do not contribute to schema depth.

    // Bail early if we've already exceeded the cap
    if (maxChildDepth > DEPTH_HARD_CAP) return maxChildDepth;
  }

  return maxChildDepth;
};

// ---------------------------------------------------------------------------
// External $ref detector (D-07, RESEARCH.md Pattern 7)
// ---------------------------------------------------------------------------

/**
 * Returns true if the schema (or any nested schema) contains an external $ref —
 * i.e., a $ref string that does NOT start with "#" (which would be a same-document ref).
 *
 * NEVER fetches the external URL — this is a pure tree walk.
 * Depth guard at 64 prevents stack overflow on pathological schemas.
 *
 * Examples:
 *   hasExternalRef({ $ref: 'https://x.com/s.json' }) === true   // external
 *   hasExternalRef({ $ref: '#/$defs/X' })             === false  // internal
 *   hasExternalRef({ $ref: 'file:///local.json' })   === true   // external (not #-relative)
 */
export const hasExternalRef = (schema: unknown, depth = 0): boolean => {
  if (depth > 64) return false; // emergency safety bail

  if (typeof schema !== 'object' || schema === null) return false;

  if (Array.isArray(schema)) {
    return schema.some(item => hasExternalRef(item, depth + 1));
  }

  const obj = schema as Record<string, unknown>;

  // Check for $ref at this node
  if (typeof obj['$ref'] === 'string' && !obj['$ref'].startsWith('#')) {
    return true; // external $ref found
  }

  // Recurse into all values
  return Object.values(obj).some(v => hasExternalRef(v, depth + 1));
};
