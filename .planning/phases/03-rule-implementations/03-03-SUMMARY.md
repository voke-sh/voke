---
phase: 03-rule-implementations
plan: 03
subsystem: linter
tags: [mcp, mtqs, rules, parameters, ajv, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-engine-ingestion-determinism
    provides: RuleDefinition/RuleContext/Finding types, engine runner, RuleRegistry
provides:
  - parameterRules: RuleDefinition[] for MTQS-P01 and MTQS-P02 (parameter semantics dimension)
  - tests/rules/parameters.test.ts: 37 tests covering P01/P02 positive+negative cases with network-block
  - tests/fixtures/rules/parameters-pass.json and parameters-fail.json: spec passing/failing examples
affects: [03-05-integration, CLI output, scoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-property rule pattern: iterate inputSchema.properties, emit one Finding per violating property"
    - "Pure regex heuristic for P02 closed-set detection: CLOSED_SET_PATTERNS const with explanatory comment"
    - "Type narrowing without 'any': getProperties/getStringField helpers narrow unknown to typed objects"
    - "TDD: RED commit (failing test) before GREEN commit (implementation)"

key-files:
  created:
    - packages/linter/src/rules/parameters.ts
    - tests/rules/parameters.test.ts
    - tests/fixtures/rules/parameters-pass.json
    - tests/fixtures/rules/parameters-fail.json

key-decisions:
  - "P02 heuristic uses two regex patterns (/\\bone\\s+of\\b/i and /\\b(values|options|allowed)\\s*:/i) documented as CLOSED_SET_PATTERNS const — conservative to avoid false positives while ensuring spec failing example fires"
  - "P01 and P02 share the same getProperties() guard: absent or non-object inputSchema.properties returns [] with no findings"
  - "Properties with empty string description fire P01 (treated as 'no description')"
  - "P02 does not fire for properties without description (P01 covers those)"

patterns-established:
  - "Per-property rule iteration: for (const [propName, propSchema] of Object.entries(properties))"
  - "findHint VERBATIM pattern: copy fixHint exactly from spec/mtqs-v0.1.yaml"
  - "Network-block stub: vi.stubGlobal in beforeEach, vi.unstubAllGlobals in afterEach"

requirements-completed: [RULE-04, RULE-06]

# Metrics
duration: 4min
completed: 2026-06-12
---

# Phase 03 Plan 03: Parameter Semantics Rules Summary

**MTQS-P01 and MTQS-P02 implemented as pure per-property RuleDefinitions with a deterministic documented P02 closed-set regex heuristic; 37 tests green; spec examples exercised**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-12T21:16:29Z
- **Completed:** 2026-06-12T21:20:33Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments
- Implemented P01 (MTQS-P01): fires once per `inputSchema.properties` entry with no non-empty description; covers the Opaque Parameters smell (84.3% prevalence per arxiv:2602.14878)
- Implemented P02 (MTQS-P02): fires for `type: 'string'` properties without `enum` whose description text signals a finite value set, using a documented pure regex heuristic (`CLOSED_SET_PATTERNS`)
- 37 tests pass covering positive/negative cases, spec worked examples, YAML registry cross-check (defaultSeverity + fixHint verbatim), and D-14 network-block purity guard
- Zero TypeScript errors (`npx tsc --noEmit -p packages/linter` exits 0)

## Task Commits

1. **RED phase (failing tests + fixtures)** - `a24b402` (test)
2. **GREEN phase (implementation)** - `b2db751` (feat)

## Files Created/Modified
- `packages/linter/src/rules/parameters.ts` - Exports `parameterRules: RuleDefinition[]` for P01 and P02
- `tests/rules/parameters.test.ts` - 37 tests; network-block stub; YAML cross-check
- `tests/fixtures/rules/parameters-pass.json` - Passing tool (all described + status uses enum)
- `tests/fixtures/rules/parameters-fail.json` - Failing tools for P01 (user_id+include_deleted undescribed) and P02 (free-text status "One of: ...")

## Decisions Made
- P02 heuristic uses exactly two patterns: `/\bone\s+of\b/i` and `/\b(values|options|allowed)\s*:/i` — conservative to avoid false positives; the canonical failing example "Filter by status. One of: active, inactive, pending." fires
- P01 treats `description: ""` (empty string) as "no description" — fires P01 just like a missing description key
- Both rules guard on `inputSchema.properties` absence: no properties object means no P findings (not an error, just silent)
- fixHints are VERBATIM from `spec/mtqs-v0.1.yaml` per plan requirement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The TDD approach (RED → GREEN) worked cleanly. The only adjustment was removing `Date.now()` and `Math.random()` from a comment line that would have been flagged by the acceptance criteria grep pattern.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `parameterRules` is ready for registration in `packages/linter/src/engine/registry.ts` via Wave 2 integration plan (03-05)
- Both rules are pure, have no dependencies on other rule modules, and produce deterministic findings
- The `tests/fixtures/rules/` directory now contains fixtures for parameters (and likely schema/naming/annotations from parallel plans) ready for integration testing

## Known Stubs
None - both P01 and P02 are fully implemented with real data-driven logic.

## Self-Check: PASSED

- FOUND: packages/linter/src/rules/parameters.ts
- FOUND: tests/rules/parameters.test.ts
- FOUND: tests/fixtures/rules/parameters-pass.json
- FOUND: tests/fixtures/rules/parameters-fail.json
- FOUND: .planning/phases/03-rule-implementations/03-03-SUMMARY.md
- FOUND commit: a24b402 (RED test phase)
- FOUND commit: b2db751 (GREEN implementation)
- `npx vitest run tests/rules/parameters.test.ts` — 37 tests pass
- `npx tsc --noEmit -p packages/linter` — exits 0

---
*Phase: 03-rule-implementations*
*Completed: 2026-06-12*
