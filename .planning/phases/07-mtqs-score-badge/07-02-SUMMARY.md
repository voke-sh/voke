---
phase: 07-mtqs-score-badge
plan: 02
subsystem: cli
tags: [badge, svg, cli, side-output, e2e, determinism, stderr]

# Dependency graph
requires:
  - phase: 07-mtqs-score-badge
    plan: 01
    provides: formatBadge(report) pure SVG generator + TIER_COLORS
  - phase: 04-scoring-output-cli
    provides: RunLintOpts interface, runLint pipeline, program.ts pattern
affects:
  - badge e2e test coverage (tests/cli/badge-e2e.test.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "spawnSync for capturing both stdout and stderr in e2e tests (vs execFileSync which only returns stdout)"
    - "Side-output flag wiring: option -> resolveLintOpts -> RunLintOpts field (threaded, not consumed in runLint)"
    - "D-10 ordering: writeBadge called in program.ts AFTER process.stdout.write to guarantee lint result not masked by write failure"

key-files:
  created:
    - packages/linter/src/cli/badge-writer.ts
    - tests/cli/badge-e2e.test.ts
  modified:
    - packages/linter/src/cli/program.ts
    - packages/linter/src/cli/run-lint.ts

key-decisions:
  - "writeBadge call lives in program.ts AFTER process.stdout.write (D-10): guarantees lint result is always printed before any badge write error; runLint stays IO-free of badge logic"
  - "Used spawnSync (not execFileSync) for runCapture in e2e tests: execFileSync only returns stdout; spawnSync captures both stdout and stderr on all exit codes (0 and non-zero)"
  - "BADGE-08a JSON equality: compare meta-stripped bodies (deepEqual) not raw strings — generatedAt timestamp in meta differs between runs by design (mirrors e2e-determinism.test.ts pattern)"

# Metrics
duration: 5min
completed: 2026-06-16
---

# Phase 7 Plan 02: --badge CLI flag wiring + e2e test coverage Summary

**writeBadge side-output (mkdir-p + UsageError on failure) wired into program.ts after stdout write; --badge option threaded via resolveLintOpts/RunLintOpts; 13 e2e tests covering write/mkdir-p/stderr-snippet/stdout-purity/tier-color/exit-code/determinism/write-failure**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-16T22:13:57Z
- **Completed:** 2026-06-16T22:18:40Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Implemented `writeBadge(path, report)` in `badge-writer.ts`: mkdir-p (`{ recursive: true }`), writeFileSync utf8, UsageError on failure naming the path (D-10)
- Added `--badge <path>` option to `buildProgram`, threaded through `resolveLintOpts` return and `RunLintOpts.badgePath` field
- Called `writeBadge` in `program.ts` action handler AFTER `process.stdout.write(result.text)` (D-10 ordering guarantee)
- Stderr snippet (`![MTQS](<path>)` + `wrote <path>`) written via `process.stderr.write` only (D-06/D-07)
- 13 e2e tests cover all success criteria: BADGE-01, BADGE-01b (mkdir-p), BADGE-04 (tier color on disk), BADGE-07 (stderr snippet), BADGE-08a (JSON purity), BADGE-08b (exit code invariance), BADGE-06 (byte-identical determinism), D-10 (exit 3 without masking stdout)
- 688 total project tests pass (up from 675 in Plan 01)

## Task Commits

1. **Task 1: badge-writer.ts** - `0231814` (feat)
2. **Task 2: --badge wiring in program.ts + run-lint.ts** - `8b36b37` (feat)
3. **Task 3: badge-e2e.test.ts** - `cf62bfe` (test)

## Files Created/Modified

- `packages/linter/src/cli/badge-writer.ts` - writeBadge(path, report): mkdir-p + writeFileSync + UsageError wrapper
- `packages/linter/src/cli/program.ts` - --badge option, import writeBadge, call after stdout write with stderr snippet
- `packages/linter/src/cli/run-lint.ts` - RunLintOpts.badgePath optional field (threaded, not consumed by runLint)
- `tests/cli/badge-e2e.test.ts` - 13 e2e tests via spawnSync against dist/cli/index.js

## Decisions Made

- writeBadge in program.ts AFTER stdout write (D-10): if writeBadge throws UsageError, stdout has already been flushed — lint result never masked by badge write failure
- spawnSync for e2e test runCapture: execFileSync only returns stdout on exit 0; spawnSync captures both stdout and stderr on all exit codes
- BADGE-08a uses meta-stripped deepEqual (not string equality): generatedAt in meta differs between runs by wall-clock design; this mirrors the established e2e-determinism.test.ts pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed runCapture stderr capture in e2e tests**

- **Found during:** Task 3 (test run)
- **Issue:** The plan's suggested `runCapture` (mirrored from `e2e-acceptance.test.ts`) uses `execFileSync` which only returns stdout on exit 0; `result.stderr` was always `''` for success runs, causing BADGE-07 stderr assertion failures.
- **Fix:** Replaced `execFileSync`-based `runCapture` with `spawnSync` which captures stdout and stderr in separate buffers on all exit codes (including exit 0). Also updated the `run()` helper to call `runCapture` and throw on non-zero exit rather than using `execFileSync` directly — giving consistent behavior throughout the test file.
- **Files modified:** tests/cli/badge-e2e.test.ts
- **Verification:** 13/13 tests pass including BADGE-07 stderr checks
- **Committed in:** cf62bfe (Task 3 commit)

**2. [Rule 1 - Bug] Fixed BADGE-08a JSON equality assertion**

- **Found during:** Task 3 (test run)
- **Issue:** Direct string equality (`withBadge === withoutBadge`) fails because `meta.generatedAt` is a wall-clock timestamp that differs between runs by design (D-10).
- **Fix:** Strip `.meta` block before comparing (mirrors `e2e-determinism.test.ts` pattern); use `toEqual` (deepEqual) on the meta-stripped bodies instead of `toBe` on raw strings.
- **Files modified:** tests/cli/badge-e2e.test.ts
- **Verification:** Test passes; the non-meta body is identical proving badge write does not affect stdout content
- **Committed in:** cf62bfe (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 - bugs in test assertions)
**Impact on plan:** Both fixes necessary for test correctness; no scope creep. The plan's suggested `runCapture` pattern is insufficient for stderr capture on exit-0 runs — documented for future e2e test authors.

## Known Stubs

None — all badge behaviors fully wired and tested.

## Issues Encountered

None beyond the two auto-fixed test assertion issues.

## User Setup Required

None.

## Next Phase Readiness

- `voke lint <server> --badge <path>` is fully operational (BADGE-01, 07, 08)
- Phase 07 (07-01 + 07-02) complete — MTQS score badge milestone deliverable done
- No blockers for downstream work

---
*Phase: 07-mtqs-score-badge*
*Completed: 2026-06-16*
