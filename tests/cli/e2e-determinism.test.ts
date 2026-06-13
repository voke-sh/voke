/**
 * E2E byte-identical x3 determinism proof (SC#2 / D-02 / D-03).
 *
 * Proves that running the BUILT CLI binary 3 consecutive times on the same offline
 * fixture produces byte-identical human output — and that the human path does NOT
 * inject timestamps, ANSI codes, or wall-clock values (format-human.ts determinism).
 *
 * Also proves that the JSON output bodies are deepEqual after stripping the .meta
 * block (which may differ only in meta.generatedAt per D-10).
 *
 * This test depends on the Plan 02 build artifact (dist/cli/index.js). If the binary
 * does not exist, the test fails with an actionable build instruction.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeAll } from 'vitest';

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

/** Run the CLI with the given args and return stdout as a string. NO_COLOR is always set. */
const run = (args: string[]): string =>
  execFileSync('node', [BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });

describe('SC#2: byte-identical x3 CLI determinism (Apideck fixture, offline)', () => {
  it('human output is byte-identical across 3 consecutive runs', () => {
    const out1 = run(['lint', FIXTURE, '--ci']);
    const out2 = run(['lint', FIXTURE, '--ci']);
    const out3 = run(['lint', FIXTURE, '--ci']);

    // The SC#2 proof: three runs must produce the exact same bytes
    expect(out1).toBe(out2);
    expect(out2).toBe(out3);
  });

  it('human output contains no ANSI escape sequences (NO_COLOR + --ci both enforced)', () => {
    const out = run(['lint', FIXTURE, '--ci']);
    // eslint-disable-next-line no-control-regex
    expect(out).not.toMatch(/\x1b\[/);
    expect(out).not.toContain('\x1b');
  });

  it('human output does not leak any ISO-8601 timestamp (D-02: generatedAt/capturedAt excluded from human path)', () => {
    const out = run(['lint', FIXTURE, '--ci']);
    // The human formatter must not emit any wall-clock timestamp (generatedAt is JSON-only / meta)
    expect(out).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it('JSON output bodies are deepEqual across 3 runs after stripping .meta (only meta.generatedAt may differ)', () => {
    const raw1 = run(['lint', FIXTURE, '--output', 'json']);
    const raw2 = run(['lint', FIXTURE, '--output', 'json']);
    const raw3 = run(['lint', FIXTURE, '--output', 'json']);

    // Parse and strip .meta (contains generatedAt which is wall-clock by design D-10)
    type JsonReport = Record<string, unknown>;
    const strip = (raw: string): JsonReport => {
      const parsed = JSON.parse(raw) as JsonReport;
      const { meta: _meta, ...body } = parsed;
      return body;
    };

    const body1 = strip(raw1);
    const body2 = strip(raw2);
    const body3 = strip(raw3);

    // The meta-stripped bodies must be deepEqual (same structure, same scores, same findings)
    expect(body1).toEqual(body2);
    expect(body2).toEqual(body3);
  });

  it('JSON output .meta.generatedAt is present and IS an ISO-8601 timestamp (D-10)', () => {
    const raw = run(['lint', FIXTURE, '--output', 'json']);
    const parsed = JSON.parse(raw) as { meta?: { generatedAt?: string } };
    expect(parsed.meta?.generatedAt).toBeDefined();
    expect(parsed.meta?.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
