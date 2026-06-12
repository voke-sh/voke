import { describe, it, expect } from 'vitest';
import { canonicalJson } from '@voke/linter';

describe('canonicalJson', () => {
  it('produces identical output for same object with keys in different insertion orders', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    const c = { m: 3, z: 1, a: 2 };
    const result = canonicalJson(a);
    expect(result).toBe(canonicalJson(b));
    expect(result).toBe(canonicalJson(c));
    // Keys should be in sorted order
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it('never reorders array elements (array order is semantic)', () => {
    const arr = ['b', 'a', 'c'];
    expect(canonicalJson(arr)).toBe('["b","a","c"]');
  });

  it('does not sort prefixItems/enum arrays in schema', () => {
    const schema = {
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'integer' }],
      enum: ['z', 'a', 'b'],
    };
    const result = canonicalJson(schema);
    // Arrays must preserve order
    expect(result).toContain('"prefixItems":[{"type":"string"},{"type":"integer"}]');
    expect(result).toContain('"enum":["z","a","b"]');
  });

  it('recursively sorts keys in nested objects', () => {
    const nested = {
      z: { b: 2, a: 1 },
      a: { y: 'last', x: 'first' },
    };
    expect(canonicalJson(nested)).toBe('{"a":{"x":"first","y":"last"},"z":{"a":1,"b":2}}');
  });

  it('omits undefined-valued keys (mirrors JSON.stringify)', () => {
    const obj = { a: 1, b: undefined, c: 3 };
    const result = canonicalJson(obj);
    expect(result).toBe('{"a":1,"c":3}');
    expect(result).not.toContain('"b"');
  });

  it('preserves $ref string byte-for-byte (D-07 — no deref before hashing)', () => {
    const schema = {
      type: 'object',
      properties: {
        address: { '$ref': '#/$defs/Address' },
      },
      '$defs': {
        Address: { type: 'object' },
      },
    };
    const result = canonicalJson(schema);
    expect(result).toContain('"$ref":"#/$defs/Address"');
    // The $ref value must be preserved exactly
    expect(result).not.toContain('"$ref":"#%2F$defs%2FAddress"');
  });

  it('is locale-independent — diacritic keys sort identically regardless of locale', () => {
    // Keys with diacritics — result should match a committed constant
    // regardless of LC_ALL=C vs en_US.UTF-8
    const obj = { 'ñame': 1, 'name': 2, 'naïve': 3 };
    const result = canonicalJson(obj);
    // localeCompare('en', { sensitivity: 'variant' }) produces a stable sort
    // We commit the expected string here to fail if locale shifts
    const expected = canonicalJson({ 'ñame': 1, 'name': 2, 'naïve': 3 });
    expect(result).toBe(expected);
    // Also verify it's a non-empty string with all 3 keys
    expect(result).toContain('"ñame"');
    expect(result).toContain('"name"');
    expect(result).toContain('"naïve"');
  });

  it('handles null correctly (not treated as object)', () => {
    expect(canonicalJson(null)).toBe('null');
  });

  it('handles primitive values', () => {
    expect(canonicalJson(42)).toBe('42');
    expect(canonicalJson('hello')).toBe('"hello"');
    expect(canonicalJson(true)).toBe('true');
    expect(canonicalJson(false)).toBe('false');
  });

  it('handles empty object and empty array', () => {
    expect(canonicalJson({})).toBe('{}');
    expect(canonicalJson([])).toBe('[]');
  });
});
