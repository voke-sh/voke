/**
 * ENG-04 / D-12: Byte-identical x3 determinism proof artifact.
 *
 * This test is the phase exit criterion for Phase 2. It proves that:
 * A. Running the full pipeline (ingestion → engine → report → serialize) 3 consecutive
 *    times on identical input produces byte-identical output.
 * B. Shuffling the input tool order does NOT change the serialized output
 *    (sort-on-run enforced in runner.ts and buildReport).
 * C. The serialized body excludes meta/generatedAt/capturedAt (D-02).
 *
 * In Phase 2 the default registry is empty (zero rules), so findings = [] and all
 * tool scores = 100. This is a VALID byte-identical artifact — the pipeline
 * determinism is proven even before any rules exist. Phase 3 adds rules and the
 * same test keeps them honest.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VokeSnapshot } from '../../packages/linter/src/ingestion/types.js';
import { buildReport, serializeReportBody } from '../../packages/linter/src/report/builder.js';
import { createDefaultRegistry } from '../../packages/linter/src/engine/registry.js';
import { runRules } from '../../packages/linter/src/engine/runner.js';

const FIXTURE_PATH = join(import.meta.dirname, '../fixtures/apideck-snapshot.json');

const loadFixture = (): VokeSnapshot =>
  JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as VokeSnapshot;

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

describe('ENG-04 / D-12: byte-identical x3 determinism (Apideck fixture)', () => {
  it('Test A: running the engine 3 consecutive times produces byte-identical serialized output', () => {
    const snap = loadFixture();

    const r1 = runAndSerialize(snap);
    const r2 = runAndSerialize(snap);
    const r3 = runAndSerialize(snap);

    // The phase proof artifact: three runs must be byte-identical
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it('Test B: shuffled / reversed input tool order produces identical output (sort-on-run invariance)', () => {
    const snap = loadFixture();

    // Reverse the tools array to create a deterministically different ordering
    const shuffledSnap: VokeSnapshot = {
      ...snap,
      tools: [...snap.tools].reverse(),
    };

    const originalSerialized = runAndSerialize(snap);
    const shuffledSerialized = runAndSerialize(shuffledSnap);

    // Output must be a pure function of content, not input order
    expect(shuffledSerialized).toBe(originalSerialized);
  });

  it('Test B (mid-rotation): arbitrarily rotated tool order also produces identical output', () => {
    const snap = loadFixture();

    // Rotate the array: move first N tools to the end
    const mid = Math.floor(snap.tools.length / 2);
    const rotatedSnap: VokeSnapshot = {
      ...snap,
      tools: [...snap.tools.slice(mid), ...snap.tools.slice(0, mid)],
    };

    const originalSerialized = runAndSerialize(snap);
    const rotatedSerialized = runAndSerialize(rotatedSnap);

    expect(rotatedSerialized).toBe(originalSerialized);
  });

  it('Test C: the serialized body does NOT contain generatedAt (meta excluded per D-02)', () => {
    const snap = loadFixture();
    const serialized = runAndSerialize(snap);
    expect(serialized).not.toContain('generatedAt');
  });

  it('Test C: the serialized body does NOT contain capturedAt (meta excluded per D-02)', () => {
    const snap = loadFixture();
    const serialized = runAndSerialize(snap);
    expect(serialized).not.toContain('capturedAt');
  });

  it('fixture has multiple tools (validates the test is non-trivial)', () => {
    const snap = loadFixture();
    // The Apideck fixture must have at least 2 tools for the shuffle test to be meaningful
    expect(snap.tools.length).toBeGreaterThanOrEqual(2);
  });
});
