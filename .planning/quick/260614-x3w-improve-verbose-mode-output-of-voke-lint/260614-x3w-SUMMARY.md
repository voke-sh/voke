---
phase: quick-260614-x3w
plan: 01
subsystem: cli/output
tags: [verbose, format-human, ux, determinism]
dependency_graph:
  requires: []
  provides: [clean verbose finding renderer, stripMessagePrefix helper]
  affects: [packages/linter/src/cli/format-human.ts]
tech_stack:
  added: []
  patterns: [anchored-regex prefix stripping, multi-line terminal layout]
key_files:
  created: []
  modified:
    - packages/linter/src/cli/format-human.ts
    - tests/cli/format-human.test.ts
decisions:
  - stripMessagePrefix uses anchored ^ regex so it only strips a leading MTQS-XXX [severity] prefix and returns the original string unchanged when no prefix matches (never throws, deterministic)
  - Multi-line layout (header + message + fix:) replaces the single-line joiner ` -> ` — provides visual hierarchy without adding any runtime dependencies
  - Finding data model, rule message strings, format-json.ts, and engine/types.ts are untouched — the strip is display-only
metrics:
  duration: 1m
  completed_date: "2026-06-14T22:54:00Z"
  tasks_completed: 2
  files_changed: 2
---

# Quick 260614-x3w: Improve Verbose Mode Output of voke lint — Summary

**One-liner:** Multi-line verbose finding renderer with anchored MTQS prefix stripping eliminates doubled ruleId/severity from `--verbose` output.

## What Was Built

Revised `formatHuman` verbose block in `packages/linter/src/cli/format-human.ts`:

- Added `stripMessagePrefix` pure helper — anchored regex `^MTQS-[A-Za-z0-9]+ \[(?:error|warning|info|hint)\] ` strips the display-redundant prefix from rule messages at render time only. No match returns the raw string (verbatim fallback, no throw).
- Replaced the single-line `{severity} {ruleId} at {path}: {message} -> {fixHint}` render with a three-line layout per finding:
  - Header: `    {severity} {ruleId}  ({path})` — severity word from `colorSeverity`, ruleId once, path or `(root)`
  - Message body: `      {cleanMessage}` — prefix-stripped, indented under header
  - Fix hint: `      fix: {fixHint}` — dedicated line, replaces ` -> ` joiner
- Updated the D-02 doc comment to describe the new layout and the prefix-stripping approach.

## Tests Added

New describe block `formatHuman — verbose layout (D-02)` in `tests/cli/format-human.test.ts`:

| Test | Assertion |
|------|-----------|
| renders ruleId exactly once when message is prefixed | ruleId count === 1 in finding block; `[info]` absent |
| renders message text after stripping MTQS prefix | body text "annotations object is absent" present |
| renders fixHint on a line starting with "fix:" | matches `/^\s+fix: .../m`; ` -> ` absent |
| renders header line containing severity, ruleId, path | matches `/info.*MTQS-A01.*annotations/` |
| uses "(root)" in header when path is empty | `(root)` in output |
| renders prefix-less message verbatim (fallback, no throw) | no throw; raw message text present |

All 24 format-human tests pass. Full suite: 636 tests across 36 files, zero failures. `tsc --build` clean.

## Decisions Made

- `stripMessagePrefix` uses `.replace` (not `.match` + reconstruct) — a no-match `.replace` returns the original string unchanged; this is the safest zero-throw fallback.
- The strip is at display time only; the `Finding.message` field on the data model is preserved exactly as produced by rule implementations — JSON output is unaffected.
- Score banner is built before the verbose block and is never passed through `colorSeverity` (D-03 constraint preserved).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `packages/linter/src/cli/format-human.ts` modified: FOUND
- `tests/cli/format-human.test.ts` modified: FOUND
- Task 1 commit `14ab295`: FOUND
- `npx vitest run` — 636/636 passed
- `npx tsc --build` — no errors
- `git diff --stat` — only the two expected files modified
