---
phase: 07-mtqs-score-badge
plan: 01
subsystem: cli
tags: [svg, badge, determinism, verdana, shields.io, tdd]

# Dependency graph
requires:
  - phase: 04-scoring-output-cli
    provides: LintReport type with serverScore + serverTier fields
  - phase: 02-engine-ingestion-determinism
    provides: Tier type, determinism patterns
provides:
  - formatBadge(report: LintReport): string — pure deterministic SVG badge generator
  - TIER_COLORS: Record<Tier, string> — tier to hex color mapping (A/B/C/D/F)
  - Verdana 11px advance-width table + roundUpToOdd geometry helpers
  - 25 unit tests covering BADGE-02..06
affects:
  - 07-02 (badge-writer + CLI flag wiring — consumes formatBadge)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure SVG generation via string template with presentation attributes (no style=)"
    - "Verdana 11px baked width table + roundUpToOdd for deterministic segment geometry"
    - "TDD RED-GREEN: write failing tests first, then implement"

key-files:
  created:
    - packages/linter/src/cli/badge.ts
    - tests/cli/badge.test.ts
  modified: []

key-decisions:
  - "SVG xmlns namespace URI (http://www.w3.org/2000/svg) is a required namespace declaration, not a network reference — BADGE-02 constraint (no external CDN/font refs) is satisfied despite the plan acceptance criteria grep for 'http' flagging it"
  - "Used cicirello flat pattern (shadow via fill-opacity=.3, no Gaussian blur filter) — cleaner diff, fewer bytes, RESEARCH Open Question 1 resolved"
  - "TIER_COLORS exported as public const so it can be referenced by other modules (badge-writer test or future use)"

patterns-established:
  - "Badge text width: textWidth(s) = roundUpToOdd(floor(sum of VERDANA_11 char widths)); segmentWidth = textWidth + 2*HORIZ_PADDING"
  - "Label center X: FONT_SCALE * (1 + HORIZ_PADDING + labelTextW/2) = 225 (fixed for MTQS)"
  - "Value center X: FONT_SCALE * (labelW - 1 + HORIZ_PADDING + valueTextW/2)"

requirements-completed: [BADGE-02, BADGE-03, BADGE-04, BADGE-05, BADGE-06]

# Metrics
duration: 4min
completed: 2026-06-16
---

# Phase 7 Plan 01: MTQS Score Badge (formatBadge) Summary

**Pure deterministic SVG badge generator using Verdana 11px width table + roundUpToOdd geometry, shields.io-compatible flat style with tier-to-hex TIER_COLORS map and no external references**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-16T22:07:09Z
- **Completed:** 2026-06-16T22:11:00Z
- **Tasks:** 2 (TDD: RED test commit + GREEN implementation commit)
- **Files modified:** 2

## Accomplishments

- Implemented `formatBadge(report: LintReport): string` — pure function with zero IO, Date, or Math.random (BADGE-06 determinism)
- Verified geometry for all badge output classes: B 85 → 78px, A 100 → 86px, D 65 → 80px, F 5 → 70px (BADGE-03b)
- 25 unit tests covering all BADGE-02..06 requirements green; 675 total project tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing unit tests for formatBadge (Wave 0 scaffold)** - `10017fe` (test)
2. **Task 2: Implement pure formatBadge SVG builder (GREEN)** - `3f31697` (feat)

_Note: TDD tasks — Task 1 is RED (failing), Task 2 is GREEN (passing). Test file updated in Task 2 commit to fix overly-strict BADGE-02c check (see Deviations)._

## Files Created/Modified

- `packages/linter/src/cli/badge.ts` - Pure formatBadge SVG generator + TIER_COLORS + Verdana width table
- `tests/cli/badge.test.ts` - 25 unit tests for BADGE-02..06 (label text, value text, widths, tier colors, self-contained, determinism)

## Decisions Made

- Used cicirello flat badge pattern (shadow via fill-opacity=.3 only, no Gaussian blur `<filter>`) — simpler, fewer bytes, cleaner git diff for version-controlled SVG files
- Exported `TIER_COLORS` as a named export (not just `formatBadge`) for potential future use by tests or other badge utilities
- xmlns namespace `http://www.w3.org/2000/svg` is required for valid SVG — it's a namespace identifier, not a network reference; BADGE-02 intent (no CDN/font/external network refs) is fully satisfied

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed overly-strict BADGE-02c http-check test assertion**

- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Test asserted `svg.not.toContain('http')` but the SVG xmlns declaration `xmlns="http://www.w3.org/2000/svg"` necessarily contains that string. This xmlns is a required namespace declaration for valid SVG, not a network reference. The plan acceptance criteria `grep -cE 'http|<image|href' badge.ts` returns 0 was similarly overzealous — it would require removing a mandatory SVG attribute.
- **Fix:** Updated test to strip the xmlns attribute before checking for external `http` references: `const withoutXmlns = svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, ''); expect(withoutXmlns).not.toContain('http');`
- **Files modified:** tests/cli/badge.test.ts
- **Verification:** Test passes; BADGE-02 constraint (no external CDN/font/network refs) is fully satisfied — the SVG has no external URLs beyond the required xmlns namespace declaration
- **Committed in:** 3f31697 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test assertion)
**Impact on plan:** Fix necessary for correctness — the xmlns namespace is mandatory for valid SVG and is not an external reference. No scope creep.

## Issues Encountered

None — plan executed smoothly. The xmlns issue was caught immediately when tests ran against the implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `formatBadge` is ready for 07-02 (badge-writer + CLI flag wiring)
- 07-02 will add `writeBadge(path, report)` (file write with mkdir-p), `--badge <path>` CLI option, and stderr snippet output
- No blockers

---
*Phase: 07-mtqs-score-badge*
*Completed: 2026-06-16*
