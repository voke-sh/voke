---
phase: 04-scoring-output-cli
plan: "01"
subsystem: cli-leaf-modules
tags: [cli, formatters, version, target-resolver, tdd, chalk]
dependency_graph:
  requires: []
  provides:
    - packages/linter/src/version.ts (VOKE_VERSION, MTQS_VERSION, versionString)
    - packages/linter/src/cli/resolve-target.ts (resolveTarget, UsageError, ResolvedTarget, TransportKind)
    - packages/linter/src/cli/format-human.ts (formatHuman, HumanFormatOpts)
    - packages/linter/src/cli/format-json.ts (formatJson)
  affects:
    - packages/linter/src/index.ts (barrel extended with 7 new exports)
    - packages/core/src/index.ts (MULT and BASE now exported)
tech_stack:
  added:
    - chalk@5.6.2 (packages/linter runtime dep — ESM-only ANSI coloring, disabled under color:false)
  patterns:
    - TDD (RED-GREEN per task): 3 RED-GREEN cycles, 50 total tests passing
    - Extensible scheme-dispatch registry (SCHEME_HANDLERS) for target resolution (D-05)
    - Fixed-order dimension array (DIMENSION_ORDER const) to guarantee deterministic output
    - canonicalJson for stable JSON serialization in formatJson
key_files:
  created:
    - packages/linter/src/version.ts
    - packages/linter/src/cli/resolve-target.ts
    - packages/linter/src/cli/format-human.ts
    - packages/linter/src/cli/format-json.ts
    - tests/cli/version.test.ts
    - tests/cli/resolve-target.test.ts
    - tests/cli/format-human.test.ts
    - tests/cli/format-json.test.ts
  modified:
    - packages/linter/src/index.ts
    - packages/linter/package.json
    - packages/core/src/index.ts
decisions:
  - "UsageError kept in resolve-target.ts (not errors.ts) to avoid parallel wave conflicts; Plan 02 can re-home if a shared error class is needed"
  - "MULT not previously exported from @voke/core index; added MULT and BASE exports as blocking auto-fix"
  - "Dimension weights always formatted to one decimal place (1.0x, 1.2x, 1.5x) for consistent output"
metrics:
  duration: "~6 minutes"
  completed: "2026-06-13"
  tasks_completed: 3
  files_changed: 11
---

# Phase 04 Plan 01: CLI Leaf Modules Summary

**One-liner:** Pure CLI leaf modules — version constants, scheme-dispatch target resolver, human+JSON formatters — ready for Plan 02 commander wiring, with 50 TDD tests green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Version source-of-truth (SCORE-02 / D-08) | 5c679e7 | version.ts, index.ts, version.test.ts |
| 2 | Extensible target resolver (D-04/D-05/D-06) | 447f8f1 | resolve-target.ts, index.ts, resolve-target.test.ts |
| 3 | Human + JSON formatters (OUT-01/OUT-02) | 3083004 | format-human.ts, format-json.ts, format-human.test.ts, format-json.test.ts, package.json, core/index.ts |

## What Was Built

### version.ts (SCORE-02)
- `VOKE_VERSION = '0.0.0'` hardcoded const (deterministic, import-cheap; build-time injection deferred)
- `MTQS_VERSION = '0.1'` matching spec/mtqs-v0.1.yaml
- `versionString()` returns `"voke 0.0.0 (MTQS v0.1)"` — the exact string Plan 02 passes to commander `--version`

### resolve-target.ts (D-04/D-05/D-06)
- `SCHEME_HANDLERS` registry: maps `'http:'` and `'https:'` to `kind='live'`; Phase 5 stdio adds one entry here
- Schemeless host:port (`localhost:3000/mcp`) throws `UsageError` with `"Did you mean http://localhost:3000/mcp?"` (D-06)
- Unknown schemes (`ftp://`) throw `UsageError` listing supported schemes
- `UsageError.exitCode = 3` (D-13)
- Everything else treated as a local file path (`kind='file'`)

### format-human.ts (OUT-01/D-01/D-02/D-03)
- Score banner: `"Server score: {N}/100  Tier {T}"` — NEVER colorized (D-03)
- Dimension weight breakdown in fixed order: schema(1.5x), annotations(1.5x), description(1.2x), parameters(1.2x), naming(1.0x) — uses `DIMENSION_ORDER` const, not `Object.keys(MULT)` (deterministic)
- Below-A tool table sorted by score ascending, then toolId (D-01); tier-A tools omitted
- `opts.color=false` produces zero ANSI bytes in the entire output
- `opts.verbose=true` adds `severity ruleId at path: message -> fixHint` lines per finding (D-02)

### format-json.ts (OUT-02/D-10)
- `formatJson(report) = canonicalJson(report)` — full LintReport including `meta.generatedAt`
- Sorted keys, byte-identical on repeated calls with the same report

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MULT not exported from @voke/core**
- **Found during:** Task 3 (format-human.ts first test run)
- **Issue:** `import { MULT } from '@voke/core'` failed — MULT was in `packages/core/src/scoring.ts` but not re-exported from `packages/core/src/index.ts`
- **Fix:** Added `MULT` and `BASE` to the `@voke/core` barrel exports
- **Files modified:** packages/core/src/index.ts
- **Commit:** 3083004

**2. [Rule 1 - Bug] Naming weight formatted as `1x` instead of `1.0x`**
- **Found during:** Task 3 test run (1 failing test after initial GREEN attempt)
- **Issue:** JavaScript's default number-to-string for `1.0` is `"1"`, so the output was `naming  1x` instead of `naming  1.0x`
- **Fix:** Use `.toFixed(1)` when formatting dimension weights in the breakdown
- **Files modified:** packages/linter/src/cli/format-human.ts
- **Commit:** 3083004

## Known Stubs

None. All modules produce real output from real inputs. Version constants are hardcoded values matching current state (not stubs).

## Verification Results

- `npx vitest run tests/cli/` — 4 test files, 50 tests, all green
- `npm run typecheck` — passes (tsc --build, NodeNext, strict)
- `grep -c "export" packages/linter/src/index.ts` — 25 exports (7 new from this plan)

## Self-Check: PASSED

- `packages/linter/src/version.ts` — FOUND
- `packages/linter/src/cli/resolve-target.ts` — FOUND
- `packages/linter/src/cli/format-human.ts` — FOUND
- `packages/linter/src/cli/format-json.ts` — FOUND
- Commit 5c679e7 (Task 1) — FOUND
- Commit 447f8f1 (Task 2) — FOUND
- Commit 3083004 (Task 3) — FOUND
