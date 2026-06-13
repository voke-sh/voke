/**
 * E2E acceptance tests for Phase 4 success criteria SC#1/#3/#4/#5.
 *
 * SC#1: Human report shows per-rule findings (verbose), per-tool scores, server score, A-F tier.
 * SC#3: --output json emits a parseable LintReport with the expected shape.
 * SC#4: --min-score flips the exit code at the server-score boundary.
 * SC#5: --version prints "voke X.Y.Z (MTQS v0.1)"; bearer tokens are masked in all output.
 *
 * All tests run against the offline Apideck fixture (no live network in CI).
 * Known fixture values: serverScore=85, serverTier=B, 6 tools.
 */
import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const BIN = join(import.meta.dirname, '../../packages/linter/dist/cli/index.js');
const FIXTURE = join(import.meta.dirname, '../fixtures/apideck-snapshot.json');

// Guard: fail fast if the binary is not built (Plan 02 build artifact required)
beforeAll(() => {
  if (!existsSync(BIN)) {
    throw new Error(
      `Built CLI binary not found at: ${BIN}\n` +
        'Build the CLI first: npm --workspace @voke/linter run build',
    );
  }
});

const EXEC_OPTS: ExecFileSyncOptionsWithStringEncoding = {
  encoding: 'utf8',
  env: { ...process.env, NO_COLOR: '1' },
};

/** Run the CLI with the given args and return stdout. Throws on non-zero exit. */
const run = (args: string[]): string => execFileSync('node', [BIN, ...args], EXEC_OPTS);

/** Run the CLI and capture the thrown error (for non-zero exit assertions). */
const runCapture = (args: string[]): { status: number; stdout: string; stderr: string } => {
  try {
    const stdout = execFileSync('node', [BIN, ...args], EXEC_OPTS);
    return { status: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    // execFileSync throws SpawnSyncReturns on non-zero exit
    const e = err as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      status: e.status ?? 1,
      stdout: typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString() ?? ''),
      stderr: typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString() ?? ''),
    };
  }
};

// ---------------------------------------------------------------------------
// SC#5: --version
// ---------------------------------------------------------------------------

describe('SC#5: --version prints the MTQS-versioned string', () => {
  it('matches /^voke \\d+\\.\\d+\\.\\d+ \\(MTQS v0\\.1\\)/', () => {
    const out = run(['--version']);
    // Commander prints version followed by a newline; match the full line
    expect(out.trim()).toMatch(/^voke \d+\.\d+\.\d+ \(MTQS v0\.1\)$/);
  });

  it('output contains "MTQS v0.1"', () => {
    const out = run(['--version']);
    expect(out).toContain('MTQS v0.1');
  });
});

// ---------------------------------------------------------------------------
// SC#1: Human report shape (with --verbose for per-rule findings)
// ---------------------------------------------------------------------------

describe('SC#1: human report shape (verbose) — server score, tier, per-tool, per-rule', () => {
  it('stdout contains a server score line matching /Server score: \\d+\\/100  Tier [A-F]/', () => {
    const out = run(['lint', FIXTURE, '--ci', '--verbose']);
    expect(out).toMatch(/Server score: \d+\/100  Tier [A-F]/);
  });

  it('stdout contains at least one below-A tool row with numeric score and tier', () => {
    const out = run(['lint', FIXTURE, '--ci', '--verbose']);
    // Row format: "toolId  score  tier  count" (e.g. "search  38  F  9")
    expect(out).toMatch(/\S+\s+\d+\s+[A-F]\s+\d+/);
  });

  it('verbose output contains at least one per-rule finding with a MTQS rule ID', () => {
    const out = run(['lint', FIXTURE, '--ci', '--verbose']);
    // Per-finding line format: "  severity MTQS-X##  at path: message"
    expect(out).toMatch(/MTQS-[SDNPA]\d{2}/);
  });

  it('verbose output contains severity labels (warning/error/info)', () => {
    const out = run(['lint', FIXTURE, '--ci', '--verbose']);
    expect(out).toMatch(/warning|error|info/);
  });
});

// ---------------------------------------------------------------------------
// SC#3: JSON LintReport shape
// ---------------------------------------------------------------------------

