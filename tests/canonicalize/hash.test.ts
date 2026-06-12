import { describe, it, expect } from 'vitest';
import { sha256, toolContentHash, surfaceContentHash, canonicalJson } from '@voke/linter';

describe('sha256', () => {
  it('produces a deterministic 64-char hex digest', () => {
    const hash = sha256('hello world');
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('produces identical output for same input across multiple calls', () => {
    const input = '{"name":"test","description":"a test tool"}';
    const h1 = sha256(input);
    const h2 = sha256(input);
    const h3 = sha256(input);
    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256('input-a')).not.toBe(sha256('input-b'));
  });
});

describe('toolContentHash', () => {
  it('hashes exactly the 5 canonical fields: name, description, inputSchema, outputSchema, annotations', () => {
    const tool = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      outputSchema: undefined,
      annotations: undefined,
      // Extra field that must NOT be included in the hash
      someExtraField: 'should be ignored',
    };
    const hash = toolContentHash(tool);
    expect(hash).toHaveLength(64);
    // Must match hash of only the 5 canonical fields (manually computed for comparison)
    const expected = sha256(
      canonicalJson({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
        outputSchema: undefined,
        annotations: undefined,
      }),
    );
    expect(hash).toBe(expected);
  });

  it('is identical regardless of object key insertion order (D-03)', () => {
    const toolA = {
      annotations: undefined,
      outputSchema: undefined,
      inputSchema: { type: 'object' },
      description: 'A tool',
      name: 'my_tool',
    };
    const toolB = {
      name: 'my_tool',
      description: 'A tool',
      inputSchema: { type: 'object' },
      outputSchema: undefined,
      annotations: undefined,
    };
    expect(toolContentHash(toolA)).toBe(toolContentHash(toolB));
  });

  it('handles tools with all optional fields absent', () => {
    const tool = {
      name: 'minimal_tool',
      description: undefined,
      inputSchema: { type: 'object' },
      outputSchema: undefined,
      annotations: undefined,
    };
    const hash = toolContentHash(tool);
    expect(hash).toHaveLength(64);
  });

  it('produces different hashes for tools with different names', () => {
    const toolA = { name: 'tool_a', description: 'same', inputSchema: {}, outputSchema: undefined, annotations: undefined };
    const toolB = { name: 'tool_b', description: 'same', inputSchema: {}, outputSchema: undefined, annotations: undefined };
    expect(toolContentHash(toolA)).not.toBe(toolContentHash(toolB));
  });
});

describe('surfaceContentHash', () => {
  it('produces identical hash regardless of input tool array order', () => {
    const tools = [
      { toolId: 'z_tool', name: 'z_tool', description: 'Z' },
      { toolId: 'a_tool', name: 'a_tool', description: 'A' },
      { toolId: 'm_tool', name: 'm_tool', description: 'M' },
    ];
    const shuffled = [
      { toolId: 'm_tool', name: 'm_tool', description: 'M' },
      { toolId: 'z_tool', name: 'z_tool', description: 'Z' },
      { toolId: 'a_tool', name: 'a_tool', description: 'A' },
    ];
    expect(surfaceContentHash(tools)).toBe(surfaceContentHash(shuffled));
  });

  it('sorts tools by toolId using locale-independent localeCompare', () => {
    const tools = [
      { toolId: 'crm_search', name: 'crm_search' },
      { toolId: 'account_list', name: 'account_list' },
    ];
    const reversed = [
      { toolId: 'account_list', name: 'account_list' },
      { toolId: 'crm_search', name: 'crm_search' },
    ];
    expect(surfaceContentHash(tools)).toBe(surfaceContentHash(reversed));
  });

  it('produces different hashes for different tool surfaces', () => {
    const surface1 = [{ toolId: 'tool_a', name: 'tool_a' }];
    const surface2 = [{ toolId: 'tool_b', name: 'tool_b' }];
    expect(surfaceContentHash(surface1)).not.toBe(surfaceContentHash(surface2));
  });
});
