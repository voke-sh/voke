/**
 * Tests for runLint orchestrator (CLI-01, CLI-03 file mode, SCORE-01 wiring).
 *
 * All tests run offline against tests/fixtures/apideck-snapshot.json.
 * No network calls; readSnapshot path is used for all test cases.
 */
import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import { describe, expect, it, afterEach } from 'vitest';
import { runLint } from '../../packages/linter/src/cli/run-lint.js';

const FIXTURE_PATH = join(import.meta.dirname, '../fixtures/apideck-snapshot.json');
const TMP_SNAPSHOT = '/tmp/voke-test-snapshot.json';

afterEach(() => {
  // Clean up temp files
  if (existsSync(TMP_SNAPSHOT)) {
    unlinkSync(TMP_SNAPSHOT);
  }
});

describe('runLint — offline fixture (file mode)', () => {
  it('returns 6 tools from the Apideck fixture', async () => {
    const result = await runLint({
      target: FIXTURE_PATH,
      output: 'human',
      headers: [],
      timeout: 30_000,
      verbose: false,
      color: false,
    });
    expect(result.report.tools.length).toBe(6);
  });

  it('text contains "Server score:" banner', async () => {
    const result = await runLint({
      target: FIXTURE_PATH,
      output: 'human',
      headers: [],
      timeout: 30_000,
      verbose: false,
      color: false,
    });
    expect(result.text).toContain('Server score:');
  });

  it('exitCode is 0 with no minScore set', async () => {
    const result = await runLint({
      target: FIXTURE_PATH,
      output: 'human',
      headers: [],
      timeout: 30_000,
      verbose: false,
      color: false,
    });
    expect(result.exitCode).toBe(0);
  });

  it('exitCode is 0 when minScore is at-or-below the server score', async () => {
    // First run to get the actual score
    const baseline = await runLint({
      target: FIXTURE_PATH,
      output: 'human',
      headers: [],
      timeout: 30_000,
      verbose: false,
      color: false,
    });
    const serverScore = baseline.report.serverScore;

    const result = await runLint({
      target: FIXTURE_PATH,
      output: 'human',
      headers: [],
      timeout: 30_000,
      minScore: serverScore,
      verbose: false,
      color: false,
    });
    expect(result.exitCode).toBe(0);
  });

  it('exitCode is 1 when minScore is above the server score', async () => {
    const result = await runLint({
      target: FIXTURE_PATH,
      output: 'human',
      headers: [],
      timeout: 30_000,
      minScore: 100, // Apideck fixture score < 100
      verbose: false,
      color: false,
    });
    expect(result.exitCode).toBe(1);
  });

  it('output json returns text that JSON.parses with matching serverScore', async () => {
    const result = await runLint({
      target: FIXTURE_PATH,
      output: 'json',
      headers: [],
      timeout: 30_000,
      verbose: false,
      color: false,
    });
    const parsed = JSON.parse(result.text) as { serverScore: number };
    expect(parsed.serverScore).toBe(result.report.serverScore);
  });

  it('saveSnapshot writes a file with snapshotVersion 1 and no serverScore', async () => {
    await runLint({
      target: FIXTURE_PATH,
      output: 'human',
      headers: [],
      timeout: 30_000,
      verbose: false,
      color: false,
      saveSnapshot: TMP_SNAPSHOT,
    });

    expect(existsSync(TMP_SNAPSHOT)).toBe(true);

    const { readFileSync } = await import('node:fs');
    const written = JSON.parse(readFileSync(TMP_SNAPSHOT, 'utf8')) as Record<string, unknown>;
    expect(written['snapshotVersion']).toBe('1');
    expect(written).not.toHaveProperty('serverScore');
    // VokeSnapshot has tools[] with toolId (not a LintReport)
    expect(Array.isArray(written['tools'])).toBe(true);
  });

  it('saveSnapshot still produces the LintReport (two distinct artifacts)', async () => {
    const result = await runLint({
      target: FIXTURE_PATH,
      output: 'human',
      headers: [],
      timeout: 30_000,
      verbose: false,
      color: false,
      saveSnapshot: TMP_SNAPSHOT,
    });

    // LintReport must still be produced
    expect(result.report.tools.length).toBe(6);
    expect(result.text).toContain('Server score:');
  });

  it('timeout is threaded (option exists in opts without error)', async () => {
    // Tests that timeout is accepted without error — live tests are covered separately
    const result = await runLint({
      target: FIXTURE_PATH,
      output: 'human',
      headers: [],
      timeout: 5_000,
      verbose: false,
      color: false,
    });
    expect(result.report.tools.length).toBe(6);
  });
});
