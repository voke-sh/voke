---
phase: 02-engine-ingestion-determinism
plan: "03"
subsystem: engine
tags: [rule-engine, registry, runner, determinism, tdd, frozen-context, network-block]
dependency_graph:
  requires:
    - 02-01 (canonicalize module — sha256, canonicalJson used by hashing context)
    - 02-02 (ingestion types — ToolSnapshot, VokeSnapshot reused in RuleContext)
  provides:
    - RuleContext, RuleFunction, RuleDefinition, Finding, FindingLocation types
    - VokeConfig config stub
    - RuleRegistry (register/seal/list/applyOverrides/createDefaultRegistry)
    - runRules pure runner + RuleExecutionError
  affects:
    - Phase 3 (rule implementations plug directly into this engine)
    - Phase 4 (CLI wires runRules output to scoring + report builder)
tech_stack:
  added: []
  patterns:
    - Object.freeze(RuleContext) for runtime immutability (D-14)
    - localeCompare('en', {sensitivity:'variant'}) for all deterministic sorts
    - RuleRegistry.applyOverrides returns NEW sealed registry (no mutation, ENG-03)
    - RuleExecutionError wraps rule throws with ruleId+toolId context (D-13)
    - vi.stubGlobal('fetch', () => Promise.reject(...)) for network-block sentinel (D-14)
key_files:
  created:
    - packages/linter/src/engine/types.ts
    - packages/linter/src/config/types.ts
    - packages/linter/src/engine/registry.ts
    - packages/linter/src/engine/runner.ts
    - tests/engine/registry.test.ts
    - tests/engine/runner.test.ts
    - tests/engine/frozen-ctx.test.ts
    - tests/engine/network-block.test.ts
  modified:
    - packages/linter/src/index.ts (engine + config exports appended; existing exports preserved)
decisions:
  - "RuleContext uses Object.freeze (shallow) at call site in runner — deep freeze deferred to Phase 3 per RESEARCH.md open question #3; shallow is sufficient for trusted built-in rules"
  - "'off' severity handled as string sentinel in runRules — Severity type from @voke/core only includes 'error'|'warning'|'info'|'hint'; 'off' is a special engine-layer concept"
  - "network-block stub uses Promise.reject (not synchronous throw) — fetch() always returns Promise; synchronous throw is not awaitable via .rejects.toThrow()"
metrics:
  duration_minutes: 6
  completed_date: "2026-06-12"
  tasks_completed: 3
  files_changed: 9
---

# Phase 02 Plan 03: Rule Engine (Types, Registry, Runner) Summary

**One-liner:** Spectral-shaped rule engine with frozen RuleContext, sealed non-mutating RuleRegistry, deterministically sorted findings, fail-fast RuleExecutionError, and network-block test infrastructure — ENG-01/02/03 and D-13/D-14 satisfied.

## What Was Built

### Task 1: Engine type contracts + VokeConfig stub (commit 363722a)

Created `packages/linter/src/engine/types.ts` with the full runtime type system:
- `RuleTarget = 'tool' | 'server'`
- `FindingLocation { tool: string; path: string[] }`
- `Finding` — extends `@voke/core` Finding with location/message/fixHint (intentionally separate type, not re-exported under same name)
- `RuleContext { readonly tool: ToolSnapshot | null; readonly surface: ReadonlyArray<ToolSnapshot>; readonly config: Readonly<VokeConfig> }`
- `RuleFunction = (ctx: RuleContext) => Finding[]`
- `RuleDefinition` — full rule descriptor with id, description, dimension, target, defaultSeverity, fixHint, mtqsVersion, fn

Created `packages/linter/src/config/types.ts` with `VokeConfig { severityOverrides?, minScore? }` stub. Full Zod loader deferred to Phase 4.

All types reuse `Severity` and `DimensionId` from `@voke/core` — none redefined. `ToolSnapshot` imported from `../ingestion/types.js`.

### Task 2: RuleRegistry (TDD, commit 365bdf1)

