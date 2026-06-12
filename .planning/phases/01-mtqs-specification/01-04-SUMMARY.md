---
phase: 01-mtqs-specification
plan: "04"
subsystem: spec
tags: [mtqs, scope, determinism, boundary, linter, mcp]

# Dependency graph
requires:
  - phase: 01-mtqs-specification/01-01
    provides: spec/helpers and tests/spec infrastructure, vitest config, registry-types.ts

provides:
  - spec/SCOPE.md — single-page normative L1 boundary statement (SPEC-05)
  - tests/spec/scope.test.ts — 5 grep-style assertions that gate the required boundary statements

affects:
  - 01-mtqs-specification/01-02 (spec doc §1.3 links SCOPE.md)
  - Phase 05 (CONTRIBUTING.md will link SCOPE.md for rule PR reviewers)
  - All rule PRs (§4 Scope Creep Prevention is normative for contributors)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Normative boundary document pattern: five-section structure (What It Is, What It Is Not, Guarantee, Prevention, Version Boundary)"
    - "TDD for spec prose: readFileSync + regex assertions gate content correctness at CI"

key-files:
  created:
    - spec/SCOPE.md
    - tests/spec/scope.test.ts
  modified: []

key-decisions:
  - "Hard employer-conflict line documented: Voke is a read-only observer, never a gateway or proxy"
  - "LLM-as-judge explicitly excluded from L1 with ICC-score rationale (0.62–0.90 not sufficient for CI gate)"
  - "L2 and L4 boundaries explicit: diffing is L2, agent evaluation is L4"
  - "Scope-creep PR rule: primary source citation required, never Glama"

patterns-established:
  - "Prose specs tested with readFileSync + /regex/i assertions — cheap, fast, deterministic"

requirements-completed: [SPEC-05]

# Metrics
duration: 2min
completed: 2026-06-12
---

# Phase 01 Plan 04: SCOPE.md — Normative L1 Boundary Statement Summary

**Single-page normative MTQS L1 scope document with all five required boundary sections, 183 lines, gated by 5 vitest assertions that enforce presence of every required phrase (no-LLM, gateway/proxy, L2, L4, determinism)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-12T13:05:23Z
- **Completed:** 2026-06-12T13:07:28Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Authored `spec/SCOPE.md` — 183-line normative document with all five required sections: (1) What MTQS L1 Is, (2) What MTQS L1 Is Not, (3) The Determinism Guarantee, (4) Scope Creep Prevention, (5) Version Boundary
- All required boundary phrases present: "no LLM", "LLM-as-judge", "gateway", "proxy", "L2", "L4", "deterministic/determinism"
- Created `tests/spec/scope.test.ts` with 5 vitest assertions verifying every required boundary statement; all 5 pass
- Scope-creep prevention PR rule documented normatively (§4): primary source required, never Glama, mechanical checkability required, rejection criteria for semantic rules

## Task Commits

1. **Task 1: Write spec/SCOPE.md** - `91ae998` (feat)
2. **Task 2: SCOPE.md boundary-statement test** - `9d11565` (test)

## Files Created/Modified

- `spec/SCOPE.md` — Single-page normative L1 boundary statement, 183 lines, 5 sections
- `tests/spec/scope.test.ts` — 5 vitest assertions for required boundary phrases; all passing

## Decisions Made

- Included ICC-score rationale (0.62–0.90) from arxiv:2602.14878 to justify why LLM-as-judge is excluded from L1 — makes the exclusion defensible, not arbitrary
- Five required implementation constraints in §3 (Determinism Guarantee) match the scoring formula specified in 01-RESEARCH.md (integer-first arithmetic, sorted tool arrays, rule evaluation order)
- §4 Scope Creep Prevention explicitly prohibits Glama as a source — anti-black-box positioning built into the document itself

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — SCOPE.md is complete normative prose; no stub content.

## Next Phase Readiness

- SPEC-05 is satisfied: SCOPE.md exists and explicitly states the L1 boundary (no LLM-in-loop; no gateway/proxy; no L2+), the determinism guarantee, and the scope-creep-prevention PR rule
- `spec/SCOPE.md` is ready to be linked from spec §1.3 (Plan 02) and from CONTRIBUTING.md (Phase 5)
- No blockers for remaining Phase 1 plans

## Self-Check: PASSED

- `spec/SCOPE.md` exists: FOUND
- `tests/spec/scope.test.ts` exists: FOUND
- Commit `91ae998` exists: FOUND
- Commit `9d11565` exists: FOUND
- All 5 tests passing: CONFIRMED (npx vitest run tests/spec/scope.test.ts → 5 passed)

---
*Phase: 01-mtqs-specification*
*Completed: 2026-06-12*
