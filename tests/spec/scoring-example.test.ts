/**
 * scoring-example.test.ts — SPEC-02 gate
 *
 * Recomputes the worked scoring examples from spec/MTQS-v0.1.md §4.4 using
 * the deterministic scoring helpers. If these numbers ever drift from the
 * helpers' arithmetic, this test fails — keeping the published spec in sync
 * with the implementation.
 *
 * Assertions:
 *   Test 3: "search" tool findings → scoreTool=44, applyCaps=44, tierFor='F'
 *   Test 4: "crm_search_contacts" (no findings) → scoreTool=100, tierFor='A'
 *   Test 5: serverScore([44, 100]) === 72
 */
import { describe, it, expect } from 'vitest';
import {
  scoreTool,
  tierFor,
  applyCaps,
  serverScore,
} from '../../spec/helpers/scoring.js';
import type { Finding } from '../../spec/helpers/scoring.js';

describe('scoring worked example (SPEC-02)', () => {
  /**
   * The "search" tool findings from spec/MTQS-v0.1.md §4.4 "Worked Example":
   *
   * name: "search"
   * description: "search"           → MTQS-D03 error (description = name copy)
   * inputSchema.properties.q: {}    → MTQS-S08 warning (bare untyped property)
   *                                 → MTQS-P01 warning (no description on 'q')
   * no required array               → MTQS-S07 warning
   * annotations: {}
   *   readOnlyHint absent           → MTQS-A02 warning
   *   destructiveHint absent        → MTQS-A03 warning
   *
   * Per-finding arithmetic (integer-first, Math.round per finding):
   *   MTQS-D03 error   description 1.2× → Math.round(15 × 1.2) = Math.round(18.0) = 18
   *   MTQS-S07 warning schema      1.5× → Math.round(5 × 1.5)  = Math.round(7.5)  =  8
   *   MTQS-S08 warning schema      1.5× → Math.round(5 × 1.5)  = Math.round(7.5)  =  8
   *   MTQS-P01 warning parameters  1.2× → Math.round(5 × 1.2)  = Math.round(6.0)  =  6
   *   MTQS-A02 warning annotations 1.5× → Math.round(5 × 1.5)  = Math.round(7.5)  =  8
   *   MTQS-A03 warning annotations 1.5× → Math.round(5 × 1.5)  = Math.round(7.5)  =  8
   *   ─────────────────────────────────────────────────────────────────────────────────
   *   Total deduction: 18 + 8 + 8 + 6 + 8 + 8 = 56
   *   Raw score: 100 − 56 = 44
   */
  const searchFindings: Finding[] = [
    { ruleId: 'MTQS-D03', severity: 'error', dimension: 'description' },
    { ruleId: 'MTQS-S07', severity: 'warning', dimension: 'schema' },
    { ruleId: 'MTQS-S08', severity: 'warning', dimension: 'schema' },
    { ruleId: 'MTQS-P01', severity: 'warning', dimension: 'parameters' },
    { ruleId: 'MTQS-A02', severity: 'warning', dimension: 'annotations' },
    { ruleId: 'MTQS-A03', severity: 'warning', dimension: 'annotations' },
  ];

  const searchRuleIds = searchFindings.map((f) => f.ruleId);

  it('Test 3: "search" tool — scoreTool=44, applyCaps=44 (D03 cap C=79 does not bind), tierFor=F', () => {
    const raw = scoreTool(searchFindings);
    expect(raw).toBe(44);

    // D03 triggers cap C (≤79): min(44, 79) = 44 — already below cap, cap does not bind
    const capped = applyCaps(raw, searchRuleIds);
    expect(capped).toBe(44);

    expect(tierFor(capped)).toBe('F');
  });

  it('Test 4: "crm_search_contacts" tool with no findings — scoreTool=100, tierFor=A', () => {
    const perfectFindings: Finding[] = [];
    const raw = scoreTool(perfectFindings);
    expect(raw).toBe(100);

    const capped = applyCaps(raw, []);
    expect(capped).toBe(100);

    expect(tierFor(capped)).toBe('A');
  });

  it('Test 5: serverScore([44, 100]) — mean of two tool scores rounds to 72', () => {
    // (44 + 100) / 2 = 72.0 → Math.round(72.0) = 72
    expect(serverScore([44, 100])).toBe(72);
  });
});
