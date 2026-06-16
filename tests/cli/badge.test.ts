/**
 * Unit tests for formatBadge — covers BADGE-02 through BADGE-06.
 *
 * Wave 0 scaffold: these tests are written BEFORE the implementation exists (TDD RED step).
 * All assertions run against the pure formatBadge(report: LintReport): string function.
 *
 * Coverage:
 *   BADGE-02  — SVG is self-contained: no style= attribute, no external URLs, no href, no <image>
 *   BADGE-03  — SVG contains correct label text (MTQS) and value text (grade score)
 *   BADGE-03b — SVG width attribute matches verified geometry for all grade/score classes
 *   BADGE-04  — Value rect fill color matches tier from TIER_COLORS map
 *   BADGE-04b — Label rect is always gray (#555)
 *   BADGE-05  — No tier re-derivation logic in badge (read report.serverTier directly)
 *   BADGE-06  — Two calls with the same report return strictly equal strings
 *   BADGE-06b — Deterministic across all 5 tiers
 */

import { describe, it, expect } from 'vitest';
import type { LintReport, Tier } from '../../packages/linter/src/report/types.js';
import { formatBadge } from '../../packages/linter/src/cli/badge.js';

// ---------------------------------------------------------------------------
// Helper: minimal LintReport literal — only serverScore + serverTier matter
// ---------------------------------------------------------------------------

const mkReport = (serverScore: number, serverTier: Tier): LintReport => ({
  vokeVersion: '0.0.0',
  mtqsVersion: '0.1',
  meta: { generatedAt: '2026-01-01T00:00:00.000Z' },
  server: { url: null, name: 'x', version: '0', protocolVersion: '2026-07-28' },
  snapshotContentHash: 'x',
  tools: [],
  serverScore,
  serverTier,
});

// ---------------------------------------------------------------------------
// BADGE-03: Label text and value text
// ---------------------------------------------------------------------------

describe('BADGE-03: badge contains correct label and value text', () => {
  it('contains >MTQS< for the label segment', () => {
    const svg = formatBadge(mkReport(85, 'B'));
    expect(svg).toContain('>MTQS<');
  });

  it('contains >B 85< for score=85 tier=B', () => {
    const svg = formatBadge(mkReport(85, 'B'));
    expect(svg).toContain('>B 85<');
  });

  it('contains >A 100< for score=100 tier=A', () => {
    const svg = formatBadge(mkReport(100, 'A'));
    expect(svg).toContain('>A 100<');
  });

  it('contains >D 65< for score=65 tier=D', () => {
    const svg = formatBadge(mkReport(65, 'D'));
    expect(svg).toContain('>D 65<');
  });

  it('contains >F 5< for score=5 tier=F', () => {
    const svg = formatBadge(mkReport(5, 'F'));
    expect(svg).toContain('>F 5<');
  });
});

// ---------------------------------------------------------------------------
// BADGE-03b: SVG width attribute — verified geometry from RESEARCH.md
// ---------------------------------------------------------------------------

describe('BADGE-03b: SVG root width attribute matches verified geometry', () => {
  it('B 85 produces width="78"', () => {
    const svg = formatBadge(mkReport(85, 'B'));
    expect(svg).toContain('width="78"');
  });

  it('A 100 produces width="86"', () => {
    const svg = formatBadge(mkReport(100, 'A'));
    expect(svg).toContain('width="86"');
  });

  it('D 65 produces width="80"', () => {
    const svg = formatBadge(mkReport(65, 'D'));
    expect(svg).toContain('width="80"');
  });

  it('F 5 produces width="70"', () => {
    const svg = formatBadge(mkReport(5, 'F'));
    expect(svg).toContain('width="70"');
  });

  it('A 92 produces width="78"', () => {
    const svg = formatBadge(mkReport(92, 'A'));
    expect(svg).toContain('width="78"');
  });

  it('F 42 produces width="78"', () => {
    const svg = formatBadge(mkReport(42, 'F'));
    expect(svg).toContain('width="78"');
  });

  it('C 75 produces width="78"', () => {
    const svg = formatBadge(mkReport(75, 'C'));
    expect(svg).toContain('width="78"');
  });
});

// ---------------------------------------------------------------------------
// BADGE-04: Value segment fill color matches tier
// ---------------------------------------------------------------------------

describe('BADGE-04: value rect fill matches tier color', () => {
  it('tier A produces fill="#4c1"', () => {
    const svg = formatBadge(mkReport(92, 'A'));
    expect(svg).toContain('fill="#4c1"');
  });

  it('tier B produces fill="#97ca00"', () => {
    const svg = formatBadge(mkReport(85, 'B'));
    expect(svg).toContain('fill="#97ca00"');
  });

  it('tier C produces fill="#dfb317"', () => {
    const svg = formatBadge(mkReport(75, 'C'));
    expect(svg).toContain('fill="#dfb317"');
  });

  it('tier D produces fill="#fe7d37"', () => {
    const svg = formatBadge(mkReport(65, 'D'));
    expect(svg).toContain('fill="#fe7d37"');
  });

  it('tier F produces fill="#e05d44"', () => {
    const svg = formatBadge(mkReport(42, 'F'));
    expect(svg).toContain('fill="#e05d44"');
  });
});

// ---------------------------------------------------------------------------
// BADGE-04b: Label segment is always gray (#555)
// ---------------------------------------------------------------------------

describe('BADGE-04b: label rect is always gray #555', () => {
  it('contains fill="#555" for tier A', () => {
    const svg = formatBadge(mkReport(92, 'A'));
    expect(svg).toContain('fill="#555"');
  });

  it('contains fill="#555" for tier F', () => {
    const svg = formatBadge(mkReport(42, 'F'));
    expect(svg).toContain('fill="#555"');
  });
});

// ---------------------------------------------------------------------------
// BADGE-02: Self-contained — no style= attribute, no external refs
// ---------------------------------------------------------------------------

describe('BADGE-02: SVG is self-contained with no external references', () => {
  it('does NOT contain "style=" (no inline style attribute)', () => {
    const svg = formatBadge(mkReport(85, 'B'));
    expect(svg).not.toContain('style=');
  });

  it('does NOT contain "http" (no external URL)', () => {
    const svg = formatBadge(mkReport(85, 'B'));
    expect(svg).not.toContain('http');
  });

  it('does NOT contain "href" (no external link)', () => {
    const svg = formatBadge(mkReport(85, 'B'));
    expect(svg).not.toContain('href');
  });

  it('does NOT contain "<image" (no external image)', () => {
    const svg = formatBadge(mkReport(85, 'B'));
    expect(svg).not.toContain('<image');
  });
});

// ---------------------------------------------------------------------------
// BADGE-06: Determinism — two calls with the same report return strictly equal strings
// ---------------------------------------------------------------------------

describe('BADGE-06: formatBadge is deterministic', () => {
  it('two calls with the same report return strictly equal strings', () => {
    const r = mkReport(85, 'B');
    expect(formatBadge(r)).toBe(formatBadge(r));
  });

  it('is deterministic across all 5 tiers (BADGE-06b)', () => {
    const cases: Array<[number, Tier]> = [
      [92, 'A'],
      [85, 'B'],
      [75, 'C'],
      [65, 'D'],
      [42, 'F'],
    ];
    for (const [score, tier] of cases) {
      const r = mkReport(score, tier);
      expect(formatBadge(r)).toBe(formatBadge(r));
    }
  });
});
