/**
 * PUB-04: Byte-identical x3 determinism proof for both live captured server fixtures.
 *
 * This is the reproducible DoD gate for Phase 6 launch:
 * - Criterion 1: voke lint on committed Apideck live fixture is byte-identical across 3 runs
 * - Criterion 2: voke lint on committed DeepWiki fixture is byte-identical across 3 runs
 *                AND produces a valid score + tier (proves second server scores correctly)
 *
 * These tests gate the COMMITTED snapshots (not live network calls) — D-02/D-03:
 * the committed snapshot is the reproducibility gate; live runs are for blog screenshots.
 *
 * Mirrors the pattern of tests/engine/determinism.test.ts exactly.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VokeSnapshot } from '../../packages/linter/src/ingestion/types.js';
import { buildReport, serializeReportBody } from '../../packages/linter/src/report/builder.js';
import { createDefaultRegistry } from '../../packages/linter/src/engine/registry.js';
import { runRules } from '../../packages/linter/src/engine/runner.js';

/**
 * runAndSerialize — the full pipeline for a single run.
 * Creates a fresh registry instance per call (test isolation).
 */
const runAndSerialize = (snapshot: VokeSnapshot): string => {
  const registry = createDefaultRegistry();
  const findings = runRules(snapshot.tools, registry, {});
  const report = buildReport(snapshot, findings);
  return serializeReportBody(report);
};

const load = (name: string): VokeSnapshot =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../fixtures/${name}`), 'utf-8')) as VokeSnapshot;

describe.each([
  ['apideck-live-snapshot.json'],
  ['deepwiki-snapshot.json'],
])('PUB-04 launch determinism: %s', (fixture) => {
  it('Test A: byte-identical across 3 runs', () => {
    const snap = load(fixture);
    const r1 = runAndSerialize(snap);
    const r2 = runAndSerialize(snap);
    const r3 = runAndSerialize(snap);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it('Test B: reversed tool order produces identical output (sort-on-run invariance)', () => {
    const snap = load(fixture);
    const reversedSnap: VokeSnapshot = {
      ...snap,
      tools: [...snap.tools].reverse(),
    };
    const original = runAndSerialize(snap);
    const reversed = runAndSerialize(reversedSnap);
    expect(reversed).toBe(original);
  });

  it('Test C: serialized body does not contain generatedAt (meta excluded per D-02)', () => {
    const snap = load(fixture);
    const serialized = runAndSerialize(snap);
    expect(serialized).not.toContain('generatedAt');
  });

  it('Test C: serialized body does not contain capturedAt (meta excluded per D-02)', () => {
    const snap = load(fixture);
    const serialized = runAndSerialize(snap);
    expect(serialized).not.toContain('capturedAt');
  });

  it('fixture has multiple tools (validates shuffle test is non-trivial)', () => {
    const snap = load(fixture);
    expect(snap.tools.length).toBeGreaterThanOrEqual(2);
  });
});

describe('PUB-04: DeepWiki produces a valid score + tier (DoD criterion 2)', () => {
  it('serverScore is in range 0-100 and serverTier is a valid tier', () => {
    const snap = load('deepwiki-snapshot.json');
    const registry = createDefaultRegistry();
    const findings = runRules(snap.tools, registry, {});
    const report = buildReport(snap, findings, { vokeVersion: 'test' });
    expect(report.serverScore).toBeGreaterThanOrEqual(0);
    expect(report.serverScore).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(report.serverTier);
  });
});
