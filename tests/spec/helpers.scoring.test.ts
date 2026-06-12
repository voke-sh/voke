import { describe, it, expect } from 'vitest';
import {
  penaltyFor,
  scoreTool,
  tierFor,
  applyCaps,
  serverScore,
} from '../../spec/helpers/scoring.js';
import type { Finding } from '../../spec/helpers/scoring.js';

describe('scoring helpers', () => {
  it('Test 3: single error in schema dimension yields score 77 (penalty=23, round(15*1.5)=23)', () => {
    const findings: Finding[] = [{ ruleId: 'MTQS-S01', severity: 'error', dimension: 'schema' }];
    // Base 15 * 1.5 = 22.5 -> Math.round(22.5) = 23 -> score = 100 - 23 = 77
    expect(penaltyFor('error', 'schema')).toBe(23);
    expect(scoreTool(findings)).toBe(77);
  });

  it('Test 4: round-per-finding determinism — two warning/schema findings each round to 8, total deduction 16, score 84', () => {
    // Math.round(5 * 1.5) = Math.round(7.5) = 8 per finding
    // Sum: 8 + 8 = 16 (NOT float-summing 7.5 + 7.5 = 15 -> round(15) = 15 -> score 85)
    expect(penaltyFor('warning', 'schema')).toBe(8);
    const findings: Finding[] = [
      { ruleId: 'MTQS-S07', severity: 'warning', dimension: 'schema' },
      { ruleId: 'MTQS-S08', severity: 'warning', dimension: 'schema' },
    ];
    expect(scoreTool(findings)).toBe(84);
  });

  it('Test 5: info and hint findings deduct 0 (D-02 — report only, never move score)', () => {
    const findings: Finding[] = [
      { ruleId: 'MTQS-A01', severity: 'info', dimension: 'annotations' },
      { ruleId: 'MTQS-A02', severity: 'hint', dimension: 'description' },
    ];
    expect(penaltyFor('info', 'annotations')).toBe(0);
    expect(penaltyFor('hint', 'description')).toBe(0);
    expect(scoreTool(findings)).toBe(100);
  });

  it('Test 6: tierFor returns correct tier at boundary values (D-06 cuts: A>=90, B>=80, C>=70, D>=60, F<60)', () => {
    expect(tierFor(90)).toBe('A');
    expect(tierFor(100)).toBe('A');
    expect(tierFor(89)).toBe('B');
    expect(tierFor(80)).toBe('B');
    expect(tierFor(79)).toBe('C');
    expect(tierFor(70)).toBe('C');
    expect(tierFor(69)).toBe('D');
    expect(tierFor(60)).toBe('D');
    expect(tierFor(59)).toBe('F');
    expect(tierFor(0)).toBe('F');
  });

  it('Test 7: applyCaps — S01 error caps at D (<=69); S04 error caps at C (<=79); uses min(rawScore, cap)', () => {
    // Raw score 85 (B) with S01 → capped to D territory (min(85, 69) = 69)
    expect(applyCaps(85, ['MTQS-S01'])).toBe(69);

    // Raw score 85 (B) with S04 → capped to C territory (min(85, 79) = 79)
    expect(applyCaps(85, ['MTQS-S04'])).toBe(79);

    // Raw score 50 (F) with S01 → remains 50 because min(50, 69) = 50
    expect(applyCaps(50, ['MTQS-S01'])).toBe(50);

    // No caps triggered → raw score unchanged
    expect(applyCaps(85, [])).toBe(85);
    expect(applyCaps(85, ['MTQS-D01'])).toBe(85);
  });

  it('Test 8: research worked example for "search" tool — total deduction 56, raw score 44, tier F', () => {
    // From 01-RESEARCH.md "Worked Scoring Example":
    // D03 error description 1.2x: Math.round(15 * 1.2) = Math.round(18) = 18
    // S07 warning schema 1.5x: Math.round(5 * 1.5) = Math.round(7.5) = 8
    // S08 warning schema 1.5x: Math.round(5 * 1.5) = Math.round(7.5) = 8
    // P01 warning parameters 1.2x: Math.round(5 * 1.2) = Math.round(6) = 6
    // A02 warning annotations 1.5x: Math.round(5 * 1.5) = Math.round(7.5) = 8
    // A03 warning annotations 1.5x: Math.round(5 * 1.5) = Math.round(7.5) = 8
    // Total: 18 + 8 + 8 + 6 + 8 + 8 = 56 -> score = 100 - 56 = 44

    expect(penaltyFor('error', 'description')).toBe(18);  // D03
    expect(penaltyFor('warning', 'schema')).toBe(8);      // S07, S08
    expect(penaltyFor('warning', 'parameters')).toBe(6);  // P01
    expect(penaltyFor('warning', 'annotations')).toBe(8); // A02, A03

    const searchFindings: Finding[] = [
      { ruleId: 'MTQS-D03', severity: 'error', dimension: 'description' },
      { ruleId: 'MTQS-S07', severity: 'warning', dimension: 'schema' },
      { ruleId: 'MTQS-S08', severity: 'warning', dimension: 'schema' },
      { ruleId: 'MTQS-P01', severity: 'warning', dimension: 'parameters' },
      { ruleId: 'MTQS-A02', severity: 'warning', dimension: 'annotations' },
      { ruleId: 'MTQS-A03', severity: 'warning', dimension: 'annotations' },
    ];

    const raw = scoreTool(searchFindings);
    expect(raw).toBe(44);

    // D03 cap is C (<=79): min(44, 79) = 44 — raw is already below cap
    const capped = applyCaps(raw, ['MTQS-D03']);
    expect(capped).toBe(44);

    // Tier of 44 is F
    expect(tierFor(capped)).toBe('F');
  });

  it('serverScore: mean of tool scores, rounded; empty array returns 100', () => {
    expect(serverScore([])).toBe(100);
    expect(serverScore([80, 90, 70])).toBe(Math.round((80 + 90 + 70) / 3));
    // Verify rounding: mean of [77, 84] = 80.5 -> Math.round(80.5) = 81
    expect(serverScore([77, 84])).toBe(81);
  });
});
