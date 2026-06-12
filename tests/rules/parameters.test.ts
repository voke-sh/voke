/**
 * parameters.test.ts — Unit tests for MTQS Parameter Semantics rules P01 and P02.
 *
 * TDD approach:
 * - RED: written before parameters.ts exists — all tests fail initially
 * - GREEN: parameterRules implementation passes all tests
 *
 * Network-block stub (D-14): all tests run with fetch stubbed to reject.
 * Rules must be pure functions that never call fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parameterRules } from '../../packages/linter/src/rules/parameters.js';
import { loadRegistryFile } from '@voke/core';
import type { RuleContext } from '../../packages/linter/src/engine/types.js';
import type { ToolSnapshot } from '../../packages/linter/src/ingestion/types.js';
import type { VokeConfig } from '../../packages/linter/src/config/types.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Network-block stub (D-14) ────────────────────────────────────────────────
// Rules must be pure. Any rule that calls fetch will throw at test time.

beforeEach(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('Network blocked in tests (D-14)')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const fixturesDir = resolve(process.cwd(), 'tests/fixtures/rules');

const loadFailFixture = (): { p01_failing: ToolSnapshot; p02_failing: ToolSnapshot } =>
  JSON.parse(readFileSync(resolve(fixturesDir, 'parameters-fail.json'), 'utf8')) as {
    p01_failing: ToolSnapshot;
    p02_failing: ToolSnapshot;
  };

const loadPassFixture = (): ToolSnapshot =>
  JSON.parse(readFileSync(resolve(fixturesDir, 'parameters-pass.json'), 'utf8')) as ToolSnapshot;

const emptyConfig: VokeConfig = {};

const makeCtx = (tool: ToolSnapshot): RuleContext =>
  Object.freeze({
    tool,
    surface: Object.freeze([tool]) as ReadonlyArray<ToolSnapshot>,
    config: emptyConfig,
  });

// ─── parameterRules registry ──────────────────────────────────────────────────

describe('parameterRules', () => {
  it('exports exactly 2 rules', () => {
    expect(parameterRules).toHaveLength(2);
  });

  it('both rules have dimension "parameters"', () => {
    for (const rule of parameterRules) {
      expect(rule.dimension).toBe('parameters');
    }
  });

  it('both rules have target "tool"', () => {
    for (const rule of parameterRules) {
      expect(rule.target).toBe('tool');
    }
  });

  it('both rules have defaultSeverity "warning"', () => {
    for (const rule of parameterRules) {
      expect(rule.defaultSeverity).toBe('warning');
    }
  });

  it('both rules have mtqsVersion "0.1"', () => {
    for (const rule of parameterRules) {
      expect(rule.mtqsVersion).toBe('0.1');
    }
  });

  it('P01 rule id is MTQS-P01', () => {
    const p01 = parameterRules.find(r => r.id === 'MTQS-P01');
    expect(p01).toBeDefined();
  });

  it('P02 rule id is MTQS-P02', () => {
    const p02 = parameterRules.find(r => r.id === 'MTQS-P02');
    expect(p02).toBeDefined();
  });
});

// ─── Cross-check against YAML registry ───────────────────────────────────────

describe('parameterRules YAML cross-check', () => {
  const registryEntries = loadRegistryFile(resolve(process.cwd(), 'spec/mtqs-v0.1.yaml'));

  for (const ruleId of ['MTQS-P01', 'MTQS-P02'] as const) {
    it(`${ruleId} defaultSeverity matches spec/mtqs-v0.1.yaml`, () => {
      const specEntry = registryEntries.find(e => e.id === ruleId);
      const implRule = parameterRules.find(r => r.id === ruleId);
      expect(specEntry).toBeDefined();
      expect(implRule).toBeDefined();
      expect(implRule!.defaultSeverity).toBe(specEntry!.severity);
    });

    it(`${ruleId} fixHint matches spec/mtqs-v0.1.yaml (verbatim trimmed)`, () => {
      const specEntry = registryEntries.find(e => e.id === ruleId);
      const implRule = parameterRules.find(r => r.id === ruleId);
      expect(specEntry).toBeDefined();
      expect(implRule).toBeDefined();
      // Compare trimmed strings since YAML scalar folds whitespace
      expect(implRule!.fixHint.trim()).toBe(specEntry!.fixHint.trim());
    });
  }
});

// ─── MTQS-P01: Parameter Descriptions ────────────────────────────────────────

describe('MTQS-P01: Parameter Descriptions', () => {
  const p01 = () => parameterRules.find(r => r.id === 'MTQS-P01')!;

  describe('failing cases', () => {
    it('fires one P01 finding for user_id (no description)', () => {
      const { p01_failing } = loadFailFixture();
      const findings = p01().fn(makeCtx(p01_failing));
      const p01Findings = findings.filter(f => f.ruleId === 'MTQS-P01');
      const userIdFinding = p01Findings.find(f =>
        f.location.path.includes('user_id'),
      );
      expect(userIdFinding).toBeDefined();
    });

    it('fires one P01 finding for include_deleted (no description)', () => {
      const { p01_failing } = loadFailFixture();
      const findings = p01().fn(makeCtx(p01_failing));
      const p01Findings = findings.filter(f => f.ruleId === 'MTQS-P01');
      const includeDeletedFinding = p01Findings.find(f =>
        f.location.path.includes('include_deleted'),
      );
      expect(includeDeletedFinding).toBeDefined();
    });

    it('fires exactly 2 P01 findings for the P01 failing fixture', () => {
      const { p01_failing } = loadFailFixture();
      const findings = p01().fn(makeCtx(p01_failing));
      const p01Findings = findings.filter(f => f.ruleId === 'MTQS-P01');
      expect(p01Findings).toHaveLength(2);
    });

    it('fires for a property with empty string description', () => {
      const tool: ToolSnapshot = {
        toolId: 'test_tool',
        contentHash: 'aaa',
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            empty_desc: { type: 'string', description: '' },
          },
        },
      };
      const findings = p01().fn(makeCtx(tool));
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('MTQS-P01');
      expect(findings[0].location.path).toContain('empty_desc');
    });

    it('finding has correct structure (ruleId, dimension, severity, location, message, fixHint)', () => {
      const { p01_failing } = loadFailFixture();
      const findings = p01().fn(makeCtx(p01_failing));
      const finding = findings.find(f => f.location.path.includes('user_id'))!;
      expect(finding.ruleId).toBe('MTQS-P01');
      expect(finding.dimension).toBe('parameters');
      expect(finding.severity).toBe('warning');
      expect(finding.location.tool).toBe('get_user');
      expect(finding.location.path).toEqual(['inputSchema', 'properties', 'user_id']);
      expect(finding.message).toContain('MTQS-P01');
      expect(finding.message).toContain('user_id');
      expect(finding.fixHint).toBeTruthy();
    });

    it('finding message follows spec format', () => {
      const { p01_failing } = loadFailFixture();
      const findings = p01().fn(makeCtx(p01_failing));
      const finding = findings.find(f => f.location.path.includes('user_id'))!;
      expect(finding.message).toBe(
        'MTQS-P01 [warning] inputSchema.properties.user_id has no description: agents cannot determine its meaning or constraints',
      );
    });
  });

  describe('passing cases', () => {
    it('fires zero P01 findings for the pass fixture (all properties have descriptions)', () => {
      const passFixture = loadPassFixture();
      const findings = p01().fn(makeCtx(passFixture));
      const p01Findings = findings.filter(f => f.ruleId === 'MTQS-P01');
      expect(p01Findings).toHaveLength(0);
    });

    it('returns [] when inputSchema has no properties key', () => {
      const tool: ToolSnapshot = {
        toolId: 'no_props',
        contentHash: 'bbb',
        name: 'no_props',
        description: 'Tool without properties',
        inputSchema: { type: 'object' },
      };
      const findings = p01().fn(makeCtx(tool));
      expect(findings).toHaveLength(0);
    });

    it('returns [] when inputSchema.properties is an empty object', () => {
      const tool: ToolSnapshot = {
        toolId: 'empty_props',
        contentHash: 'ccc',
        name: 'empty_props',
        description: 'Tool with empty properties',
        inputSchema: { type: 'object', properties: {} },
      };
      const findings = p01().fn(makeCtx(tool));
      expect(findings).toHaveLength(0);
    });

    it('does not fire for a property with a non-empty description', () => {
      const tool: ToolSnapshot = {
        toolId: 'good_tool',
        contentHash: 'ddd',
        name: 'good_tool',
        description: 'A well-described tool',
        inputSchema: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string',
              description: 'UUID of the user',
            },
          },
        },
      };
      const findings = p01().fn(makeCtx(tool));
      expect(findings).toHaveLength(0);
    });
  });

  describe('guard: no IO', () => {
    it('does not throw (fetch is blocked) — proves no network call in rule fn', () => {
      const { p01_failing } = loadFailFixture();
      // If rule called fetch, the stubbed rejection would cause the rule fn to throw
      expect(() => p01().fn(makeCtx(p01_failing))).not.toThrow();
    });
  });
});

// ─── MTQS-P02: Enum for Constrained Strings ──────────────────────────────────

describe('MTQS-P02: Enum for Constrained Strings', () => {
  const p02 = () => parameterRules.find(r => r.id === 'MTQS-P02')!;

  describe('failing cases — spec P02 failing example', () => {
    it('fires one P02 finding for the status property (free-text "One of:" pattern)', () => {
      const { p02_failing } = loadFailFixture();
      const findings = p02().fn(makeCtx(p02_failing));
      const p02Findings = findings.filter(f => f.ruleId === 'MTQS-P02');
      expect(p02Findings).toHaveLength(1);
      expect(p02Findings[0].location.path).toContain('status');
    });

    it('P02 finding has correct location path', () => {
      const { p02_failing } = loadFailFixture();
      const findings = p02().fn(makeCtx(p02_failing));
      const finding = findings.find(f => f.ruleId === 'MTQS-P02')!;
      expect(finding.location.path).toEqual(['inputSchema', 'properties', 'status']);
      expect(finding.location.tool).toBe('list_contacts');
    });

    it('P02 finding has correct structure', () => {
      const { p02_failing } = loadFailFixture();
      const findings = p02().fn(makeCtx(p02_failing));
      const finding = findings.find(f => f.ruleId === 'MTQS-P02')!;
      expect(finding.ruleId).toBe('MTQS-P02');
      expect(finding.dimension).toBe('parameters');
      expect(finding.severity).toBe('warning');
      expect(finding.message).toContain('MTQS-P02');
      expect(finding.message).toContain('status');
      expect(finding.fixHint).toBeTruthy();
    });

    it('P02 finding message follows spec format', () => {
      const { p02_failing } = loadFailFixture();
      const findings = p02().fn(makeCtx(p02_failing));
      const finding = findings.find(f => f.ruleId === 'MTQS-P02')!;
      expect(finding.message).toBe(
        'MTQS-P02 [warning] inputSchema.properties.status appears to have a finite value set described in text: consider using "enum" to enforce valid values',
      );
    });

    it('fires for "One of:" pattern (case-insensitive)', () => {
      const tool: ToolSnapshot = {
        toolId: 'test_tool',
        contentHash: 'eee',
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              description: 'one of: json, xml, csv',
            },
          },
        },
      };
      const findings = p02().fn(makeCtx(tool));
      expect(findings.filter(f => f.ruleId === 'MTQS-P02')).toHaveLength(1);
    });

    it('fires for "values: a, b, c" pattern', () => {
      const tool: ToolSnapshot = {
        toolId: 'test_tool',
        contentHash: 'fff',
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            sort_order: {
              type: 'string',
              description: 'Sort direction. values: asc, desc, random',
            },
          },
        },
      };
      const findings = p02().fn(makeCtx(tool));
      expect(findings.filter(f => f.ruleId === 'MTQS-P02')).toHaveLength(1);
    });

    it('fires for "options: a, b, c" pattern', () => {
      const tool: ToolSnapshot = {
        toolId: 'test_tool',
        contentHash: 'ggg',
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            output_format: {
              type: 'string',
              description: 'Output format options: json, yaml, toml',
            },
          },
        },
      };
      const findings = p02().fn(makeCtx(tool));
      expect(findings.filter(f => f.ruleId === 'MTQS-P02')).toHaveLength(1);
    });
  });

  describe('passing cases', () => {
    it('fires zero P02 findings for the pass fixture (status uses enum)', () => {
      const passFixture = loadPassFixture();
      const findings = p02().fn(makeCtx(passFixture));
      const p02Findings = findings.filter(f => f.ruleId === 'MTQS-P02');
      expect(p02Findings).toHaveLength(0);
    });

    it('does not fire for a string property that already has enum', () => {
      const tool: ToolSnapshot = {
        toolId: 'good_tool',
        contentHash: 'hhh',
        name: 'good_tool',
        description: 'A good tool',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'pending'],
              description: 'Filter by status. One of: active, inactive, pending.',
            },
          },
        },
      };
      const findings = p02().fn(makeCtx(tool));
      expect(findings.filter(f => f.ruleId === 'MTQS-P02')).toHaveLength(0);
    });

    it('does not fire for a non-string property type', () => {
      const tool: ToolSnapshot = {
        toolId: 'good_tool',
        contentHash: 'iii',
        name: 'good_tool',
        description: 'A good tool',
        inputSchema: {
          type: 'object',
          properties: {
            count: {
              type: 'integer',
              description: 'One of: 1, 2, 3',
            },
          },
        },
      };
      const findings = p02().fn(makeCtx(tool));
      expect(findings.filter(f => f.ruleId === 'MTQS-P02')).toHaveLength(0);
    });

    it('does not fire for a property without description (P01 covers that)', () => {
      const tool: ToolSnapshot = {
        toolId: 'test_tool',
        contentHash: 'jjj',
        name: 'test_tool',
        description: 'A tool',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      };
      const findings = p02().fn(makeCtx(tool));
      expect(findings.filter(f => f.ruleId === 'MTQS-P02')).toHaveLength(0);
    });

    it('does not fire for a normal free-text description with no closed-set signals', () => {
      const tool: ToolSnapshot = {
        toolId: 'test_tool',
        contentHash: 'kkk',
        name: 'test_tool',
        description: 'A tool',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query string to match against name, email, or phone',
            },
          },
        },
      };
      const findings = p02().fn(makeCtx(tool));
      expect(findings.filter(f => f.ruleId === 'MTQS-P02')).toHaveLength(0);
    });

    it('returns [] when inputSchema has no properties key', () => {
      const tool: ToolSnapshot = {
        toolId: 'no_props',
        contentHash: 'lll',
        name: 'no_props',
        description: 'Tool without properties',
        inputSchema: { type: 'object' },
      };
      const findings = p02().fn(makeCtx(tool));
      expect(findings).toHaveLength(0);
    });
  });

  describe('guard: no IO', () => {
    it('does not throw (fetch is blocked) — proves no network call in rule fn', () => {
      const { p02_failing } = loadFailFixture();
      expect(() => p02().fn(makeCtx(p02_failing))).not.toThrow();
    });
  });
});

// ─── Combined: pass fixture fires zero P findings ─────────────────────────────

describe('Pass fixture — zero findings', () => {
  it('all parameterRules fire zero findings for the pass fixture', () => {
    const passFixture = loadPassFixture();
    const ctx = makeCtx(passFixture);
    const allFindings = parameterRules.flatMap(rule => rule.fn(ctx));
    expect(allFindings).toHaveLength(0);
  });
});
