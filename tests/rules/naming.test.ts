import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistryFile } from '../../packages/core/src/loadRegistry.js';
import { namingRules } from '../../packages/linter/src/rules/naming.js';
import type { RuleContext } from '../../packages/linter/src/engine/types.js';
import type { ToolSnapshot } from '../../packages/linter/src/ingestion/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = join(__dirname, '../fixtures/rules');

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

const loadFixture = (filename: string): ToolSnapshot[] =>
  JSON.parse(readFileSync(join(fixturesDir, filename), 'utf8')) as ToolSnapshot[];

const makeCtx = (tool: ToolSnapshot, surface?: ToolSnapshot[]): Readonly<RuleContext> =>
  Object.freeze({ tool, surface: surface ?? [tool], config: {} });

const makeServerCtx = (surface: ToolSnapshot[]): Readonly<RuleContext> =>
  Object.freeze({ tool: null, surface, config: {} });

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

describe('namingRules structure', () => {
  it('exports an array of exactly 3 rules', () => {
    expect(namingRules).toHaveLength(3);
  });

  it('all rules have dimension "naming"', () => {
    for (const rule of namingRules) {
      expect(rule.dimension).toBe('naming');
    }
  });

  it('all rules have mtqsVersion "0.1"', () => {
    for (const rule of namingRules) {
      expect(rule.mtqsVersion).toBe('0.1');
    }
  });

  it('rule IDs are MTQS-N01, MTQS-N02, MTQS-N03', () => {
    const ids = namingRules.map(r => r.id).sort();
    expect(ids).toEqual(['MTQS-N01', 'MTQS-N02', 'MTQS-N03']);
  });

  it('N01 and N02 have target "tool"', () => {
    const toolRules = namingRules.filter(r => r.id === 'MTQS-N01' || r.id === 'MTQS-N02');
    for (const rule of toolRules) {
      expect(rule.target).toBe('tool');
    }
  });

  it('N03 has target "server" (the only server-scoped rule in MTQS v0.1)', () => {
    const n03 = namingRules.find(r => r.id === 'MTQS-N03')!;
    expect(n03.target).toBe('server');
  });

  it('exactly one rule has target "server"', () => {
    const serverRules = namingRules.filter(r => r.target === 'server');
    expect(serverRules).toHaveLength(1);
    expect(serverRules[0].id).toBe('MTQS-N03');
  });

  it('cross-checks defaultSeverity and fixHint against spec/mtqs-v0.1.yaml', () => {
    const specPath = join(__dirname, '../../spec/mtqs-v0.1.yaml');
    const entries = loadRegistryFile(specPath);
    for (const rule of namingRules) {
      const specEntry = entries.find(e => e.id === rule.id);
      expect(specEntry, `Spec entry not found for ${rule.id}`).toBeDefined();
      expect(rule.defaultSeverity).toBe(specEntry!.severity);
      const normalizeHint = (s: string) => s.replace(/\s+/g, ' ').trim();
      expect(normalizeHint(rule.fixHint)).toBe(normalizeHint(specEntry!.fixHint));
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// N01: Tool Name Presence and Length
// ────────────────────────────────────────────────────────────────────

describe('MTQS-N01: tool name presence and length', () => {
  const n01 = () => namingRules.find(r => r.id === 'MTQS-N01')!;

  it('fires when tool name is empty string', () => {
    const tool: ToolSnapshot = {
      toolId: '', contentHash: 'x', name: '',
      description: 'A tool with no name.',
      inputSchema: { type: 'object' },
    };
    const findings = n01().fn(makeCtx(tool));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-N01');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].location.path).toEqual(['name']);
  });

  it('fires when tool name exceeds 128 characters', () => {
    const longName = 'search_for_contacts_in_the_crm_system_using_multiple_criteria_including_name_email_phone_and_company_with_pagination_support_and_sorting_options'; // 144 chars
    const tool: ToolSnapshot = {
      toolId: longName, contentHash: 'x', name: longName,
      description: 'A tool with a very long name.',
      inputSchema: { type: 'object' },
    };
    const findings = n01().fn(makeCtx(tool));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-N01');
    expect(findings[0].message).toContain('144');
    expect(findings[0].message).toContain('128');
    expect(findings[0].location.path).toEqual(['name']);
  });

  it('is silent for a valid name within 1-128 characters', () => {
    const tool: ToolSnapshot = {
      toolId: 'crm_search', contentHash: 'x', name: 'crm_search',
      description: 'Search CRM contacts by criteria.',
      inputSchema: { type: 'object' },
    };
    expect(n01().fn(makeCtx(tool))).toHaveLength(0);
  });

  it('is silent for a name that is exactly 128 characters', () => {
    const name128 = 'a'.repeat(128);
    const tool: ToolSnapshot = {
      toolId: name128, contentHash: 'x', name: name128,
      description: 'A tool with a maximum-length name.',
      inputSchema: { type: 'object' },
    };
    expect(n01().fn(makeCtx(tool))).toHaveLength(0);
  });

  it('does not throw when network is blocked', () => {
    const tool: ToolSnapshot = {
      toolId: 'test', contentHash: 'x', name: '',
      inputSchema: { type: 'object' },
    };
    expect(() => n01().fn(makeCtx(tool))).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────
// N02: Tool Name Character Set
// ────────────────────────────────────────────────────────────────────

describe('MTQS-N02: tool name character set', () => {
  const n02 = () => namingRules.find(r => r.id === 'MTQS-N02')!;

  it('fires when tool name contains a space', () => {
    const tool: ToolSnapshot = {
      toolId: 'search contacts, all', contentHash: 'x', name: 'search contacts, all',
      description: 'Search all contacts.',
      inputSchema: { type: 'object' },
    };
    const findings = n02().fn(makeCtx(tool));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-N02');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].message).toContain('search contacts, all');
    expect(findings[0].location.path).toEqual(['name']);
  });

  it('fires when tool name contains a comma', () => {
    const tool: ToolSnapshot = {
      toolId: 'search,all', contentHash: 'x', name: 'search,all',
      inputSchema: { type: 'object' },
    };
    const findings = n02().fn(makeCtx(tool));
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-N02');
  });

  it('is silent for names with only allowed chars: letters, digits, _, -, ., /', () => {
    const validNames = [
      'crm_search', 'CRM-search', 'crm.search', 'crm/search',
      'CrmSearchContacts123', 'search_v2', 'abc-def.ghi/jkl',
    ];
    for (const name of validNames) {
      const tool: ToolSnapshot = {
        toolId: name, contentHash: 'x', name,
        inputSchema: { type: 'object' },
      };
      expect(n02().fn(makeCtx(tool)), `Expected no findings for name "${name}"`).toHaveLength(0);
    }
  });

  it('does not throw when network is blocked', () => {
    const tool: ToolSnapshot = {
      toolId: 'test name', contentHash: 'x', name: 'test name',
      inputSchema: { type: 'object' },
    };
    expect(() => n02().fn(makeCtx(tool))).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────
// N03: Tool Name Uniqueness (server-scoped)
// ────────────────────────────────────────────────────────────────────

describe('MTQS-N03: tool name uniqueness (server-scoped)', () => {
  const n03 = () => namingRules.find(r => r.id === 'MTQS-N03')!;

  it('fires exactly once on a surface with two tools sharing the name "search"', () => {
    const surface = loadFixture('naming-duplicate-surface.json');
    const ctx = makeServerCtx(surface);
    const findings = n03().fn(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-N03');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].message).toContain('search');
    expect(findings[0].message).toContain('2');
    expect(findings[0].location.tool).toBe('');
  });

  it('N03 finding has location.tool === "" (server convention)', () => {
    const surface = loadFixture('naming-duplicate-surface.json');
    const ctx = makeServerCtx(surface);
    const findings = n03().fn(ctx);
    expect(findings[0].location.tool).toBe('');
  });

  it('is silent when all names are unique', () => {
    const surface: ToolSnapshot[] = [
      { toolId: 'get_user', contentHash: 'x', name: 'get_user', inputSchema: { type: 'object' } },
      { toolId: 'create_user', contentHash: 'y', name: 'create_user', inputSchema: { type: 'object' } },
      { toolId: 'delete_user', contentHash: 'z', name: 'delete_user', inputSchema: { type: 'object' } },
    ];
    const ctx = makeServerCtx(surface);
    expect(n03().fn(ctx)).toHaveLength(0);
  });

  it('emits one finding per duplicated name (not one per duplicate tool)', () => {
    // Three tools share the same name "search" — should produce exactly 1 finding
    const surface: ToolSnapshot[] = [
      { toolId: 'search_a', contentHash: 'a', name: 'search', inputSchema: { type: 'object' } },
      { toolId: 'search_b', contentHash: 'b', name: 'search', inputSchema: { type: 'object' } },
      { toolId: 'search_c', contentHash: 'c', name: 'search', inputSchema: { type: 'object' } },
    ];
    const ctx = makeServerCtx(surface);
    const findings = n03().fn(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('3');
  });

  it('is called with tool: null (server-scoped — engine passes null)', () => {
    const surface = loadFixture('naming-duplicate-surface.json');
    const ctx = makeServerCtx(surface);
    // ctx.tool is null for server-scoped rules
    expect(ctx.tool).toBeNull();
  });

  it('reads ctx.surface to detect duplicate names', () => {
    // Verify the rule works correctly from surface — unique surface yields 0
    const uniqueSurface: ToolSnapshot[] = [
      { toolId: 'a', contentHash: 'a', name: 'a', inputSchema: { type: 'object' } },
    ];
    expect(n03().fn(makeServerCtx(uniqueSurface))).toHaveLength(0);
  });

  it('does not throw when network is blocked', () => {
    const surface = loadFixture('naming-duplicate-surface.json');
    expect(() => n03().fn(makeServerCtx(surface))).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────
// Fixture-based tests
// ────────────────────────────────────────────────────────────────────

describe('naming-pass fixture yields zero N01/N02 findings', () => {
  it('N01 and N02 do not fire on passing tool', () => {
    const tools = loadFixture('naming-pass.json');
    for (const tool of tools) {
      const ctx = makeCtx(tool);
      const n01 = namingRules.find(r => r.id === 'MTQS-N01')!;
      const n02 = namingRules.find(r => r.id === 'MTQS-N02')!;
      expect(n01.fn(ctx), `Expected no N01 for ${tool.toolId}`).toHaveLength(0);
      expect(n02.fn(ctx), `Expected no N02 for ${tool.toolId}`).toHaveLength(0);
    }
  });
});

describe('naming-fail fixture fires expected N01/N02 rules', () => {
  it('N01 fires on the 144-character name tool', () => {
    const tools = loadFixture('naming-fail.json');
    const longNameTool = tools[0]; // 144-char name (spec example name is actually 144 chars)
    const n01 = namingRules.find(r => r.id === 'MTQS-N01')!;
    const findings = n01.fn(makeCtx(longNameTool));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('144');
  });

  it('N02 fires on the "search contacts, all" tool', () => {
    const tools = loadFixture('naming-fail.json');
    const illegalNameTool = tools[1]; // "search contacts, all"
    const n02 = namingRules.find(r => r.id === 'MTQS-N02')!;
    const findings = n02.fn(makeCtx(illegalNameTool));
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('search contacts, all');
  });
});

describe('naming-duplicate-surface fixture fires N03', () => {
  it('N03 fires once on a surface with duplicate names', () => {
    const surface = loadFixture('naming-duplicate-surface.json');
    const n03 = namingRules.find(r => r.id === 'MTQS-N03')!;
    const ctx = makeServerCtx(surface);
    const findings = n03.fn(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].location.tool).toBe('');
  });
});
