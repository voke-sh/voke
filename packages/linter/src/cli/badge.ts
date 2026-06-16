/**
 * formatBadge — pure, deterministic SVG generator for the MTQS score badge.
 *
 * Produces a shields.io-style flat 2-segment badge:
 *   Left segment: gray (#555) label "MTQS"
 *   Right segment: tier-colored value "{grade} {score}"
 *
 * Design constraints (BADGE-02..06):
 *   - Zero external references: no inline styles, no external links, no image elements
 *   - Color sourced only from report.serverTier via TIER_COLORS (BADGE-05)
 *   - No score comparison / tier-derivation logic (BADGE-05)
 *   - No Date, Math.random, or locale formatting — pure function (BADGE-06)
 *   - Same input always produces byte-identical output (BADGE-06)
 */

import type { LintReport, Tier } from '../report/types.js';

// ---------------------------------------------------------------------------
// Tier → hex color map (BADGE-04/05)
// Exactly 5 keys matching the Tier union: A | B | C | D | F
// Source: shields.io standard palette (D-04 locked decision)
// ---------------------------------------------------------------------------

export const TIER_COLORS: Record<Tier, string> = {
  A: '#4c1',
  B: '#97ca00',
  C: '#dfb317',
  D: '#fe7d37',
  F: '#e05d44',
};

// ---------------------------------------------------------------------------
// Verdana 11px normal advance-width table
// Source: anafanafo/packages/anafanafo/data/verdana-11px-normal.json
// Only the characters that appear in badge text are included:
//   "MTQS" (label) + A/B/C/D/F (grade) + " " (space) + 0-9 (score digits)
// ---------------------------------------------------------------------------

const VERDANA_11: Record<string, number> = {
  ' ': 3.87,
  '0': 6.99, '1': 6.99, '2': 6.99, '3': 6.99, '4': 6.99,
  '5': 6.99, '6': 6.99, '7': 6.99, '8': 6.99, '9': 6.99,
  'A': 7.52, 'B': 7.54, 'C': 7.68, 'D': 8.48, 'F': 6.32,
  'M': 9.27, 'Q': 8.66, 'S': 7.52, 'T': 6.78,
};

const HORIZ_PADDING = 5;
const FONT_SCALE = 10; // draw coordinates are 10x, then scaled down with transform="scale(.1)"

// ---------------------------------------------------------------------------
// Width helpers
// ---------------------------------------------------------------------------

/**
 * Compute the text width for a string using the Verdana 11px advance-width table.
 * Applies roundUpToOdd (Pitfall 2 guard) to match shields.io geometry exactly.
 * Falls back to 7 for any character not in the table.
 */
const textWidth = (s: string): number => {
  const raw = [...s].reduce((sum, ch) => sum + (VERDANA_11[ch] ?? 7), 0);
  const floored = Math.floor(raw);
  // roundUpToOdd: shields.io applies this to maximize pixel grid alignment
  return floored % 2 === 0 ? floored + 1 : floored;
};

/**
 * Segment rect width = textWidth + left padding + right padding.
 */
const segmentWidth = (text: string): number => textWidth(text) + 2 * HORIZ_PADDING;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic, self-contained SVG badge string for the given lint report.
 *
 * Pure function: output depends only on report.serverScore, report.serverTier,
 * and compile-time constants. No IO, no Date, no Math.random.
 *
 * @param report - The LintReport from buildReport; badge reads serverScore + serverTier only.
 * @returns A single-line SVG string with no external references.
 */
export const formatBadge = (report: LintReport): string => {
  const valueText = `${report.serverTier} ${report.serverScore}`;

  // Geometry — fixed for label, variable for value
  const labelTextW = textWidth('MTQS'); // always 33 (M+T+Q+S = 32.23 -> 33)
  const labelW = segmentWidth('MTQS'); // always 43 (33 + 2*5)
  const valueTextW = textWidth(valueText);
  const valueW = segmentWidth(valueText);
  const totalW = labelW + valueW;

  // Text center X in 10x coordinate space (before scale(.1) transform)
  // Formula from shields.io: labelMargin = 1 (logo-offset with no logo)
  const messageMargin = labelW - 1; // 42
  const labelCenterX = FONT_SCALE * (1 + HORIZ_PADDING + labelTextW / 2); // 225 for MTQS
  const valueCenterX = FONT_SCALE * (messageMargin + HORIZ_PADDING + valueTextW / 2);

  // Tier color — read directly from report.serverTier (BADGE-05: single source of truth)
  const tierColor = TIER_COLORS[report.serverTier];

  // SVG assembled as a single-line string:
  // - All visual properties use SVG presentation attributes (BADGE-02: no inline style attributes)
  // - Internal url(#id) references only (no external links or image elements)
  // - Gradient + clipPath for shields.io flat aesthetics
  // - Shadow text via fill-opacity=".3" (no <filter> blur — cicirello flat pattern)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="MTQS: ${valueText}"><title>MTQS: ${valueText}</title><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="${totalW}" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="${labelW}" height="20" fill="#555"/><rect x="${labelW}" width="${valueW}" height="20" fill="${tierColor}"/><rect width="${totalW}" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110"><g transform="scale(.1)"><text aria-hidden="true" x="${labelCenterX}" y="150" fill="#010101" fill-opacity=".3" textLength="${FONT_SCALE * labelTextW}">MTQS</text><text x="${labelCenterX}" y="140" textLength="${FONT_SCALE * labelTextW}">MTQS</text></g><g transform="scale(.1)"><text aria-hidden="true" x="${valueCenterX}" y="150" fill="#010101" fill-opacity=".3" textLength="${FONT_SCALE * valueTextW}">${valueText}</text><text x="${valueCenterX}" y="140" textLength="${FONT_SCALE * valueTextW}">${valueText}</text></g></g></svg>`;
};
