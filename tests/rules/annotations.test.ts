import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { loadRegistryFile } from '@voke/core';
import { annotationRules } from '../../packages/linter/src/rules/annotations.js';
import type { RuleContext } from '../../packages/linter/src/engine/types.js';
import type { ToolSnapshot } from '../../packages/linter/src/ingestion/types.js';
import type { VokeConfig } from '../../packages/linter/src/config/types.js';

// ────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────

const FIXTURES_DIR = resolve(process.cwd(), 'tests/fixtures/rules');

const passFixture: ToolSnapshot = JSON.parse(
  readFileSync(resolve(FIXTURES_DIR, 'annotations-pass.json'), 'utf-8'),
) as ToolSnapshot;

const failFixtures = JSON.parse(
  readFileSync(resolve(FIXTURES_DIR, 'annotations-fail.json'), 'utf-8'),
) as { noAnnotations: ToolSnapshot; emptyAnnotations: ToolSnapshot };

const contradictionFixture: ToolSnapshot = JSON.parse(
  readFileSync(resolve(FIXTURES_DIR, 'annotations-contradiction.json'), 'utf-8'),
) as ToolSnapshot;

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

const emptyConfig: VokeConfig = {};

const makeCtx = (tool: ToolSnapshot): RuleContext => ({
  tool,
  surface: [tool],
  config: emptyConfig,
});

const findRule = (id: string) => {
  const rule = annotationRules.find(r => r.id === id);
  if (!rule) throw new Error(`Rule ${id} not found in annotationRules`);
  return rule;
};

const runRule = (id: string, tool: ToolSnapshot) => findRule(id).fn(makeCtx(tool));

// ────────────────────────────────────────────────────────────────────
// Network-block setup (D-14)
// ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('Network blocked in tests')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ────────────────────────────────────────────────────────────────────
// Meta: length and structure
// ────────────────────────────────────────────────────────────────────

