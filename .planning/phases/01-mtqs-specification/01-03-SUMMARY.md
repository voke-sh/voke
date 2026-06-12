---
phase: 01-mtqs-specification
plan: 03
subsystem: spec
tags: [mtqs, specification, scoring, rules, linter, typescript, vitest]

# Dependency graph
requires:
  - phase: 01-mtqs-specification
    provides: "spec/mtqs-v0.1.yaml registry (Plan 02) — rule IDs, severities, weights, fixHints used for doc-sync test"
  - phase: 01-mtqs-specification
    provides: "spec/helpers/ (Plan 01) — parseSpecDoc, loadRegistry, scoring helpers used by both tests"
provides:
  - "spec/MTQS-v0.1.md — 1267-line MTQS v0.1 specification: 8 sections, 22 anchored rule rubrics, full scoring formula with worked example"
  - "tests/spec/doc-registry-sync.test.ts — bidirectional doc↔registry anchor sync test (SPEC-01)"
  - "tests/spec/scoring-example.test.ts — worked-example arithmetic test (SPEC-02)"
affects:
  - "Phase 02 (rule engine) — consumes the scoring formula and rule structure from this spec"
  - "Phase 03 (CLI) — publishes the MTQS version declared here"
  - "Phase 04 (fixture run) — validates calibration against real Apideck server using tiers from this spec"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Integer-first arithmetic: Math.round per finding then sum integers (no float accumulation)"
    - "Hard tier caps as min(rawScore, capValue) post-computation overrides, not deductions"
    - "Doc↔registry bidirectional sync test pattern using parseSpecDoc + loadRegistryFile"
    - "SPEC-02 gate: test encodes exact worked-example numbers; drift from spec fails test"

key-files:
  created:
    - spec/MTQS-v0.1.md
    - tests/spec/doc-registry-sync.test.ts
    - tests/spec/scoring-example.test.ts
  modified: []

key-decisions:
  - "22 rules in MTQS v0.1 (not 20) — plan had arithmetic error; all 22 IDs explicitly enumerated are correct"
  - "D02 and D03 fire independently — no rule-suppression logic in MTQS; each rule fires on its own condition"
  - "search worked example corrected post human review: D02 added (deduction 62, raw 38, server 69/Tier D)"

patterns-established:
  - "Per-rule rubric template: heading with {#MTQS-XXX} anchor, property table, what/why/passing/failing/message/hint"
  - "Scoring contract test: encode exact findings array + assert chain (scoreTool → applyCaps → tierFor → serverScore)"

requirements-completed: [SPEC-01, SPEC-02]

# Metrics
duration: 60min
completed: 2026-06-12
---

# Phase 01 Plan 03: MTQS v0.1 Specification Document Summary

**MTQS v0.1 specification published: 1267-line RFC/WCAG-toned document with 22 anchored rule rubrics, integer-first scoring formula, and deterministic worked example gated by passing tests**

## Performance

- **Duration:** ~60 min (split across two executor runs: initial + checkpoint continuation)
- **Started:** 2026-06-12T12:00:00Z
- **Completed:** 2026-06-12T14:29:59Z
- **Tasks:** 3 (2 auto + 1 checkpoint resolved)
- **Files modified:** 3

## Accomplishments

- Authored `spec/MTQS-v0.1.md` — 8-section specification (Abstract → Motivation → Dimensions → 22 rule rubrics → Scoring Formula → Tiers → Versioning → References). Each rubric has primary-source citation, passing/failing example, and verbatim fix hint from the registry.
- Added `tests/spec/doc-registry-sync.test.ts` — bidirectional doc↔registry anchor test that catches orphan IDs in either direction and asserts passing+failing example presence for all 22 rules.
- Added `tests/spec/scoring-example.test.ts` — SPEC-02 contract test encoding the exact worked-example findings array and asserting the full scoring chain (scoreTool → applyCaps → tierFor → serverScore).
- Applied human-review D02 correction: added missing MTQS-D02 finding to the `search` worked example, correcting deduction (56→62), raw score (44→38), and server score (72 Tier C → 69 Tier D).

## Task Commits

1. **Task 1: Write MTQS v0.1 spec document** — `66787cc` (feat)
2. **Task 2: doc↔registry sync test + worked-example arithmetic test** — `1870b9d` (feat)
3. **Task 3 (checkpoint resolution): D02 fix** — `1af7538` (fix)

## Files Created/Modified

- `spec/MTQS-v0.1.md` — Full MTQS v0.1 specification: 22 rule rubrics with anchors, scoring tables, worked example (search/F, crm_search_contacts/A), tiers, versioning, references
- `tests/spec/doc-registry-sync.test.ts` — Bidirectional anchor sync + example-presence test for all 22 rules
- `tests/spec/scoring-example.test.ts` — SPEC-02 arithmetic gate: asserts search→38/F, crm_search_contacts→100/A, serverScore([38,100])→69

## Decisions Made

- **22 rules, not 20:** The plan's task description said "20 rules" but the explicit rule ID enumeration lists 22 (S01-S08=8, D01-D03=3, N01-N03=3, P01-P02=2, A01-A06=6). The enumerated IDs are authoritative.
- **D02 and D03 are independent:** MTQS has no rule-suppression logic — every applicable rule fires. D02 fires when description < 20 chars; D03 fires when description equals the name byte-for-byte. Both fire for `description: "search"` (6 chars, equals name).

## Deviations from Plan

### Human-Review Correction (Checkpoint Resolution)

**D02 missing from `search` worked example — detected by human reviewer**
- **Found during:** Task 3 (checkpoint:human-verify read-through)
- **Issue:** The `search` tool has `description: "search"` (6 chars < 20), so MTQS-D02 (warning, description, 1.2×) fires alongside D03. It was absent from the findings table.
- **Fix:**
  - Added MTQS-D02 row to findings table (penalty: Math.round(5 × 1.2) = 6)
  - Updated total deduction: 56 → 62
  - Updated raw score: 44 → 38 (tier unchanged: F)
  - Updated cap check: min(38, 79) = 38, cap does not bind
  - Updated server score: Math.round((38+100)/2) = 69 Tier D (was 72 Tier C)
  - Updated `scoring-example.test.ts`: added D02 finding, asserted 38/69 instead of 44/72
- **Files modified:** `spec/MTQS-v0.1.md`, `tests/spec/scoring-example.test.ts`
- **Committed in:** `1af7538`

---

**Total deviations:** 1 (human-review correction applied as continuation task)
**Impact on plan:** Arithmetic was wrong; correction restores determinism guarantee. All tests pass post-fix.

## Issues Encountered

- The plan's stated "20 rules" count was a documentation error — the spec was written with 22 rules from the start (consistent with the registry and CONTEXT.md which correctly lists all IDs).
- No other issues; all automated checks (vitest + tsc --noEmit) passed after each commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SPEC-01 satisfied: doc↔registry are provably in sync; 22 anchors, 22 passing examples, 22 failing examples; zero Glama references; each rule cites a real primary source.
- SPEC-02 satisfied: scoring formula (penalties, multipliers, caps, tiers, server mean) is published with a worked example whose arithmetic is gated by a passing test.
- Phase 02 (rule engine) can proceed: it consumes `spec/helpers/scoring.ts` (already built in Plan 01) and the locked `spec/mtqs-v0.1.yaml` registry.
- Phase 04 re-tune flag: after the Apideck fixture run, calibration may surface whether the D-06 tier cuts feel right on real data (do not move cuts — adjust weights/penalties if needed).

---
*Phase: 01-mtqs-specification*
*Completed: 2026-06-12*
