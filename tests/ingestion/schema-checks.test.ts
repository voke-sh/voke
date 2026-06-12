/**
 * Tests for ING-05: schema-safety checks (Ajv2020 validity, bounded depth, external-$ref detection).
 *
 * Network is blocked in this test file to prove ext-ref detection never fetches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidJsonSchema2020,
  schemaDepth,
  hasExternalRef,
  DEPTH_HARD_CAP,
} from '../../packages/linter/src/ingestion/schema-checks.js';

beforeEach(() => {
  // Block network to prove no fetch call is made during schema checks
  vi.stubGlobal('fetch', () => {
    throw new Error('network blocked in tests');
  });
});

// Restore after each test to avoid leaking stubs
import { afterEach } from 'vitest';
afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// isValidJsonSchema2020
// ---------------------------------------------------------------------------
describe('isValidJsonSchema2020', () => {
  it('returns true for a minimal valid schema (empty object)', () => {
    expect(isValidJsonSchema2020({})).toBe(true);
  });

  it('returns true for a flat type:object schema with properties', () => {
    expect(
      isValidJsonSchema2020({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name'],
      }),
    ).toBe(true);
  });

  it('returns true for a schema using 2020-12 keywords (prefixItems, unevaluatedProperties)', () => {
    expect(
      isValidJsonSchema2020({
        type: 'array',
        prefixItems: [{ type: 'string' }, { type: 'number' }],
        unevaluatedItems: false,
      }),
    ).toBe(true);
  });

  it('returns true for a schema with $defs and internal $ref', () => {
    expect(
      isValidJsonSchema2020({
        type: 'object',
        properties: {
          item: { $ref: '#/$defs/Item' },
        },
        $defs: {
          Item: { type: 'string' },
        },
      }),
    ).toBe(true);
  });

  it('returns false for a structurally invalid schema (type value is not a string or array)', () => {
    // type must be a string or array; a number is invalid per 2020-12
    expect(isValidJsonSchema2020({ type: 42 })).toBe(false);
  });

  it('returns false for a schema with invalid required (not an array)', () => {
    expect(isValidJsonSchema2020({ type: 'object', required: 'name' })).toBe(false);
  });

  it('does not throw for any input — never throws', () => {
    expect(() => isValidJsonSchema2020(null)).not.toThrow();
    expect(() => isValidJsonSchema2020('not-a-schema')).not.toThrow();
    expect(() => isValidJsonSchema2020(42)).not.toThrow();
  });

  it('does not make any network call (fetch is blocked)', () => {
    // If this throws "network blocked" it means schema validation tried to fetch something
    expect(() =>
      isValidJsonSchema2020({
        type: 'object',
        properties: { x: { type: 'string' } },
      }),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// schemaDepth
// ---------------------------------------------------------------------------
describe('schemaDepth', () => {
  it('returns 0 for a non-object (primitive schema like true)', () => {
    expect(schemaDepth(true)).toBe(0);
    expect(schemaDepth(null)).toBe(0);
  });

  it('returns 1 for a flat schema with no nesting ({type:object})', () => {
    expect(schemaDepth({ type: 'object' })).toBe(1);
  });

  it('returns 2 for a flat object with one level of properties', () => {
    // root=1, each property adds +1 → depth 2
    expect(
      schemaDepth({
        type: 'object',
        properties: {
          a: { type: 'string' },
        },
      }),
    ).toBe(2);
  });

  it('returns 3 for two levels of nested properties', () => {
    expect(
      schemaDepth({
        type: 'object',
        properties: {
          a: {
            type: 'object',
            properties: {
              b: { type: 'string' },
            },
          },
        },
      }),
    ).toBe(3);
  });

  it('composition keywords (oneOf/anyOf/allOf) do NOT add a depth level themselves', () => {
    // A oneOf wrapper with branches of depth 2 should return 2, not 3
    const depth = schemaDepth({
      oneOf: [
        { type: 'object', properties: { a: { type: 'string' } } },
        { type: 'null' },
      ],
    });
    // oneOf doesn't add +1 to its branches; max branch = 2
    expect(depth).toBe(2);
  });

  it('allOf composition does not add a level', () => {
    const depth = schemaDepth({
      allOf: [
        { type: 'object', properties: { x: { type: 'string' } } },
      ],
    });
    expect(depth).toBe(2);
  });

  it('returns a value >= DEPTH_HARD_CAP and does not stack overflow for a 40-level deep schema', () => {
    // Build a 40-level deep nested properties schema programmatically
    const buildDeep = (levels: number): Record<string, unknown> => {
      if (levels === 0) return { type: 'string' };
      return { type: 'object', properties: { nested: buildDeep(levels - 1) } };
    };
    const deep40 = buildDeep(40);
    const depth = schemaDepth(deep40);
    // Should bail early at or after DEPTH_HARD_CAP without stack overflow
    expect(depth).toBeGreaterThanOrEqual(DEPTH_HARD_CAP);
    // And it must not throw
  });

  it('DEPTH_HARD_CAP is 32', () => {
    expect(DEPTH_HARD_CAP).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// hasExternalRef
// ---------------------------------------------------------------------------
describe('hasExternalRef', () => {
  it('returns true for a schema with an https external $ref', () => {
    const schema = {
      type: 'object',
      properties: {
        item: { $ref: 'https://x.com/schema.json' },
      },
    };
    expect(hasExternalRef(schema)).toBe(true);
  });

  it('returns true for a schema with an http external $ref', () => {
    expect(hasExternalRef({ $ref: 'http://example.com/s.json' })).toBe(true);
  });

  it('returns false for a schema with only an internal #/$defs $ref', () => {
    const schema = {
      type: 'object',
      properties: {
        item: { $ref: '#/$defs/Item' },
      },
      $defs: {
        Item: { type: 'string' },
      },
    };
    expect(hasExternalRef(schema)).toBe(false);
  });

  it('returns false for a schema with no $ref at all', () => {
    expect(hasExternalRef({ type: 'object', properties: { x: { type: 'string' } } })).toBe(false);
  });

  it('does NOT make any network call when encountering an external $ref (fetch is blocked)', () => {
    // If fetch is called this will throw "network blocked"; we expect no throw
    expect(() =>
      hasExternalRef({ $ref: 'https://malicious.example.com/schema.json' }),
    ).not.toThrow();
  });

  it('returns true for a deeply nested external $ref', () => {
    const schema = {
      type: 'object',
      properties: {
        a: {
          type: 'object',
          properties: {
            b: { $ref: 'https://external.example.com/nested.json' },
          },
        },
      },
    };
    expect(hasExternalRef(schema)).toBe(true);
  });

  it('handles null and primitives without throwing', () => {
    expect(() => hasExternalRef(null)).not.toThrow();
    expect(() => hasExternalRef(42)).not.toThrow();
    expect(() => hasExternalRef('string')).not.toThrow();
    expect(hasExternalRef(null)).toBe(false);
  });
});
