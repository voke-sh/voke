---
phase: 03-rule-implementations
plan: "05"
subsystem: linter/rules
tags: [rules, registry, aggregator, integration, determinism, scoring]
dependency_graph:
  requires: ["03-01", "03-02", "03-03", "03-04"]
  provides: ["allRules aggregator", "createDefaultRegistry with 22 rules", "bidirectional registry coverage", "spec worked-example score proof"]
  affects: ["packages/linter/src/rules/index.ts", "packages/linter/src/engine/registry.ts", "packages/linter/src/index.ts"]
tech_stack:
  added: []
  patterns: ["Aggregator pattern (spread five arrays into allRules)", "Bidirectional doc<->code coverage test", "Spec worked-example end-to-end test", "Network-block purity assertion via vi.stubGlobal"]
key_files:
  created:
    - packages/linter/src/rules/index.ts
    - tests/rules/registry-coverage.test.ts
    - tests/rules/full-surface.test.ts
  modified:
    - packages/linter/src/engine/registry.ts
    - packages/linter/src/index.ts
    - tests/engine/registry.test.ts
decisions:
  - "allRules defined as static array spread (not a function) — no runtime cost; dimension order is schema→description→naming→parameters→annotations for review legibility, registry sorts by id on list()"
  - "fixHint parity uses .trim() on both sides — YAML block scalars carry trailing newline; rule file strings do not"
  - "registry-coverage test uses dynamic for-loop test generation over all 22 YAML entries so new rules automatically gain coverage tests without manual test additions"
  - "full-surface test reads crm_search_contacts from committed apideck-snapshot.json fixture to avoid duplication of the well-designed tool definition"
metrics:
  duration_minutes: 5
  completed_date: "2026-06-12"
  tasks_completed: 2
  files_changed: 6
---

# Phase 03 Plan 05: Wave 2 Aggregator — allRules + Registry Coverage + Full-Surface Determinism Test Summary

**One-liner:** allRules aggregates 22 MTQS v0.1 rules from five Wave 1 dimension modules into createDefaultRegistry(); bidirectional YAML<->registry coverage and spec §4.4 worked-example scores (search=38/F, crm_search_contacts=100/A, server=69/D) proven deterministically with network blocked.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Aggregate allRules + wire createDefaultRegistry + barrel exports | 7796504 | rules/index.ts (new), registry.ts (modified), index.ts (modified) |
| 2 | Bidirectional registry-coverage test + full-surface determinism + worked-example test | be1d25e | tests/rules/registry-coverage.test.ts (new), tests/rules/full-surface.test.ts (new) |

## What Was Built

### Task 1: Rule Aggregation and Registry Wiring

**`packages/linter/src/rules/index.ts`** (new): aggregator module that imports all five Wave 1 dimension arrays and spreads them into `allRules: RuleDefinition[]`. Re-exports each dimension array individually for callers that only need a single dimension.

**`packages/linter/src/engine/registry.ts`** (modified): `createDefaultRegistry()` now loops `for (const def of allRules) registry.register(def)` before calling `seal()`. The import of `allRules` from `'../rules/index.js'` is at the top level. Each call to `createDefaultRegistry()` returns a fresh instance (no module-level singleton — test isolation preserved).

**`packages/linter/src/index.ts`** (modified): barrel now exports `allRules` and all five dimension arrays via `export { allRules } from './rules/index.js'` and individual dimension re-exports.

**`tests/engine/registry.test.ts`** (modified): updated the Phase 2 "empty registry" assertion to expect 22 rules (Phase 3 activation).

### Task 2: Test Coverage

**`tests/rules/registry-coverage.test.ts`** (new, 140 tests):
- Asserts YAML has exactly 22 entries and registry has exactly 22 rules
- Direction A: every YAML id appears in the registry (no missing)
- Direction B: every registered id appears in YAML (no extra)
- Set equality assertion (both sets are identical)
- Per-id parity: `defaultSeverity === yaml.severity`, `dimension === yaml.dimension`, `fixHint.trim() === yaml.fixHint.trim()`, `target === (scope==='server' ? 'server' : 'tool')`
- Asserts exactly one server-scoped rule (MTQS-N03)

**`tests/rules/full-surface.test.ts`** (new, 12 tests):
- Builds VokeSnapshot with spec §4.4 `search` and `crm_search_contacts` tools
- Asserts `search` score=38 tier='F', `crm_search_contacts` score=100 tier='A', serverScore=69 serverTier='D'
- Asserts the 7 expected ruleIds fire for `search` (D02, D03, S07, S08, P01, A02, A03)
- Asserts A01 is silent (annotations object present), A04/A05 fire as info
- x3 determinism (three independent runs produce byte-identical JSON.stringify output)
- Shuffle-invariant determinism (reversed surface → same findings)
- Network-block: `vi.stubGlobal('fetch', ...)` is active in all tests via beforeEach; a vi.fn() stub confirms fetch is never called (zero invocations)

## Verification Results

- `npx tsc --build` — exits 0 (no type errors)
- `npm test` — 500 tests pass across 26 test files (up from 348/24 at Wave 1 start)
- `createDefaultRegistry().list()` has length 22 — verified by registry-coverage test
- Set equality YAML<->registry proven in both directions — verified by registry-coverage test
- spec §4.4 scores reproduced exactly: 38/F, 100/A, 69/D — verified by full-surface test
- Network-block confirmed: fetch stub never invoked during full registry run

## Deviations from Plan

**Minor auto-fix:**
- Updated `tests/engine/registry.test.ts` test "returns an empty registry in Phase 2" to expect 22 rules. This test was gating Task 1 verification since `createDefaultRegistry()` now returns 22 rules. The update is directly caused by the task's change to `createDefaultRegistry()` — this is the expected activation of the Phase 3 behavior the test was documenting.

No other deviations from plan. All acceptance criteria met exactly as specified.

## Known Stubs

None. All 22 rules are fully wired and produce real findings. The spec worked-example scores reproduce exactly.

## Self-Check: PASSED
