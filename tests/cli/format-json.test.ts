import { describe, expect, it } from 'vitest';
import { formatJson } from '../../packages/linter/src/cli/format-json.js';
import type { LintReport } from '../../packages/linter/src/report/types.js';

const baseReport = (): LintReport => ({
  vokeVersion: '0.0.0',
  mtqsVersion: '0.1',
  meta: { generatedAt: '2026-06-12T10:00:00.000Z' },
  server: {
    url: 'https://example.com/mcp',
    name: 'example-server',
    version: '1.0.0',
    protocolVersion: '2025-03-26',
  },
  snapshotContentHash: 'deadbeef'.repeat(8),
  tools: [
    {
      toolId: 'get-users',
      contentHash: 'abc123',
      findings: [],
      score: 100,
      tier: 'A',
    },
    {
      toolId: 'delete-record',
      contentHash: 'def456',
      findings: [],
      score: 75,
      tier: 'C',
    },
  ],
  serverScore: 87,
  serverTier: 'B',
});

describe('formatJson', () => {
  it('returns a non-empty string', () => {
    const output = formatJson(baseReport());
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('returns parseable JSON', () => {
    const output = formatJson(baseReport());
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('round-trips serverScore correctly', () => {
    const report = baseReport();
    const parsed = JSON.parse(formatJson(report)) as LintReport;
    expect(parsed.serverScore).toBe(report.serverScore);
  });

  it('round-trips tools.length correctly', () => {
    const report = baseReport();
    const parsed = JSON.parse(formatJson(report)) as LintReport;
    expect(parsed.tools.length).toBe(report.tools.length);
  });

  it('round-trips serverTier correctly', () => {
    const report = baseReport();
    const parsed = JSON.parse(formatJson(report)) as LintReport;
    expect(parsed.serverTier).toBe(report.serverTier);
  });

  it('includes meta.generatedAt in the output (D-10 full consumption doc)', () => {
    const report = baseReport();
    const output = formatJson(report);
    expect(output).toContain('generatedAt');
    expect(output).toContain('2026-06-12T10:00:00.000Z');
  });

  it('is byte-identical when called twice on the same report object', () => {
    const report = baseReport();
    expect(formatJson(report)).toBe(formatJson(report));
  });

  it('produces the same output on identical separate report objects', () => {
    expect(formatJson(baseReport())).toBe(formatJson(baseReport()));
  });

  it('includes vokeVersion and mtqsVersion', () => {
    const output = formatJson(baseReport());
    const parsed = JSON.parse(output) as LintReport;
    expect(parsed.vokeVersion).toBe('0.0.0');
    expect(parsed.mtqsVersion).toBe('0.1');
  });

  it('includes all tool IDs', () => {
    const output = formatJson(baseReport());
    expect(output).toContain('get-users');
    expect(output).toContain('delete-record');
  });

  it('keys are sorted (canonicalJson property)', () => {
    const report = baseReport();
    const output = formatJson(report);
    // Check that "meta" sorts before "mtqsVersion" (m-e before m-t)
    const metaPos = output.indexOf('"meta"');
    const mtqsPos = output.indexOf('"mtqsVersion"');
    expect(metaPos).toBeLessThan(mtqsPos);
  });
});
