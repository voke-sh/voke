/**
 * full-surface.test.ts — end-to-end runRules + buildReport integration test.
 *
 * Proves that the default registry running over the spec §4.4 worked examples
 * reproduces the exact scores (search=38/Tier F, crm_search_contacts=100/Tier A,
 * server=69/Tier D) deterministically with network blocked.
 *
 * Test structure:
 * 1. NETWORK-BLOCK: beforeEach stubs global fetch to reject all calls
 * 2. WORKED EXAMPLES: run full registry over spec §4.4 surface; assert exact scores
 * 3. FINDING COVERAGE: assert specific rule ids fire / are silent per spec note
 * 4. DETERMINISM: two independent runs produce byte-identical JSON.stringify output
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createDefaultRegistry } from '../../packages/linter/src/engine/registry.js';
import { runRules } from '../../packages/linter/src/engine/runner.js';
import { buildReport } from '../../packages/linter/src/report/builder.js';
import type { VokeSnapshot, ToolSnapshot } from '../../packages/linter/src/ingestion/types.js';

// ────────────────────────────────────────────────────────────────────────────
// Spec §4.4 surface fixtures
// ────────────────────────────────────────────────────────────────────────────

/**
 * `search` — the poorly-designed tool from spec §4.4.
 * Fires: D02, D03, S07, S08, P01, A02, A03 (scored), A04, A05 (info, zero penalty).
 * A01 is silent because annotations:{} is present.
 */
const searchTool: ToolSnapshot = {
  toolId: 'search',
  contentHash: 'search-test-hash-placeholder',
  name: 'search',
  description: 'search',
  inputSchema: {
    type: 'object',
    properties: {
      q: {},
    },
  },
  annotations: {},
};

/**
 * `crm_search_contacts` — the well-designed tool from spec §4.4.
 * Content hash reused from the committed apideck-snapshot.json fixture.
 * All 22 rules pass. Score: 100, Tier A.
 */
const crmSearchContactsTool: ToolSnapshot = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/apideck-snapshot.json'), 'utf8'),
).tools.find((t: ToolSnapshot) => t.name === 'crm_search_contacts') as ToolSnapshot;

/**
 * Minimal VokeSnapshot wrapping the two §4.4 tools.
 */
const makeSnapshot = (tools: ToolSnapshot[]): VokeSnapshot => ({
  snapshotVersion: '1',
  mtqsVersion: '0.1',
  server: {
    url: null,
    name: 'test-server',
    version: '0.0.0',
    protocolVersion: '2025-03-26',
  },
  meta: { capturedAt: '2026-06-12T00:00:00.000Z' },
  tools,
});

const snapshot = makeSnapshot([searchTool, crmSearchContactsTool]);

// ────────────────────────────────────────────────────────────────────────────
// Network block setup
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', () =>
    Promise.reject(new Error('Network blocked in tests')),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ────────────────────────────────────────────────────────────────────────────
// Spec §4.4 worked-example scores
// ────────────────────────────────────────────────────────────────────────────

describe('spec §4.4 worked-example scores — search tool', () => {
  it('search tool scores 38 (Tier F)', () => {
    const findings = runRules(snapshot.tools, createDefaultRegistry(), {});
    const report = buildReport(snapshot, findings);
    const searchReport = report.tools.find(t => t.toolId === 'search');
    expect(searchReport).toBeDefined();
    expect(searchReport!.score).toBe(38);
    expect(searchReport!.tier).toBe('F');
  });

  it('search tool findings include D02, D03, S07, S08, P01, A02, A03', () => {
    const findings = runRules(snapshot.tools, createDefaultRegistry(), {});
    const searchFindings = findings.filter(f => f.location.tool === 'search');
    const searchRuleIds = searchFindings.map(f => f.ruleId);

    // Scored rules that must all fire
    for (const ruleId of ['MTQS-D02', 'MTQS-D03', 'MTQS-S07', 'MTQS-S08', 'MTQS-P01', 'MTQS-A02', 'MTQS-A03']) {
      expect(searchRuleIds).toContain(ruleId);
    }
  });

  it('search tool: A01 is silent (annotations: {} is present — object gate passes)', () => {
    const findings = runRules(snapshot.tools, createDefaultRegistry(), {});
    const searchFindings = findings.filter(f => f.location.tool === 'search');
    const searchRuleIds = searchFindings.map(f => f.ruleId);
    // A01 should NOT fire because annotations object is present ({})
    expect(searchRuleIds).not.toContain('MTQS-A01');
  });

  it('search tool: A04 and A05 fire as info (zero-penalty report-only findings)', () => {
    const findings = runRules(snapshot.tools, createDefaultRegistry(), {});
    const searchFindings = findings.filter(f => f.location.tool === 'search');
    const searchRuleIds = searchFindings.map(f => f.ruleId);

    // A04 fires: idempotentHint not set within annotations: {}
    expect(searchRuleIds).toContain('MTQS-A04');
    const a04 = searchFindings.find(f => f.ruleId === 'MTQS-A04');
    expect(a04?.severity).toBe('info');

    // A05 fires: openWorldHint not set within annotations: {}
    expect(searchRuleIds).toContain('MTQS-A05');
    const a05 = searchFindings.find(f => f.ruleId === 'MTQS-A05');
    expect(a05?.severity).toBe('info');
  });
});