describe('SC#3: --output json emits a parseable LintReport with expected shape', () => {
  it('output is valid JSON', () => {
    const raw = run(['lint', FIXTURE, '--output', 'json']);
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('parsed report has serverScore (number) and serverTier (A-F)', () => {
    const raw = run(['lint', FIXTURE, '--output', 'json']);
    const report = JSON.parse(raw) as Record<string, unknown>;
    expect(typeof report['serverScore']).toBe('number');
    expect(report['serverTier']).toMatch(/^[A-F]$/);
  });

  it('parsed report.tools is an array of length 6', () => {
    const raw = run(['lint', FIXTURE, '--output', 'json']);
    const report = JSON.parse(raw) as { tools: unknown[] };
    expect(Array.isArray(report.tools)).toBe(true);
    expect(report.tools.length).toBe(6);
  });

  it('parsed report.mtqsVersion === "0.1"', () => {
    const raw = run(['lint', FIXTURE, '--output', 'json']);
    const report = JSON.parse(raw) as { mtqsVersion: string };
    expect(report.mtqsVersion).toBe('0.1');
  });

  it('each tool has score (number), tier (A-F), and findings (array)', () => {
    const raw = run(['lint', FIXTURE, '--output', 'json']);
    const report = JSON.parse(raw) as {
      tools: Array<{ score: unknown; tier: unknown; findings: unknown }>;
    };
    for (const tool of report.tools) {
      expect(typeof tool.score).toBe('number');
      expect(tool.tier).toMatch(/^[A-F]$/);
      expect(Array.isArray(tool.findings)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// SC#4: --min-score gate (exit code 1 above threshold, exit code 0 at/below)
// ---------------------------------------------------------------------------

describe('SC#4: --min-score gate flips exit code at the server-score boundary', () => {
  it('--min-score {serverScore+1} exits with code 1 (score below threshold)', () => {
    // Read serverScore from the JSON run to keep the test robust against fixture changes
    const raw = run(['lint', FIXTURE, '--output', 'json']);
    const report = JSON.parse(raw) as { serverScore: number };
    const tooHigh = report.serverScore + 1;

    const result = runCapture(['lint', FIXTURE, '--min-score', String(tooHigh), '--ci']);
    expect(result.status).toBe(1);
  });

  it('--min-score {serverScore} exits with code 0 (score equals threshold)', () => {
    const raw = run(['lint', FIXTURE, '--output', 'json']);
    const report = JSON.parse(raw) as { serverScore: number };
    const okThreshold = report.serverScore;

    const result = runCapture(['lint', FIXTURE, '--min-score', String(okThreshold), '--ci']);
    expect(result.status).toBe(0);
  });

  it('--min-score 0 exits with code 0', () => {
    const result = runCapture(['lint', FIXTURE, '--min-score', '0', '--ci']);
    expect(result.status).toBe(0);
  });

  it('--min-score 100 exits with code 1 (fixture score is 85)', () => {
    const result = runCapture(['lint', FIXTURE, '--min-score', '100', '--ci']);
    expect(result.status).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SC#5: Token masking
// ---------------------------------------------------------------------------

describe('SC#5: bearer tokens are masked in all output paths', () => {
  it('PRIMARY masking test: schemeless host error path does not leak the token', () => {
    // localhost:3000/mcp (no scheme) triggers D-06 UsageError (exit 3) before any network.
    // This is the non-trivial masking guard: the error path has the header in scope.
    const result = runCapture([
      'lint',
      'localhost:3000/mcp',
      '-H',
      'Authorization: Bearer SUPERSECRETTOKEN',
      '--ci',
    ]);

    // D-06 UsageError -> exit code 3
    expect(result.status).toBe(3);

    // The combined output must NOT contain the raw token value
    const combined = result.stdout + result.stderr;
    expect(combined).not.toContain('SUPERSECRETTOKEN');

    // The error message should show the schemeless target hint (token is not in this message)
    expect(combined).toContain('localhost:3000/mcp');
  });

  it('SECONDARY masking test (file target, regression guard): output never contains the token', () => {
    // Note: a file target never echoes headers, so this is weaker than the PRIMARY test.
    // Kept as a regression guard to catch accidental header leaks in future diagnostic output.
    const result = runCapture([
      'lint',
      FIXTURE,
      '-H',
      'Authorization: Bearer SUPERSECRETTOKEN',
      '--ci',
    ]);

    // File target should succeed
    expect(result.status).toBe(0);

    // Combined stdout+stderr must not contain the token
    const combined = result.stdout + result.stderr;
    expect(combined).not.toContain('SUPERSECRETTOKEN');
  });
});
