import { describe, it, expect } from 'vitest';
import { loadRegistry } from '../../spec/helpers/loadRegistry.js';

// Minimal valid YAML entry for reuse
const VALID_ENTRY_YAML = `
rules:
  - id: MTQS-S01
    severity: error
    dimension: schema
    scope: per-tool
    weight: 1.5
    description: inputSchema must be present and non-null
    fixHint: Add a valid JSON Schema object as the inputSchema field
    source: "https://modelcontextprotocol.io/specification/draft/basic/index"
    mtqsVersion: "0.1"
`;

describe('loadRegistry', () => {
  it('Test 1: parses a valid YAML string with one well-formed entry and returns typed array of length 1', () => {
    const entries = loadRegistry(VALID_ENTRY_YAML);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('MTQS-S01');
    expect(entries[0].severity).toBe('error');
    expect(entries[0].dimension).toBe('schema');
    expect(entries[0].scope).toBe('per-tool');
    expect(entries[0].weight).toBe(1.5);
  });

  it('Test 2: throws when an entry is missing the required "source" field', () => {
    const yamlMissingSource = `
rules:
  - id: MTQS-S01
    severity: error
    dimension: schema
    scope: per-tool
    weight: 1.5
    description: inputSchema must be present and non-null
    fixHint: Add a valid JSON Schema object as the inputSchema field
    mtqsVersion: "0.1"
`;
    expect(() => loadRegistry(yamlMissingSource)).toThrow();
  });

  it('Test 3: throws when an entry has an invalid id format (MTQS-X1 — wrong dimension letter)', () => {
    const yamlBadId = `
rules:
  - id: MTQS-X1
    severity: error
    dimension: schema
    scope: per-tool
    weight: 1.5
    description: inputSchema must be present and non-null
    fixHint: Add a valid JSON Schema object as the inputSchema field
    source: "https://modelcontextprotocol.io/specification/draft/basic/index"
    mtqsVersion: "0.1"
`;
    expect(() => loadRegistry(yamlBadId)).toThrow();
  });

  it('Test 4: throws when an entry has severity "fatal" (not in enum)', () => {
    const yamlBadSeverity = `
rules:
  - id: MTQS-S01
    severity: fatal
    dimension: schema
    scope: per-tool
    weight: 1.5
    description: inputSchema must be present and non-null
    fixHint: Add a valid JSON Schema object as the inputSchema field
    source: "https://modelcontextprotocol.io/specification/draft/basic/index"
    mtqsVersion: "0.1"
`;
    expect(() => loadRegistry(yamlBadSeverity)).toThrow();
  });
});
