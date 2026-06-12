import type { Severity, DimensionId } from '../registry-types.js';

/**
 * Deterministic scoring helpers for MTQS v0.1.
 * Implements the integer-first arithmetic from 01-RESEARCH.md "Integer-First Arithmetic Rules".
 *
 * Key invariant: Math.round(basePenalty * multiplier) is computed PER FINDING, then
 * summed as integers — no floating-point accumulation.
 */

export type { Severity, DimensionId };

export interface Finding {
  ruleId: string;
  severity: Severity;
  dimension: DimensionId;
}

// Base penalties (integers): error=15, warning=5, info=0, hint=0 (D-02: info/hint are report-only)
export const BASE: Record<Severity, number> = {
  error: 15,
  warning: 5,
  info: 0,
  hint: 0,
};

// Dimension multipliers (D-08, D-09 weight tiers):
// T1 (highest): schema, annotations = 1.5x (correctness floor + safety-critical)
// T2: description, parameters = 1.2x (Anthropic guidance, Opaque Parameters 84.3%)
// T3: naming = 1.0x (spec compliance floor)
export const MULT: Record<DimensionId, number> = {
  schema: 1.5,
  annotations: 1.5,
  description: 1.2,
  parameters: 1.2,
  naming: 1.0,
};

/**
 * Compute the rounded penalty for a single finding.
 * Uses Math.round PER FINDING (not float-summing first) to ensure determinism.
 * Math.round(7.5) = 8 in JavaScript (rounds to even is NOT used by JS Math.round).
 */
export const penaltyFor = (severity: Severity, dimension: DimensionId): number =>
  Math.round(BASE[severity] * MULT[dimension]);

/**
 * Compute the deterministic score for a tool given its findings.
 * Score = max(0, 100 - sum(penaltyFor(finding) for each finding)).
 * Each penalty is rounded before summing — no float accumulation.
 */
export const scoreTool = (findings: Finding[]): number => {
  const totalPenalty = findings.reduce(
    (sum, finding) => sum + penaltyFor(finding.severity, finding.dimension),
    0,
  );
  return Math.max(0, 100 - totalPenalty);
};

/**
 * Assign A–F tier based on score using fixed D-06 cuts.
 * A >= 90, B >= 80, C >= 70, D >= 60, F < 60.
 * Cuts are fixed — calibration happens via weights/penalties, not by moving cuts.
 */
export const tierFor = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

// Hard tier caps from D-03 (from research "Hard Tier Caps" table):
// S01 → cap D (69): tool is unusable — no schema means agents cannot know what args to send
// S03 → cap D (69): a schema that fails validation is structurally broken
// S06 → cap D (69): a schema that fails validation is structurally broken
// S04 → cap C (79): external $ref is a spec violation AND a runtime hazard
// A06 → cap C (79): dangerous misclassification; tool may cause unintended side effects
// D03 → cap C (79): no genuine description; agent cannot understand what the tool does
const CAPS: Record<string, number> = {
  'MTQS-S01': 69,
  'MTQS-S03': 69,
  'MTQS-S06': 69,
  'MTQS-S04': 79,
  'MTQS-A06': 79,
  'MTQS-D03': 79,
};

/**
 * Apply hard tier caps to a raw tool score.
 * Caps are post-computation overrides: min(rawScore, lowestApplicableCap).
 * NEVER modeled as additional point deductions (Pitfall 3 guard).
 * Returns rawScore unchanged if no cap is triggered.
 */
export const applyCaps = (rawScore: number, ruleIds: string[]): number => {
  let lowestCap = Infinity;
  for (const id of ruleIds) {
    const cap = CAPS[id];
    if (cap !== undefined && cap < lowestCap) {
      lowestCap = cap;
    }
  }
  return lowestCap === Infinity ? rawScore : Math.min(rawScore, lowestCap);
};

/**
 * Compute the server score as the arithmetic mean of per-tool (capped) scores.
 * Round once at the server level (D-07).
 * Returns 100 for an empty tool list.
 */
export const serverScore = (toolScores: number[]): number => {
  if (toolScores.length === 0) return 100;
  return Math.round(toolScores.reduce((sum, s) => sum + s, 0) / toolScores.length);
};
