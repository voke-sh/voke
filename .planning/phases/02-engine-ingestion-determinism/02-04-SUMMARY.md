---
phase: 02-engine-ingestion-determinism
plan: "04"
subsystem: testing
tags: [determinism, report, scoring, linting, vitest]

# Dependency graph
requires:
  - phase: 02-engine-ingestion-determinism (plans 01-03)
    provides: canonicalJson/sha256/surfaceContentHash (canonicalize); VokeSnapshot/ToolSnapshot/ServerIdentity (ingestion); RuleRegistry/runRules/createDefaultRegistry (engine)
  - phase: 01-mtqs-specification
    provides: "@voke/core: scoreTool/applyCaps/tierFor/serverScore (integer-first scoring, caps, tiers)"
provides:
  - "LintReport types (Tier, ToolReport, LintReport) in packages/linter/src/report/types.ts"
  - "buildReport: VokeSnapshot + Finding[] -> LintReport reusing @voke/core scoring (no arithmetic reimplemented)"
  - "serializeReportBody: strips meta/generatedAt, returns canonical sorted-key JSON body"
  - "ENG-04/D-12 byte-identical x3 determinism proof artifact (tests/engine/determinism.test.ts)"
  - "Full barrel export in packages/linter/src/index.ts (all report symbols)"
affects: [03-mtqs-rules, 04-cli, determinism, scoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sort-on-run: buildReport re-sorts snapshot.tools by toolId defensively so shuffled input produces identical ToolReport order"
    - "Meta-stripping serialization: serializeReportBody destructures meta out before canonicalJson so the hashed body is wall-clock-free"
    - "CoreFinding mapping: runtime Finding (ruleId, severity, dimension, message, location, fixHint) mapped to CoreFinding (ruleId, severity, dimension) before passing to @voke/core scoreTool"

key-files:
  created:
    - packages/linter/src/report/types.ts
    - packages/linter/src/report/builder.ts
    - tests/report/builder.test.ts
    - tests/engine/determinism.test.ts
  modified:
    - packages/linter/src/index.ts

key-decisions:
  - "buildReport sorts snapshot.tools by toolId before building per-tool reports (defensive sort-on-run) so shuffled input is provably order-invariant"
  - "serializeReportBody uses destructuring (const { meta, ...body } = report) to strip the meta block — the only wall-clock value lives there"
  - "Report builder reuses @voke/core scoring verbatim (scoreTool, applyCaps, tierFor, serverScore) — no arithmetic reimplemented in Phase 2"

patterns-established:
  - "Defensive sort-on-run in buildReport: always sort tools by toolId before scoring, regardless of input order"
  - "Meta-stripped body for determinism testing: serializeReportBody = canonicalJson(report without meta)"

requirements-completed: [ENG-04]

# Metrics
duration: 3min
completed: 2026-06-12
---

# Phase 2 Plan 04: Report Builder + Determinism Proof Summary

**LintReport builder with @voke/core scoring delegation and ENG-04/D-12 byte-identical x3 determinism proof on the Apideck fixture (163 tests pass)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-12T19:36:54Z
- **Completed:** 2026-06-12T19:40:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Built `buildReport` that assembles LintReport from VokeSnapshot + Finding[] using @voke/core scoring (scoreTool, applyCaps, tierFor, serverScore); zero scoring arithmetic reimplemented
- Built `serializeReportBody` that strips the `meta` block (D-02) before canonicalJson serialization, producing a wall-clock-free body for determinism comparison
- Created `tests/engine/determinism.test.ts`: the ENG-04/D-12 proof artifact; 3x byte-identical assertion + shuffle-invariant assertion + meta exclusion assertions all pass on the Apideck fixture
- Full test suite: 163 tests, 19 test files, all green; `npm run typecheck` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: LintReport types + buildReport + serializeReportBody** - `e8fdf45` (feat)
2. **Task 2: Determinism test + sort-on-run bug fix** - `0f30807` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/linter/src/report/types.ts` - Tier, ToolReport, LintReport interfaces
- `packages/linter/src/report/builder.ts` - buildReport + serializeReportBody; delegates all scoring to @voke/core
- `packages/linter/src/index.ts` - Added LintReport/ToolReport/Tier exports + buildReport/serializeReportBody exports
- `tests/report/builder.test.ts` - 10 tests: structure, scoring correctness, meta exclusion, valid JSON, snapshotContentHash
- `tests/engine/determinism.test.ts` - 6 tests: 3x byte-identical (ENG-04), shuffle-invariant (reversed + mid-rotated), generatedAt/capturedAt exclusion

## Decisions Made
- `buildReport` re-sorts `snapshot.tools` by `toolId` before building per-tool reports as a defensive sort-on-run. This is required for the shuffle-invariance test to pass and ensures the LintReport is a pure function of tool content, not input ordering.
- `serializeReportBody` uses ES destructuring `const { meta, ...body } = report` so the meta exclusion is compile-time explicit and type-safe.
- In Phase 2 the default registry is empty (zero rules), so findings = [] and all scores = 100. The D-12 test still proves the pipeline is deterministic — Phase 3 adds rules and the test remains the correctness gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] buildReport not sorting tools before building ToolReport array**
- **Found during:** Task 2 (determinism test execution)
- **Issue:** `buildReport` used `snapshot.tools.map(...)` preserving input order. When the test passed a reversed snapshot, the `tools` array in the report had reversed toolId order, producing a different serialized body.
- **Fix:** Added `[...snapshot.tools].sort((a, b) => a.toolId.localeCompare(b.toolId, 'en', {sensitivity:'variant'}))` before the map — the same localeCompare pattern used throughout the codebase. Does not mutate the input array.
- **Files modified:** `packages/linter/src/report/builder.ts`
- **Verification:** All 6 determinism tests pass (reversed + mid-rotated both produce identical output)
- **Committed in:** `0f30807` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** The fix is required for the shuffle-invariance requirement stated in the plan. No scope creep.

## Issues Encountered
None beyond the sort-on-run bug documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 DoD met: byte-identical x3 + shuffle-invariant + meta-excluded determinism artifact green
- All barrel exports in packages/linter/src/index.ts ready for Phase 3 rule consumption
- Phase 3 (MTQS rules) can import createDefaultRegistry, runRules, buildReport, serializeReportBody directly from `@voke/linter`
- The determinism test will continue to gate Phase 3 rule additions — any non-deterministic rule will break Test A

## Self-Check: PASSED

All created files verified on disk. All task commits verified in git log.

---
*Phase: 02-engine-ingestion-determinism*
*Completed: 2026-06-12*
