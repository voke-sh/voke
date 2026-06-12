/**
 * Tests for the offline snapshot reader (ING-03) and fixture validation (ING-05).
 *
 * Verifies:
 * - readSnapshot reads the Plan 01 Apideck fixture with zero network calls
 * - readSnapshot rejects malformed snapshots with a Zod error
 * - hasExternalRef returns true for external-ref-tool fixture (fetch stubbed)
 * - schemaDepth returns > DEPTH_HARD_CAP for deep-schema-tool fixture
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { readSnapshot } from '../../packages/linter/src/ingestion/snapshot-reader.js';
import { hasExternalRef, schemaDepth, DEPTH_HARD_CAP } from '../../packages/linter/src/ingestion/schema-checks.js';

// Fixture paths (resolve from repo root)
const APIDECK_FIXTURE = resolve('tests/fixtures/apideck-snapshot.json');
const EXTERNAL_REF_FIXTURE = resolve('tests/fixtures/external-ref-tool.json');
const DEEP_SCHEMA_FIXTURE = resolve('tests/fixtures/deep-schema-tool.json');

// Block network in all tests (ING-03 offline guarantee)
beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('network blocked in tests — reader must not make network calls');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// readSnapshot — offline reading of Apideck fixture
// ---------------------------------------------------------------------------
describe('readSnapshot — offline Apideck fixture', () => {
  it('returns a VokeSnapshot with tools.length >= 6 (no network call)', () => {
    // fetch is stubbed to throw — if reader called fetch, this would throw
    const snapshot = readSnapshot(APIDECK_FIXTURE);
    expect(snapshot.tools.length).toBeGreaterThanOrEqual(6);
  });

  it('returns snapshotVersion "1"', () => {
    const snapshot = readSnapshot(APIDECK_FIXTURE);
    expect(snapshot.snapshotVersion).toBe('1');
  });

  it('tools are already sorted by toolId (asserting committed sort order)', () => {
    const snapshot = readSnapshot(APIDECK_FIXTURE);
    const ids = snapshot.tools.map(t => t.toolId);
    // Verify sorted ascending
    for (let i = 1; i < ids.length; i++) {
      expect(
        ids[i - 1].localeCompare(ids[i], 'en', { sensitivity: 'variant' }),
      ).toBeLessThanOrEqual(0);
    }
  });

  it('each tool has toolId, name, inputSchema, and contentHash', () => {
    const snapshot = readSnapshot(APIDECK_FIXTURE);
    for (const tool of snapshot.tools) {
      expect(tool.toolId).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('does not require network (fetch stubbed to throw, reader still works)', () => {
    // fetch is stubbed to throw "network blocked" — reader must NOT call fetch
    expect(() => readSnapshot(APIDECK_FIXTURE)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// readSnapshot — rejects malformed snapshots
// ---------------------------------------------------------------------------
describe('readSnapshot — Zod validation', () => {
  it('throws for a snapshot with wrong server field type', () => {
    const tmpPath = resolve('tests/fixtures/tmp-malformed.json');
    writeFileSync(
      tmpPath,
      JSON.stringify({ snapshotVersion: '1', server: 'not-an-object', tools: 'not-an-array' }),
    );
    try {
      expect(() => readSnapshot(tmpPath)).toThrow();
    } finally {
      unlinkSync(tmpPath);
    }
  });

  it('throws for a snapshot with missing required fields on a tool', () => {
    const tmpPath = resolve('tests/fixtures/tmp-malformed2.json');
    writeFileSync(
      tmpPath,
      JSON.stringify({
        snapshotVersion: '1',
        mtqsVersion: '0.1',
        server: { url: null, name: 's', version: '1', protocolVersion: 'p' },
        meta: { capturedAt: '2026-01-01T00:00:00.000Z' },
        tools: [
          {
            // Missing toolId, contentHash, inputSchema
            name: 'incomplete_tool',
          },
        ],
      }),
    );
    try {
      expect(() => readSnapshot(tmpPath)).toThrow();
    } finally {
      unlinkSync(tmpPath);
    }
  });

  it('throws for a completely unrecognized object shape', () => {
    const tmpPath = resolve('tests/fixtures/tmp-malformed3.json');
    writeFileSync(tmpPath, JSON.stringify({ completely: 'wrong' }));
    try {
      expect(() => readSnapshot(tmpPath)).toThrow();
    } finally {
      unlinkSync(tmpPath);
    }
  });
});

// ---------------------------------------------------------------------------
// ING-05 fixture validation: external-ref-tool
// ---------------------------------------------------------------------------
describe('ING-05 fixtures — external-ref-tool', () => {
  it('external-ref-tool fixture parses as JSON', () => {
    const raw = readFileSync(EXTERNAL_REF_FIXTURE, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('hasExternalRef returns true for external-ref-tool inputSchema (fetch blocked)', () => {
    const fixture = JSON.parse(readFileSync(EXTERNAL_REF_FIXTURE, 'utf8')) as {
      inputSchema: unknown;
    };
    // fetch is stubbed to throw — this proves no fetch call is made
    expect(hasExternalRef(fixture.inputSchema)).toBe(true);
  });

  it('external-ref-tool $ref contains "https://"', () => {
    const raw = readFileSync(EXTERNAL_REF_FIXTURE, 'utf8');
    expect(raw).toContain('https://');
  });
});

// ---------------------------------------------------------------------------
// ING-05 fixtures — deep-schema-tool
// ---------------------------------------------------------------------------
describe('ING-05 fixtures — deep-schema-tool', () => {
  it('deep-schema-tool fixture parses as valid JSON', () => {
    const raw = readFileSync(DEEP_SCHEMA_FIXTURE, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('schemaDepth of deep-schema-tool inputSchema exceeds DEPTH_HARD_CAP', () => {
    const fixture = JSON.parse(readFileSync(DEEP_SCHEMA_FIXTURE, 'utf8')) as {
      inputSchema: unknown;
    };
    const depth = schemaDepth(fixture.inputSchema);
    expect(depth).toBeGreaterThan(DEPTH_HARD_CAP);
  });
});