Implemented `packages/linter/src/engine/registry.ts`:
- `register()` throws `"Registry sealed; cannot register {id}"` or `"Duplicate rule id: {id}"`
- `seal()` returns `this` (fluent)
- `list()` returns rules sorted by `localeCompare('en', {sensitivity:'variant'})`
- `applyOverrides()` constructs a `new RuleRegistry()`, registers clones with overrides, returns `.seal()` — never mutates the original
- `createDefaultRegistry()` returns an empty sealed registry (Phase 3 will register real rules here)

Written test-first: 21 tests in `tests/engine/registry.test.ts` covering all behaviors including a proof that `applyOverrides` does not mutate the original registry.

### Task 3: Pure runner + network-block test infra (TDD, commit 7271ac0)

Implemented `packages/linter/src/engine/runner.ts`:
- `runRules(surface, registry, config) => Finding[]`
  - Sorts surface by `toolId` (localeCompare en variant)
  - Iterates `registry.list()` (sorted by id — determinism point #4)
  - Resolves severity via `config.severityOverrides[id] ?? rule.defaultSeverity`; skips `'off'` rules
  - Per-tool rules: `Object.freeze({ tool, surface, config })` passed once per tool
  - Server rules: `Object.freeze({ tool: null, surface, config })` called once
  - Rule fn throws → `throw new RuleExecutionError(ruleId, toolId, err)` immediately (D-13)
  - Returns findings sorted `toolId → ruleId → path.join('.')` (all localeCompare en variant)
- `RuleExecutionError extends Error` with `ruleId`, `toolId`, `cause` properties

Written test-first: 26 tests across:
- `tests/engine/runner.test.ts` — per-tool routing, server routing, finding sort, severity override/off, fail-on-throw, empty surface/registry, determinism
- `tests/engine/frozen-ctx.test.ts` — mutation of `ctx.tool` throws, `Object.assign` to ctx throws, server ctx mutation throws, pure read-only access does not throw
- `tests/engine/network-block.test.ts` — D-14 sentinel proving `vi.stubGlobal('fetch', ...)` mechanism works for Phase 3 purity tests

## Verification

- `npm run typecheck` (tsc --build): PASS
- `npm test -- tests/engine/`: 47 tests pass (registry: 21, runner+frozen+network-block: 26)
- Full suite: 147 tests pass across 17 test files (no regressions)
- `createDefaultRegistry()` returns sealed empty registry — confirmed by 3 dedicated tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] network-block test stub needed Promise.reject not synchronous throw**
- **Found during:** Task 3 (RED phase)
- **Issue:** RESEARCH.md Pattern 13 shows `vi.stubGlobal('fetch', () => { throw ... })` (synchronous throw). However, `fetch()` always returns a Promise — `await expect(fetch(...)).rejects.toThrow()` cannot catch a synchronous throw; the stub must return `Promise.reject()`
- **Fix:** Changed stub to `() => Promise.reject(new Error('Network blocked in tests'))`
- **Files modified:** `tests/engine/network-block.test.ts`
- **Commit:** 7271ac0 (included in main Task 3 commit)

**2. [Rule 1 - Bug] Type cast `as ReadonlyArray<ToolSnapshot>` from `null` type failed tsc**
- **Found during:** Task 3 (typecheck after implementation)
- **Issue:** Test variable typed as `ReadonlyArray<ToolSnapshot> | null` — direct cast caused `TS2352: Conversion of type 'null' to type 'readonly ToolSnapshot[]' may be a mistake`
- **Fix:** Changed cast to `as unknown as ReadonlyArray<ToolSnapshot>` (double assertion)
- **Files modified:** `tests/engine/runner.test.ts`
- **Commit:** 7271ac0 (included in main Task 3 commit)

## Known Stubs

- `VokeConfig` in `packages/linter/src/config/types.ts` — Zod loader + ConfigError (exit 7) deliberately deferred to Phase 4. The type itself is complete; only the parser stub is omitted. This is intentional and tracked in the Phase 4 plan.
- `createDefaultRegistry()` returns an empty registry — intentional for Phase 2. Phase 3 will add real rule registrations.

## Self-Check: PASSED