describe('spec §4.4 worked-example scores — crm_search_contacts tool', () => {
  it('crm_search_contacts tool scores 100 (Tier A)', () => {
    const findings = runRules(snapshot.tools, createDefaultRegistry(), {});
    const report = buildReport(snapshot, findings);
    const crmReport = report.tools.find(t => t.toolId === 'crm_search_contacts');
    expect(crmReport).toBeDefined();
    expect(crmReport!.score).toBe(100);
    expect(crmReport!.tier).toBe('A');
  });

  it('crm_search_contacts tool produces no scored findings', () => {
    const findings = runRules(snapshot.tools, createDefaultRegistry(), {});
    const crmFindings = findings.filter(
      f => f.location.tool === 'crm_search_contacts' && f.severity !== 'info' && f.severity !== 'hint',
    );
    expect(crmFindings).toHaveLength(0);
  });
});

describe('spec §4.4 worked-example scores — server score', () => {
  it('server score is 69 (Tier D) for {search(38), crm_search_contacts(100)}', () => {
    const findings = runRules(snapshot.tools, createDefaultRegistry(), {});
    const report = buildReport(snapshot, findings);
    expect(report.serverScore).toBe(69);
    expect(report.serverTier).toBe('D');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Determinism: byte-identical findings across repeated and shuffled runs
// ────────────────────────────────────────────────────────────────────────────

describe('determinism — byte-identical findings across runs', () => {
  it('two sequential runs over the same surface produce byte-identical findings', () => {
    const run1 = runRules(snapshot.tools, createDefaultRegistry(), {});
    const run2 = runRules(snapshot.tools, createDefaultRegistry(), {});
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  it('a shuffled surface produces byte-identical findings (sort-on-run)', () => {
    // Provide tools in reverse order — runner must sort internally
    const shuffledTools = [...snapshot.tools].reverse();
    const shuffledSnapshot = makeSnapshot(shuffledTools);

    const run1 = runRules(snapshot.tools, createDefaultRegistry(), {});
    const run2 = runRules(shuffledSnapshot.tools, createDefaultRegistry(), {});
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  it('three sequential runs produce identical byte-fingerprints (x3 determinism)', () => {
    const run1 = JSON.stringify(runRules(snapshot.tools, createDefaultRegistry(), {}));
    const run2 = JSON.stringify(runRules(snapshot.tools, createDefaultRegistry(), {}));
    const run3 = JSON.stringify(runRules(snapshot.tools, createDefaultRegistry(), {}));
    expect(run1).toBe(run2);
    expect(run2).toBe(run3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Network-block: full registry runs without calling fetch
// ────────────────────────────────────────────────────────────────────────────

describe('network-block: full registry runs without IO (D-14)', () => {
  it('runRules does not throw when fetch is globally blocked', () => {
    // fetch stub is active from beforeEach
    expect(() => runRules(snapshot.tools, createDefaultRegistry(), {})).not.toThrow();
  });

  it('runRules produces findings without invoking the blocked fetch stub', () => {
    const blockedFetch = vi.fn(() =>
      Promise.reject(new Error('Network blocked in tests')),
    );
    vi.stubGlobal('fetch', blockedFetch);

    const findings = runRules(snapshot.tools, createDefaultRegistry(), {});

    // Rules produce findings (search tool has defects) — proved IO-free
    expect(findings.length).toBeGreaterThan(0);
    // fetch stub was never called
    expect(blockedFetch).not.toHaveBeenCalled();
  });
});
