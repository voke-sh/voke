/**
 * End-to-end tests for `voke lint --badge <path>` (Plan 07-02).
 *
 * Tests run against the BUILT binary (dist/cli/index.js) with the offline
 * Apideck fixture (serverScore=85, serverTier=B, tier fill #97ca00).
 *
 * Covers:
 *   BADGE-01: writes a valid SVG file to disk
 *   BADGE-01b: creates nested parent directories (D-08 mkdir-p)
 *   BADGE-04 e2e: tier color #97ca00 reaches disk (Tier B, Apideck fixture)
 *   BADGE-07 (D-06): stderr contains snippet; stdout does NOT
 *   BADGE-08a: stdout with --badge is valid JSON identical to stdout without --badge
 *   BADGE-08b: exit code with --badge equals exit code without --badge
 *   BADGE-06 (determinism via CLI): two consecutive --badge writes are byte-identical
 *   D-10: write failure (EISDIR) -> exit 3; stdout score still printed (lint not masked)
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  mkdtempSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeAll, describe, expect, it } from 'vitest';

const BIN = join(import.meta.dirname, '../../packages/linter/dist/cli/index.js');
const FIXTURE = join(import.meta.dirname, '../fixtures/apideck-snapshot.json');

// Guard: fail fast if the binary is not built
beforeAll(() => {
  if (!existsSync(BIN)) {
    throw new Error(
      `Built CLI binary not found at: ${BIN}\n` +
        'Build the CLI first: npm --workspace @voke-sh/voke run build',
    );
  }
});

/** Run the CLI capturing stdout, stderr, and exit status (always returns, never throws). */
const runCapture = (
  args: string[],
): { status: number; stdout: string; stderr: string } => {
  const result = spawnSync('node', [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

/** Run the CLI, return stdout, and throw on non-zero exit. */
const run = (args: string[]): string => {
  const result = runCapture(args);
  if (result.status !== 0) {
    throw new Error(
      `CLI exited ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    );
  }
  return result.stdout;
};

// ---------------------------------------------------------------------------
// BADGE-01: writes a valid SVG file to disk
// ---------------------------------------------------------------------------

describe('BADGE-01: --badge writes a valid SVG file to disk', () => {
  it('exits 0 and writes a file starting with <svg', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badgePath = join(tmpDir, 'b.svg');

    const result = runCapture(['lint', FIXTURE, '--badge', badgePath, '--ci']);
    expect(result.status).toBe(0);
    expect(existsSync(badgePath)).toBe(true);
    const content = readFileSync(badgePath, 'utf8');
    expect(content.startsWith('<svg')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BADGE-01b: mkdir-p — nested parent directories are created automatically (D-08)
// ---------------------------------------------------------------------------

describe('BADGE-01b / D-08: --badge creates nested missing parent directories', () => {
  it('succeeds when parent dirs do not exist and writes the file', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badgePath = join(tmpDir, 'nested', 'dir', 'b.svg');

    // Confirm dirs do not yet exist
    expect(existsSync(join(tmpDir, 'nested'))).toBe(false);

    const result = runCapture(['lint', FIXTURE, '--badge', badgePath, '--ci']);
    expect(result.status).toBe(0);
    expect(existsSync(badgePath)).toBe(true);
    const content = readFileSync(badgePath, 'utf8');
    expect(content.startsWith('<svg')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BADGE-04 e2e: tier color reaches disk (Apideck Tier B → fill #97ca00)
// ---------------------------------------------------------------------------

describe('BADGE-04: tier color #97ca00 (Tier B) is present in the written badge file', () => {
  it('badge file content contains the Tier-B fill hex #97ca00', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badgePath = join(tmpDir, 'tier-color.svg');

    run(['lint', FIXTURE, '--badge', badgePath, '--ci']);
    const content = readFileSync(badgePath, 'utf8');

    // Apideck fixture is Tier B (serverScore=85) — D-04 palette: B=#97ca00
    expect(content).toContain('#97ca00');
  });
});

// ---------------------------------------------------------------------------
// BADGE-07 / D-06: stderr contains snippet; stdout does NOT contain snippet
// ---------------------------------------------------------------------------

describe('BADGE-07 / D-06: snippet and confirmation go to stderr only', () => {
  it('stderr contains ![MTQS](<path>) after write', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badgePath = join(tmpDir, 'snippet.svg');

    const result = runCapture(['lint', FIXTURE, '--badge', badgePath, '--ci']);
    expect(result.status).toBe(0);

    // D-07: path used verbatim; snippet form: ![MTQS](<path>)
    expect(result.stderr).toContain(`![MTQS](${badgePath})`);
  });

  it('stderr contains "wrote <path>" confirmation', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badgePath = join(tmpDir, 'wrote-confirm.svg');

    const result = runCapture(['lint', FIXTURE, '--badge', badgePath, '--ci']);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain(`wrote ${badgePath}`);
  });

  it('stdout does NOT contain ![MTQS] (snippet is stderr-only)', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badgePath = join(tmpDir, 'stdout-purity.svg');

    const result = runCapture(['lint', FIXTURE, '--badge', badgePath, '--ci']);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('![MTQS]');
  });
});

// ---------------------------------------------------------------------------
// BADGE-08a: stdout with --badge is valid JSON identical to stdout without --badge
// ---------------------------------------------------------------------------

describe('BADGE-08a: --output json stdout is valid JSON and equals stdout without --badge', () => {
  it('stdout is valid JSON when --badge is provided', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badgePath = join(tmpDir, 'json-purity.svg');

    const withBadge = run(['lint', FIXTURE, '--output', 'json', '--badge', badgePath]);
    expect(() => JSON.parse(withBadge)).not.toThrow();
  });

  it('stdout body (meta-stripped) with --badge deepEquals stdout without --badge', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badgePath = join(tmpDir, 'json-equal.svg');

    const withBadge = run(['lint', FIXTURE, '--output', 'json', '--badge', badgePath]);
    const withoutBadge = run(['lint', FIXTURE, '--output', 'json']);

    // Strip meta (contains wall-clock generatedAt) before comparing — mirrors e2e-determinism.test.ts
    type JsonReport = Record<string, unknown>;
    const strip = (raw: string): JsonReport => {
      const parsed = JSON.parse(raw) as JsonReport;
      const { meta: _meta, ...body } = parsed;
      return body;
    };

    // Badge write goes to stderr/disk only — the non-meta body must be deepEqual
    expect(strip(withBadge)).toEqual(strip(withoutBadge));
  });
});

// ---------------------------------------------------------------------------
// BADGE-08b: exit code with --badge equals exit code without --badge
// ---------------------------------------------------------------------------

describe('BADGE-08b: exit code is identical with and without --badge', () => {
  it('--min-score that passes: exit 0 with and without --badge', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badgePath = join(tmpDir, 'exit-pass.svg');

    const withBadge = runCapture(['lint', FIXTURE, '--min-score', '0', '--ci', '--badge', badgePath]);
    const withoutBadge = runCapture(['lint', FIXTURE, '--min-score', '0', '--ci']);

    expect(withBadge.status).toBe(0);
    expect(withBadge.status).toBe(withoutBadge.status);
  });

  it('--min-score that fails: exit 1 with and without --badge', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badgePath = join(tmpDir, 'exit-fail.svg');

    const withBadge = runCapture(['lint', FIXTURE, '--min-score', '100', '--ci', '--badge', badgePath]);
    const withoutBadge = runCapture(['lint', FIXTURE, '--min-score', '100', '--ci']);

    expect(withBadge.status).toBe(1);
    expect(withBadge.status).toBe(withoutBadge.status);
  });
});

// ---------------------------------------------------------------------------
// BADGE-06: determinism — two consecutive --badge writes are byte-identical
// ---------------------------------------------------------------------------

describe('BADGE-06: determinism — two consecutive badge writes are byte-identical', () => {
  it('badge files from two runs on the same fixture are strictEqual', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const badge1Path = join(tmpDir, 'b1.svg');
    const badge2Path = join(tmpDir, 'b2.svg');

    run(['lint', FIXTURE, '--badge', badge1Path, '--ci']);
    run(['lint', FIXTURE, '--badge', badge2Path, '--ci']);

    const content1 = readFileSync(badge1Path, 'utf8');
    const content2 = readFileSync(badge2Path, 'utf8');

    // Byte-identical: toBe (strictEqual) — BADGE-06 determinism proof
    expect(content1).toBe(content2);
  });
});

// ---------------------------------------------------------------------------
// D-10: write failure → exit 3; stdout score still printed (lint not masked)
// ---------------------------------------------------------------------------

describe('D-10: write failure → exit 3, stdout score not masked', () => {
  it('exits 3 when --badge parent path is a file (EEXIST/ENOTDIR scenario)', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));

    // Create a FILE at a path that --badge will try to use as a parent directory.
    // mkdirSync(filePath, {recursive:true}) fails with EEXIST (macOS) or ENOTDIR (Linux).
    const filePath = join(tmpDir, 'f');
    writeFileSync(filePath, 'not-a-dir', 'utf8');

    // Point --badge at <filePath>/x.svg — parent (filePath) is a file, not a directory
    const badgePath = join(filePath, 'x.svg');

    const result = runCapture(['lint', FIXTURE, '--output', 'json', '--badge', badgePath, '--ci']);

    // D-10: write failure must exit 3
    expect(result.status).toBe(3);
  });

  it('stdout still contains the lint result when badge write fails (D-10: result not masked)', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'badge-e2e-'));
    const filePath = join(tmpDir, 'f');
    writeFileSync(filePath, 'not-a-dir', 'utf8');
    const badgePath = join(filePath, 'x.svg');

    const result = runCapture(['lint', FIXTURE, '--output', 'json', '--badge', badgePath, '--ci']);

    // stdout was written BEFORE writeBadge was called — lint result must be present
    expect(result.stdout.trim().length).toBeGreaterThan(0);
    // stdout should be parseable JSON with a serverScore field
    const parsed = JSON.parse(result.stdout) as { serverScore: unknown };
    expect(typeof parsed.serverScore).toBe('number');
  });
});
