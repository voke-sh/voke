import { describe, expect, it } from 'vitest';
import { formatHuman } from '../../packages/linter/src/cli/format-human.js';
import type { HumanFormatOpts } from '../../packages/linter/src/cli/format-human.js';
import type { LintReport, ToolReport } from '../../packages/linter/src/report/types.js';
import type { Finding } from '../../packages/linter/src/engine/types.js';

// --- Fixture helpers --------------------------------------------------------

const makeToolReport = (
  toolId: string,
  score: number,
  tier: ToolReport['tier'],
  findings: Finding[] = [],
): ToolReport => ({
  toolId,
  contentHash: 'abc123',
  findings,
  score,
  tier,
});

const makeFinding = (
  ruleId: string,
  severity: Finding['severity'],
  message: string,
  path: string[] = [],
  fixHint = 'Fix the issue.',
): Finding => ({
  ruleId,
  dimension: 'description',
  severity,
  message,
  location: { tool: 'some-tool', path },
  fixHint,
});

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
  tools: [],
  serverScore: 85,
  serverTier: 'B',
});

const opts = (overrides: Partial<HumanFormatOpts> = {}): HumanFormatOpts => ({
  color: false,
  verbose: false,
  ...overrides,
});

// ---------------------------------------------------------------------------

describe('formatHuman — score banner', () => {
  it('contains the server score line matching the expected format', () => {
    const report = baseReport();
    const output = formatHuman(report, opts());
    expect(output).toMatch(/Server score: \d+\/100\s+Tier [A-F]/);
  });

  it('banner includes the actual serverScore and serverTier', () => {
    const report = { ...baseReport(), serverScore: 85, serverTier: 'B' as const };
    const output = formatHuman(report, opts());
    expect(output).toContain('85/100');
    expect(output).toContain('Tier B');
  });

  it('score line contains no ANSI escape codes (color:false)', () => {
    const report = { ...baseReport(), serverScore: 72, serverTier: 'C' as const };
    const output = formatHuman(report, opts({ color: false }));
    // The score line must never have ANSI codes (D-03)
    const scoreLine = output.split('\n').find(line => line.includes('Server score:'))!;
    expect(scoreLine).toBeDefined();
    expect(scoreLine).not.toMatch(/\x1b\[/);
  });
});

describe('formatHuman — ANSI / color:false', () => {
  it('produces zero ANSI bytes when color:false', () => {
    const report = {
      ...baseReport(),
      tools: [makeToolReport('bad-tool', 50, 'F', [makeFinding('MTQS-D01', 'error', 'Bad desc')])],
      serverScore: 50,
      serverTier: 'F' as const,
    };
    const output = formatHuman(report, opts({ color: false, verbose: true }));
    expect(output).not.toMatch(/\x1b/);
  });
});

describe('formatHuman — dimension weight breakdown (D-01)', () => {
  it('lists schema with weight 1.5', () => {
    const output = formatHuman(baseReport(), opts());
    expect(output).toMatch(/schema.*1\.5/i);
  });

  it('lists annotations with weight 1.5', () => {
    const output = formatHuman(baseReport(), opts());
    expect(output).toMatch(/annotations.*1\.5/i);
  });

  it('lists description with weight 1.2', () => {
    const output = formatHuman(baseReport(), opts());
    expect(output).toMatch(/description.*1\.2/i);
  });

  it('lists parameters with weight 1.2', () => {
    const output = formatHuman(baseReport(), opts());
    expect(output).toMatch(/parameters.*1\.2/i);
  });

  it('lists naming with weight 1.0', () => {
    const output = formatHuman(baseReport(), opts());
    expect(output).toMatch(/naming.*1\.0/i);
  });
});

describe('formatHuman — failing-tool table (D-01)', () => {
  it('omits tier-A tools from the table', () => {
    const report = {
      ...baseReport(),
      tools: [
        makeToolReport('good-tool', 95, 'A'),
        makeToolReport('bad-tool', 55, 'F'),
      ],
      serverScore: 75,
      serverTier: 'C' as const,
    };
    const output = formatHuman(report, opts());
    expect(output).not.toContain('good-tool');
    expect(output).toContain('bad-tool');
  });

  it('includes all below-A tools when all are below A', () => {
    const report = {
      ...baseReport(),
      tools: [
        makeToolReport('tool-b', 85, 'B'),
        makeToolReport('tool-c', 75, 'C'),
        makeToolReport('tool-d', 60, 'D'),
        makeToolReport('tool-f', 50, 'F'),
      ],
      serverScore: 67,
      serverTier: 'D' as const,
    };
    const output = formatHuman(report, opts());
    expect(output).toContain('tool-b');
    expect(output).toContain('tool-c');
    expect(output).toContain('tool-d');
    expect(output).toContain('tool-f');
  });

  it('sorts below-A tools by score ascending', () => {
    const report = {
      ...baseReport(),
      tools: [
        makeToolReport('high-score', 88, 'B'),
        makeToolReport('low-score', 55, 'F'),
        makeToolReport('mid-score', 72, 'C'),
      ],
      serverScore: 71,
      serverTier: 'C' as const,
    };
    const output = formatHuman(report, opts());
    const lowPos = output.indexOf('low-score');
    const midPos = output.indexOf('mid-score');
    const highPos = output.indexOf('high-score');
    expect(lowPos).toBeLessThan(midPos);
    expect(midPos).toBeLessThan(highPos);
  });

  it('shows no tool table when all tools are tier A', () => {
    const report = {
      ...baseReport(),
      tools: [
        makeToolReport('perfect-1', 100, 'A'),
        makeToolReport('perfect-2', 95, 'A'),
      ],
      serverScore: 97,
      serverTier: 'A' as const,
    };
    const output = formatHuman(report, opts());
    expect(output).not.toContain('perfect-1');
    expect(output).not.toContain('perfect-2');
  });

  it('shows score and tier in the table for each below-A tool', () => {
    const report = {
      ...baseReport(),
      tools: [makeToolReport('weak-tool', 72, 'C')],
      serverScore: 72,
      serverTier: 'C' as const,
    };
    const output = formatHuman(report, opts());
    expect(output).toContain('weak-tool');
    expect(output).toContain('72');
    expect(output).toContain('C');
  });
});

describe('formatHuman — verbose mode (D-02)', () => {
  it('verbose:true shows finding messages for below-A tools', () => {
    const finding = makeFinding('MTQS-D01', 'error', 'Description is too short', ['description']);
    const report = {
      ...baseReport(),
      tools: [makeToolReport('flawed-tool', 70, 'C', [finding])],
      serverScore: 70,
      serverTier: 'C' as const,
    };
    const output = formatHuman(report, opts({ verbose: true }));
    expect(output).toContain('Description is too short');
  });

  it('verbose:true shows ruleId for each finding', () => {
    const finding = makeFinding('MTQS-D01', 'error', 'Too short');
    const report = {
      ...baseReport(),
      tools: [makeToolReport('flawed-tool', 70, 'C', [finding])],
      serverScore: 70,
      serverTier: 'C' as const,
    };
    const output = formatHuman(report, opts({ verbose: true }));
    expect(output).toContain('MTQS-D01');
  });

  it('verbose:true shows fixHint for each finding', () => {
    const finding = makeFinding('MTQS-D01', 'error', 'Too short', [], 'Add a better description.');
    const report = {
      ...baseReport(),
      tools: [makeToolReport('flawed-tool', 70, 'C', [finding])],
      serverScore: 70,
      serverTier: 'C' as const,
    };
    const output = formatHuman(report, opts({ verbose: true }));
    expect(output).toContain('Add a better description.');
  });

  it('verbose:false does not show finding messages', () => {
    const finding = makeFinding('MTQS-D01', 'error', 'Description is too short');
    const report = {
      ...baseReport(),
      tools: [makeToolReport('flawed-tool', 70, 'C', [finding])],
      serverScore: 70,
      serverTier: 'C' as const,
    };
    const output = formatHuman(report, opts({ verbose: false }));
    expect(output).not.toContain('Description is too short');
  });
});