describe('annotationRules metadata', () => {
  it('has exactly 6 rules', () => {
    expect(annotationRules).toHaveLength(6);
  });

  it('all rules have dimension "annotations"', () => {
    for (const rule of annotationRules) {
      expect(rule.dimension).toBe('annotations');
    }
  });

  it('all rules have target "tool"', () => {
    for (const rule of annotationRules) {
      expect(rule.target).toBe('tool');
    }
  });

  it('all rules have mtqsVersion "0.1"', () => {
    for (const rule of annotationRules) {
      expect(rule.mtqsVersion).toBe('0.1');
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// Spec cross-check: severities and fixHints match spec/mtqs-v0.1.yaml
// ────────────────────────────────────────────────────────────────────

describe('spec cross-check (severities and fixHints against mtqs-v0.1.yaml)', () => {
  const REGISTRY_PATH = resolve(process.cwd(), 'spec/mtqs-v0.1.yaml');
  const specEntries = loadRegistryFile(REGISTRY_PATH);

  for (const rule of annotationRules) {
    it(`${rule.id} severity and fixHint match spec`, () => {
      const specEntry = specEntries.find(e => e.id === rule.id);
      expect(specEntry, `${rule.id} not found in spec`).toBeDefined();
      expect(rule.defaultSeverity).toBe(specEntry!.severity);
      expect(rule.fixHint.trim()).toBe(specEntry!.fixHint.trim());
    });
  }
});

// ────────────────────────────────────────────────────────────────────
// MTQS-A01: Annotations Presence
// ────────────────────────────────────────────────────────────────────

describe('MTQS-A01 (info): annotations presence', () => {
  it('fires when annotations is absent (no annotations key)', () => {
    const findings = runRule('MTQS-A01', failFixtures.noAnnotations);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-A01');
    expect(findings[0].severity).toBe('info');
  });

  it('does NOT fire when annotations is present as empty object {}', () => {
    const findings = runRule('MTQS-A01', failFixtures.emptyAnnotations);
    expect(findings).toHaveLength(0);
  });

  it('does NOT fire when annotations has all four hints set', () => {
    const findings = runRule('MTQS-A01', passFixture);
    expect(findings).toHaveLength(0);
  });

  it('finding has correct dimension, location path, and message', () => {
    const [finding] = runRule('MTQS-A01', failFixtures.noAnnotations);
    expect(finding.dimension).toBe('annotations');
    expect(finding.location.tool).toBe(failFixtures.noAnnotations.toolId);
    expect(finding.location.path).toEqual(['annotations']);
    expect(finding.message).toContain('MTQS-A01');
    expect(finding.message).toContain('[info]');
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-A02: readOnlyHint Presence
// ────────────────────────────────────────────────────────────────────

describe('MTQS-A02 (warning): readOnlyHint presence', () => {
  it('fires when annotations is present but readOnlyHint is absent', () => {
    const findings = runRule('MTQS-A02', failFixtures.emptyAnnotations);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-A02');
    expect(findings[0].severity).toBe('warning');
  });

  it('does NOT fire when annotations is absent (A01 covers that)', () => {
    const findings = runRule('MTQS-A02', failFixtures.noAnnotations);
    expect(findings).toHaveLength(0);
  });

  it('does NOT fire when readOnlyHint is explicitly set to true', () => {
    const findings = runRule('MTQS-A02', passFixture);
    expect(findings).toHaveLength(0);
  });

  it('does NOT fire when readOnlyHint is explicitly set to false', () => {
    const tool: ToolSnapshot = {
      ...failFixtures.emptyAnnotations,
      annotations: { readOnlyHint: false },
    };
    const findings = runRule('MTQS-A02', tool);
    expect(findings).toHaveLength(0);
  });

  it('finding has correct location path', () => {
    const [finding] = runRule('MTQS-A02', failFixtures.emptyAnnotations);
    expect(finding.location.path).toEqual(['annotations', 'readOnlyHint']);
    expect(finding.message).toContain('MTQS-A02');
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-A03: destructiveHint Presence
// ────────────────────────────────────────────────────────────────────

describe('MTQS-A03 (warning): destructiveHint presence', () => {
  it('fires when annotations is present but destructiveHint is absent', () => {
    const findings = runRule('MTQS-A03', failFixtures.emptyAnnotations);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-A03');
    expect(findings[0].severity).toBe('warning');
  });

  it('does NOT fire when annotations is absent', () => {
    const findings = runRule('MTQS-A03', failFixtures.noAnnotations);
    expect(findings).toHaveLength(0);
  });

  it('does NOT fire when destructiveHint is explicitly set', () => {
    const findings = runRule('MTQS-A03', passFixture);
    expect(findings).toHaveLength(0);
  });

  it('finding has correct location path', () => {
    const [finding] = runRule('MTQS-A03', failFixtures.emptyAnnotations);
    expect(finding.location.path).toEqual(['annotations', 'destructiveHint']);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-A04: idempotentHint Presence
// ────────────────────────────────────────────────────────────────────

describe('MTQS-A04 (info): idempotentHint presence', () => {
  it('fires when annotations is present but idempotentHint is absent', () => {
    const findings = runRule('MTQS-A04', failFixtures.emptyAnnotations);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-A04');
    expect(findings[0].severity).toBe('info');
  });

  it('does NOT fire when annotations is absent', () => {
    const findings = runRule('MTQS-A04', failFixtures.noAnnotations);
    expect(findings).toHaveLength(0);
  });

  it('does NOT fire when idempotentHint is explicitly set', () => {
    const findings = runRule('MTQS-A04', passFixture);
    expect(findings).toHaveLength(0);
  });

  it('finding has correct location path', () => {
    const [finding] = runRule('MTQS-A04', failFixtures.emptyAnnotations);
    expect(finding.location.path).toEqual(['annotations', 'idempotentHint']);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-A05: openWorldHint Presence
// ────────────────────────────────────────────────────────────────────

describe('MTQS-A05 (info): openWorldHint presence', () => {
  it('fires when annotations is present but openWorldHint is absent', () => {
    const findings = runRule('MTQS-A05', failFixtures.emptyAnnotations);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-A05');
    expect(findings[0].severity).toBe('info');
  });

  it('does NOT fire when annotations is absent', () => {
    const findings = runRule('MTQS-A05', failFixtures.noAnnotations);
    expect(findings).toHaveLength(0);
  });

  it('does NOT fire when openWorldHint is explicitly set', () => {
    const findings = runRule('MTQS-A05', passFixture);
    expect(findings).toHaveLength(0);
  });

  it('finding has correct location path', () => {
    const [finding] = runRule('MTQS-A05', failFixtures.emptyAnnotations);
    expect(finding.location.path).toEqual(['annotations', 'openWorldHint']);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-A06: Read-Only + Destructive Contradiction
// ────────────────────────────────────────────────────────────────────

describe('MTQS-A06 (error): readOnly + destructive contradiction', () => {
  it('fires when readOnlyHint:true AND destructiveHint:true', () => {
    const findings = runRule('MTQS-A06', contradictionFixture);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-A06');
    expect(findings[0].severity).toBe('error');
  });

  it('does NOT fire for well-designed tool (readOnlyHint:true, destructiveHint:false)', () => {
    const findings = runRule('MTQS-A06', passFixture);
    expect(findings).toHaveLength(0);
  });

  it('does NOT fire for write tool (readOnlyHint:false, destructiveHint:true)', () => {
    const writeTool: ToolSnapshot = {
      ...failFixtures.emptyAnnotations,
      annotations: { readOnlyHint: false, destructiveHint: true },
    };
    const findings = runRule('MTQS-A06', writeTool);
    expect(findings).toHaveLength(0);
  });

  it('does NOT fire when annotations is absent', () => {
    const findings = runRule('MTQS-A06', failFixtures.noAnnotations);
    expect(findings).toHaveLength(0);
  });

  it('does NOT fire when only readOnlyHint is true (destructiveHint absent)', () => {
    const tool: ToolSnapshot = {
      ...failFixtures.emptyAnnotations,
      annotations: { readOnlyHint: true },
    };
    const findings = runRule('MTQS-A06', tool);
    expect(findings).toHaveLength(0);
  });

  it('finding has location path ["annotations","destructiveHint"]', () => {
    const [finding] = runRule('MTQS-A06', contradictionFixture);
    expect(finding.location.path).toEqual(['annotations', 'destructiveHint']);
    expect(finding.location.tool).toBe(contradictionFixture.toolId);
  });

  it('finding message contains "MTQS-A06" and "[error]"', () => {
    const [finding] = runRule('MTQS-A06', contradictionFixture);
    expect(finding.message).toContain('MTQS-A06');
    expect(finding.message).toContain('[error]');
  });
});

// ────────────────────────────────────────────────────────────────────
// annotations:{} worked example (spec §4.4)
// ────────────────────────────────────────────────────────────────────

describe('annotations:{} worked example (spec §4.4)', () => {
  it('A01 stays silent for a tool with annotations: {}', () => {
    const findings = runRule('MTQS-A01', failFixtures.emptyAnnotations);
    expect(findings).toHaveLength(0);
  });

  it('A02 and A03 fire (warning) for a tool with annotations: {}', () => {
    const a02 = runRule('MTQS-A02', failFixtures.emptyAnnotations);
    const a03 = runRule('MTQS-A03', failFixtures.emptyAnnotations);
    expect(a02).toHaveLength(1);
    expect(a02[0].severity).toBe('warning');
    expect(a03).toHaveLength(1);
    expect(a03[0].severity).toBe('warning');
  });

  it('A04 and A05 fire (info) for a tool with annotations: {}', () => {
    const a04 = runRule('MTQS-A04', failFixtures.emptyAnnotations);
    const a05 = runRule('MTQS-A05', failFixtures.emptyAnnotations);
    expect(a04).toHaveLength(1);
    expect(a04[0].severity).toBe('info');
    expect(a05).toHaveLength(1);
    expect(a05[0].severity).toBe('info');
  });
});

// ────────────────────────────────────────────────────────────────────
// Network-block purity: all rules run without throwing when fetch is blocked
// ────────────────────────────────────────────────────────────────────

describe('network-block purity (D-14)', () => {
  const allFixtures: ToolSnapshot[] = [
    passFixture,
    failFixtures.noAnnotations,
    failFixtures.emptyAnnotations,
    contradictionFixture,
  ];

  it('all rules complete without throwing when network is blocked', () => {
    for (const tool of allFixtures) {
      for (const rule of annotationRules) {
        expect(() => rule.fn(makeCtx(tool))).not.toThrow();
      }
    }
  });
});
