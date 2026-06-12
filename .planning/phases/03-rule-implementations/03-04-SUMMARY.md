---
phase: 03-rule-implementations
plan: 04
subsystem: testing
tags: [mtqs, annotations, rules, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-engine-ingestion-determinism
    provides: RuleDefinition/RuleContext/Finding types, engine runner, frozen context
  - phase: 03-rule-implementations plan 01
    provides: spec fixtures, MTQS-v0.1.yaml registry, loadRegistryFile

provides:
  - annotationRules: RuleDefinition[6] for MTQS-A01..A06 in packages/linter/src/rules/annotations.ts
  - tests/rules/annotations.test.ts with 42 tests covering positive+negative+network-block
  - annotations-pass.json, annotations-fail.json, annotations-contradiction.json fixtures

affects:
  - 03-05-integration (wires annotationRules into registry.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "annotationsPresent helper: typeof t.annotations === 'object' && !== null"
    - "hintIsBool helper: typeof ann[key] === 'boolean' (unknown + narrowing, no any)"
    - "A02-A05 guard: only evaluate when annotations object present (A01 covers absent case)"
    - "A06 strict cross-constraint: ann[readOnlyHint] === true && ann[destructiveHint] === true"
    - "fixHints verbatim from spec YAML (folded scalar → single-line)"

key-files:
  created:
    - packages/linter/src/rules/annotations.ts
    - tests/rules/annotations.test.ts
    - tests/fixtures/rules/annotations-pass.json
    - tests/fixtures/rules/annotations-fail.json
    - tests/fixtures/rules/annotations-contradiction.json

key-decisions:
  - "annotations:{} fires A02+A03 (warning) + A04+A05 (info) but not A01 — object presence is the gate"
  - "A06 uses strict boolean equality (=== true) for both hints, not truthiness"
  - "fixHints stored as single-line strings matching YAML folded scalar output from loadRegistryFile"
  - "Task 1 and Task 2 executed as single commit since A06 and test file were implemented together"

patterns-established:
  - "Rule file per dimension — annotationRules array exported from annotations.ts"
  - "Each rule self-references its fixHint via enclosing const binding (e.g. fixHint: a01.fixHint)"
  - "Spec cross-check pattern: loadRegistryFile in test, iterate annotationRules, assert severity+fixHint match"

requirements-completed: [RULE-05, RULE-06]

# Metrics
duration: 4min
completed: 2026-06-12
---

# Phase 03 Plan 04: Annotation Transparency Rules Summary

**Six MTQS annotation rules (A01-A06) with strict readOnly+destructive cross-constraint, TDD fixtures, and network-block purity test — 42 tests green**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-12T21:16:05Z
- **Completed:** 2026-06-12T21:19:56Z
- **Tasks:** 2 (combined into 1 commit due to natural co-implementation)
- **Files modified:** 5

## Accomplishments

- A01 (info) fires only when annotations object is absent; silent for `annotations: {}`
- A02/A03 (warning) fire when readOnlyHint/destructiveHint not a boolean within existing annotations
- A04/A05 (info) fire when idempotentHint/openWorldHint not a boolean within existing annotations
- A06 (error) fires ONLY when both readOnlyHint === true AND destructiveHint === true — dedicated contradiction fixture proves the cross-constraint
- All 42 tests pass including network-block purity test and spec cross-check comparing fixHints verbatim to mtqs-v0.1.yaml

## Task Commits

1. **Task 1+2: Implement annotationRules A01-A06 with TDD fixtures and network-block test** - `eff430e` (feat)

## Files Created/Modified

- `packages/linter/src/rules/annotations.ts` - annotationRules[6] export, A01-A06 pure rule functions
- `tests/rules/annotations.test.ts` - 42 tests: per-rule positive/negative, worked example, network-block, spec cross-check
- `tests/fixtures/rules/annotations-pass.json` - tool with all 4 hints set (readOnly:true, destructive:false)
- `tests/fixtures/rules/annotations-fail.json` - two tools: no annotations (A01 trigger) + empty annotations{} (A02-A05 trigger)
- `tests/fixtures/rules/annotations-contradiction.json` - tool with readOnlyHint:true + destructiveHint:true (A06 trigger)

## Decisions Made

- fixHints stored as single-line strings to match YAML folded scalar output from `loadRegistryFile` — multi-line strings with `\n      ` caused spec cross-check failures
- A06 uses strict equality (`=== true`) not truthiness for both hints, as per spec "strict boolean true"
- Tasks 1 and 2 executed together because A06 and the full test file (including contradiction fixture) are naturally co-developed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed fixHint string format to match YAML folded scalar output**
- **Found during:** Task 1 (GREEN phase — spec cross-check tests failing)
- **Issue:** fixHints in annotations.ts had embedded `\n      ` whitespace from multi-line strings; YAML `>` folded scalar collapses these to single spaces in loadRegistryFile output
- **Fix:** Replaced multi-line fixHint strings with single-line equivalents matching collapsed YAML output
- **Files modified:** packages/linter/src/rules/annotations.ts
- **Verification:** All 6 spec cross-check tests pass
- **Committed in:** eff430e (task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in fixHint format)
**Impact on plan:** Required to make spec cross-check tests pass. No scope creep.

## Issues Encountered

None beyond the fixHint format mismatch described above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `annotationRules` is ready to be registered in 03-05 integration plan
- All 6 annotation rules pass with correct severities and verbatim fixHints
- The annotations:{} worked example is validated (A01 silent, A02+A03 warning, A04+A05 info)
- A06 cross-constraint proven on dedicated contradiction fixture
- Network-block purity confirmed

---
*Phase: 03-rule-implementations*
*Completed: 2026-06-12*
