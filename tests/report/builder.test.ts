import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { VokeSnapshot } from '../../packages/linter/src/ingestion/types.js';
import { buildReport, serializeReportBody } from '../../packages/linter/src/report/builder.js';

const FIXTURE_PATH = join(import.meta.dirname, '../fixtures/apideck-snapshot.json');

const loadFixture = (): VokeSnapshot =>
  JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as VokeSnapshot;

describe('buildReport', () => {
  it('produces a LintReport with correct structure from the Apideck fixture + empty findings', () => {
    const snapshot = loadFixture();
    const report = buildReport(snapshot, []);

    // Top-level shape
    expect(report.vokeVersion).toBe('0.0.0');
    expect(report.mtqsVersion).toBe('0.1');
    expect(report.server).toEqual(snapshot.server);

    // meta block is present and contains generatedAt
    expect(report.meta).toBeDefined();
    expect(typeof report.meta.generatedAt).toBe('string');
    // generatedAt is a valid ISO date string
    expect(() => new Date(report.meta.generatedAt)).not.toThrow();

    // snapshotContentHash is present and non-empty
    expect(typeof report.snapshotContentHash).toBe('string');
    expect(report.snapshotContentHash.length).toBe(64); // SHA-256 hex = 64 chars

    // tools array: one entry per snapshot tool
    expect(report.tools.length).toBe(snapshot.tools.length);

    // Each tool report has correct shape
    for (const toolReport of report.tools) {
      expect(typeof toolReport.toolId).toBe('string');
      expect(typeof toolReport.contentHash).toBe('string');
      expect(Array.isArray(toolReport.findings)).toBe(true);
      expect(typeof toolReport.score).toBe('number');
      expect(['A', 'B', 'C', 'D', 'F']).toContain(toolReport.tier);
    }

    // With no findings all tools score 100 (tier A)
    for (const toolReport of report.tools) {
      expect(toolReport.score).toBe(100);
      expect(toolReport.tier).toBe('A');
    }

    // serverScore and serverTier are present
    expect(typeof report.serverScore).toBe('number');
    expect(['A', 'B', 'C', 'D', 'F']).toContain(report.serverTier);
  });

  it('uses @voke/core scoring — no findings means score 100 and tier A', () => {
    const snapshot = loadFixture();
    const report = buildReport(snapshot, []);

    expect(report.serverScore).toBe(100);
    expect(report.serverTier).toBe('A');
  });

  it('accepts custom vokeVersion via opts', () => {
    const snapshot = loadFixture();
    const report = buildReport(snapshot, [], { vokeVersion: '1.2.3' });
    expect(report.vokeVersion).toBe('1.2.3');
  });

  it('tools are in the same order as snapshot.tools (toolId-sorted)', () => {
    const snapshot = loadFixture();
    const report = buildReport(snapshot, []);
    const reportToolIds = report.tools.map(t => t.toolId);
    const snapshotToolIds = snapshot.tools.map(t => t.toolId);
    expect(reportToolIds).toEqual(snapshotToolIds);
  });
});

describe('serializeReportBody', () => {
  it('returns a non-empty string', () => {
    const snapshot = loadFixture();
    const report = buildReport(snapshot, []);
    const body = serializeReportBody(report);
    expect(typeof body).toBe('string');
    expect(body.length).toBeGreaterThan(0);
  });

  it('excludes generatedAt from the serialized body (D-02)', () => {
    const snapshot = loadFixture();
    const report = buildReport(snapshot, []);
    const body = serializeReportBody(report);
    expect(body).not.toContain('generatedAt');
  });

  it('excludes capturedAt from the serialized body (D-02)', () => {
    const snapshot = loadFixture();
    const report = buildReport(snapshot, []);
    const body = serializeReportBody(report);
    expect(body).not.toContain('capturedAt');
  });

  it('excludes the meta key entirely from the serialized body', () => {
    const snapshot = loadFixture();
    const report = buildReport(snapshot, []);
    const body = serializeReportBody(report);
    // The key "meta" should not appear at the top level of the body
    const parsed = JSON.parse(body) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('meta');
  });

  it('produces valid JSON that parses correctly', () => {
    const snapshot = loadFixture();
    const report = buildReport(snapshot, []);
    const body = serializeReportBody(report);
    expect(() => JSON.parse(body)).not.toThrow();
  });

  it('contains snapshotContentHash in the serialized body', () => {
    const snapshot = loadFixture();
    const report = buildReport(snapshot, []);
    const body = serializeReportBody(report);
    expect(body).toContain(report.snapshotContentHash);
  });
});
