import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistryFile } from '../../packages/core/src/loadRegistry.js';
import { descriptionRules } from '../../packages/linter/src/rules/description.js';
import type { RuleContext } from '../../packages/linter/src/engine/types.js';
import type { ToolSnapshot } from '../../packages/linter/src/ingestion/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = join(__dirname, '../fixtures/rules');

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

const loadFixture = (filename: string): ToolSnapshot[] =>
  JSON.parse(readFileSync(join(fixturesDir, filename), 'utf8')) as ToolSnapshot[];

const makeCtx = (tool: ToolSnapshot): Readonly<RuleContext> =>
  Object.freeze({ tool, surface: [tool], config: {} });

// ────────────────────────────────────────────────────────────────────
// Network block: ensures no rule touches the network
// ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('Network blocked in tests')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ────────────────────────────────────────────────────────────────────
// Structural assertions
// ────────────────────────────────────────────────────────────────────

describe('descriptionRules structure', () => {
  it('exports an array of exactly 3 rules', () => {
    expect(descriptionRules).toHaveLength(3);
  });

  it('all rules have dimension "description"', () => {
    for (const rule of descriptionRules) {
      expect(rule.dimension).toBe('description');
    }
  });

  it('all rules have target "tool"', () => {
    for (const rule of descriptionRules) {
      expect(rule.target).toBe('tool');
    }
  });

  it('all rules have mtqsVersion "0.1"', () => {
    for (const rule of descriptionRules) {
      expect(rule.mtqsVersion).toBe('0.1');
    }
  });

  it('rule IDs are MTQS-D01, MTQS-D02, MTQS-D03', () => {
    const ids = descriptionRules.map(r => r.id).sort();
    expect(ids).toEqual(['MTQS-D01', 'MTQS-D02', 'MTQS-D03']);
  });

  it('cross-checks defaultSeverity and fixHint against spec/mtqs-v0.1.yaml', () => {
    const specPath = join(__dirname, '../../spec/mtqs-v0.1.yaml');
    const entries = loadRegistryFile(specPath);
    for (const rule of descriptionRules) {
      const specEntry = entries.find(e => e.id === rule.id);
      expect(specEntry, `Spec entry not found for ${rule.id}`).toBeDefined();
      expect(rule.defaultSeverity).toBe(specEntry!.severity);
      // fixHint comparison: trim whitespace and collapse newlines for YAML multi-line strings
      const normalizeHint = (s: string) => s.replace(/\s+/g, ' ').trim();
      expect(normalizeHint(rule.fixHint)).toBe(normalizeHint(specEntry!.fixHint));
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// D01: Description Presence
// ────────────────────────────────────────────────────────────────────

describe('MTQS-D01: description presence', () => {
  const d01 = () => descriptionRules.find(r => r.id === 'MTQS-D01')!;

  it('fires when description is empty string', () => {
    const tool: ToolSnapshot = {
      toolId: 'no_desc', contentHash: 'x', name: 'no_desc',
      description: '',
      inputSchema: { type: 'object' },
    };
    const findings = d01().fn(makeCtx(tool));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-D01');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].dimension).toBe('description');
    expect(findings[0].location.tool).toBe('no_desc');
    expect(findings[0].location.path).toEqual(['description']);
    expect(findings[0].message).toContain('MTQS-D01');
    expect(findings[0].message).toContain('absent or empty');
  });

  it('fires when description is absent (undefined)', () => {
    const tool: ToolSnapshot = {
      toolId: 'no_desc', contentHash: 'x', name: 'no_desc',
      inputSchema: { type: 'object' },
    };
    const findings = d01().fn(makeCtx(tool));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-D01');
  });

  it('is silent when description is non-empty', () => {
    const tool: ToolSnapshot = {
      toolId: 'good_tool', contentHash: 'x', name: 'good_tool',
      description: 'A substantive description with more than 20 characters.',
      inputSchema: { type: 'object' },
    };
    expect(d01().fn(makeCtx(tool))).toHaveLength(0);
  });

  it('does not throw when network is blocked', () => {
    const tool: ToolSnapshot = {
      toolId: 'test', contentHash: 'x', name: 'test',
      description: '',
      inputSchema: { type: 'object' },
    };
    expect(() => d01().fn(makeCtx(tool))).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────
// D02: Description Minimum Length
// ────────────────────────────────────────────────────────────────────

describe('MTQS-D02: description minimum length', () => {
  const d02 = () => descriptionRules.find(r => r.id === 'MTQS-D02')!;

  it('fires when description length < 20', () => {
    const tool: ToolSnapshot = {
      toolId: 'short_tool', contentHash: 'x', name: 'short_tool',
      description: 'Short desc', // 10 chars
      inputSchema: { type: 'object' },
    };
    const findings = d02().fn(makeCtx(tool));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-D02');
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].message).toContain('10');
    expect(findings[0].message).toContain('20');
    expect(findings[0].location.path).toEqual(['description']);
  });

  it('interpolates the actual character count in the message', () => {
    const desc = 'Search'; // 6 chars
    const tool: ToolSnapshot = {
      toolId: 'search', contentHash: 'x', name: 'search',
      description: desc,
      inputSchema: { type: 'object' },
    };
    const findings = d02().fn(makeCtx(tool));
    expect(findings[0].message).toContain('6');
  });

  it('is silent when description length is exactly 20', () => {
    const tool: ToolSnapshot = {
      toolId: 'exact20', contentHash: 'x', name: 'exact20',
      description: '12345678901234567890', // exactly 20
      inputSchema: { type: 'object' },
    };
    expect(d02().fn(makeCtx(tool))).toHaveLength(0);
  });

  it('is silent when description length is > 20', () => {
    const tool: ToolSnapshot = {
      toolId: 'long_desc', contentHash: 'x', name: 'long_desc',
      description: 'Search CRM contacts by name or email.',
      inputSchema: { type: 'object' },
    };
    expect(d02().fn(makeCtx(tool))).toHaveLength(0);
  });

  it('is silent when description is absent (D01 handles that)', () => {
    const tool: ToolSnapshot = {
      toolId: 'no_desc', contentHash: 'x', name: 'no_desc',
      inputSchema: { type: 'object' },
    };
    // D02 should be silent — empty/absent description is D01's domain
    const findings = d02().fn(makeCtx(tool));
    expect(findings).toHaveLength(0);
  });

  it('does not throw when network is blocked', () => {
    const tool: ToolSnapshot = {
      toolId: 'test', contentHash: 'x', name: 'test',
      description: 'Too short',
      inputSchema: { type: 'object' },
    };
    expect(() => d02().fn(makeCtx(tool))).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────
// D03: Description Not a Name Copy
// ────────────────────────────────────────────────────────────────────

describe('MTQS-D03: description not a name copy', () => {
  const d03 = () => descriptionRules.find(r => r.id === 'MTQS-D03')!;

  it('fires when description === name (strict equality)', () => {
    const tool: ToolSnapshot = {
      toolId: 'search', contentHash: 'x', name: 'search',
      description: 'search',
      inputSchema: { type: 'object' },
    };
    const findings = d03().fn(makeCtx(tool));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-D03');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].message).toContain('search');
    expect(findings[0].message).toContain('byte-for-byte copy');
    expect(findings[0].location.path).toEqual(['description']);
  });

  it('is silent when description differs from name', () => {
    const tool: ToolSnapshot = {
      toolId: 'search', contentHash: 'x', name: 'search',
      description: 'Full-text search across all indexed documents.',
      inputSchema: { type: 'object' },
    };
    expect(d03().fn(makeCtx(tool))).toHaveLength(0);
  });

  it('is silent when description is absent (D01 handles that)', () => {
    const tool: ToolSnapshot = {
      toolId: 'search', contentHash: 'x', name: 'search',
      inputSchema: { type: 'object' },
    };
    expect(d03().fn(makeCtx(tool))).toHaveLength(0);
  });

  it('does not throw when network is blocked', () => {
    const tool: ToolSnapshot = {
      toolId: 'test', contentHash: 'x', name: 'test',
      description: 'test',
      inputSchema: { type: 'object' },
    };
    expect(() => d03().fn(makeCtx(tool))).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────
// Worked example: 'search' tool fires BOTH D02 and D03 independently
// ────────────────────────────────────────────────────────────────────

describe('search worked example (spec §4.4)', () => {
  const searchTool: ToolSnapshot = {
    toolId: 'search',
    contentHash: 'abc125',
    name: 'search',
    description: 'search', // 6 chars, equals name
    inputSchema: { type: 'object', properties: {} },
  };

  it('produces exactly D02 and D03 findings from all descriptionRules', () => {
    const ctx = makeCtx(searchTool);
    const findings = descriptionRules.flatMap(rule => rule.fn(ctx));
    const ruleIds = findings.map(f => f.ruleId).sort();
    // D01 does NOT fire (description is non-empty)
    // D02 fires (length 6 < 20)
    // D03 fires (description === name)
    expect(ruleIds).toEqual(['MTQS-D02', 'MTQS-D03']);
  });

  it('D01 does NOT fire on the search tool (description is non-empty)', () => {
    const d01 = descriptionRules.find(r => r.id === 'MTQS-D01')!;
    expect(d01.fn(makeCtx(searchTool))).toHaveLength(0);
  });

  it('D02 and D03 fire independently (no suppression)', () => {
    const d02 = descriptionRules.find(r => r.id === 'MTQS-D02')!;
    const d03 = descriptionRules.find(r => r.id === 'MTQS-D03')!;
    expect(d02.fn(makeCtx(searchTool))).toHaveLength(1);
    expect(d03.fn(makeCtx(searchTool))).toHaveLength(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// Fixture-based tests
// ────────────────────────────────────────────────────────────────────

describe('description-pass fixture yields zero D findings', () => {
  it('no description rules fire on passing tools', () => {
    const tools = loadFixture('description-pass.json');
    for (const tool of tools) {
      const ctx = makeCtx(tool);
      const findings = descriptionRules.flatMap(rule => rule.fn(ctx));
      expect(findings, `Expected no findings for tool ${tool.toolId}`).toHaveLength(0);
    }
  });
});

describe('description-fail fixture fires expected rules', () => {
  it('D01 fires on the empty-description tool', () => {
    const tools = loadFixture('description-fail.json');
    const emptyDescTool = tools.find(t => t.toolId === 'no_description_tool')!;
    const d01 = descriptionRules.find(r => r.id === 'MTQS-D01')!;
    expect(d01.fn(makeCtx(emptyDescTool))).toHaveLength(1);
  });

  it('D02 fires on the short-description tool', () => {
    const tools = loadFixture('description-fail.json');
    const shortDescTool = tools.find(t => t.toolId === 'short_description_tool')!;
    const d02 = descriptionRules.find(r => r.id === 'MTQS-D02')!;
    expect(d02.fn(makeCtx(shortDescTool))).toHaveLength(1);
  });

  it('search tool in fail fixture fires D02 + D03', () => {
    const tools = loadFixture('description-fail.json');
    const searchTool = tools.find(t => t.toolId === 'search')!;
    const ctx = makeCtx(searchTool);
    const findings = descriptionRules.flatMap(rule => rule.fn(ctx));
    const ruleIds = findings.map(f => f.ruleId).sort();
    expect(ruleIds).toEqual(['MTQS-D02', 'MTQS-D03']);
  });
});
