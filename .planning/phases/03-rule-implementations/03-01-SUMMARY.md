---
phase: 03-rule-implementations
plan: 01
subsystem: testing
tags: [vitest, ajv, json-schema-2020-12, mtqs, rules, schema]

# Dependency graph
requires:
  - phase: 02-engine-ingestion-determinism
    provides: "RuleDefinition/RuleContext/Finding types, isValidJsonSchema2020/hasExternalRef/schemaDepth helpers"
provides:
  - "schemaRules: RuleDefinition[] exporting 8 Schema Correctness rules S01-S08"
  - "Positive fixture (schema-pass.json) firing zero schema findings"
  - "Negative fixtures (schema-fail.json) with one defect per rule"
  - "51 vitest tests covering positive, negative, and network-block scenarios"
affects: [03-05-integration, 04-cli]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RuleDefinition literal with inline pure fn — no class, no closure state"
    - "makeFinding helper to DRY up Finding construction within a rule module"
    - "isBareSchema helper for S08 bare-{} property detection"
    - "Network-block test pattern: vi.stubGlobal('fetch', ...) in beforeEach per D-14"

key-files:
  created:
    - packages/linter/src/rules/schema.ts
    - tests/fixtures/rules/schema-pass.json
    - tests/fixtures/rules/schema-fail.json
    - tests/rules/schema.test.ts
  modified: []

key-decisions:
  - "S03 and S06 fire on structurally invalid schemas (type is wrong primitive type like number), not merely unknown keywords — JSON Schema 2020-12 allows additional keywords per spec; only type mismatches and required-not-array are reliably caught by ajv validateSchema with strict:false"
  - "S08 bare-property check uses Object.keys(schema).length === 0 — a property with any key (type, $ref, oneOf, anyOf, allOf, etc.) is not bare"
  - "S04 emits one finding per offending schema (inputSchema + outputSchema can both fire independently)"

patterns-established:
  - "Rule module pattern: local makeFinding + isBareSchema helpers, then one const per rule, export const schemaRules: RuleDefinition[] at bottom"

requirements-completed: [RULE-01, RULE-06]

# Metrics
duration: 7min
completed: 2026-06-12
---

# Phase 03 Plan 01: Schema Correctness Rules Summary

**8 MTQS Schema Correctness rules (S01-S08) as pure synchronous RuleDefinitions reusing ajv-backed schema-checks helpers, verified by 51 vitest tests under network-block stub**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-12T21:15:27Z
- **Completed:** 2026-06-12T21:22:13Z
- **Tasks:** 2 (combined into 1 commit per TDD flow)
- **Files modified:** 4 files created

## Accomplishments

- Implemented all 8 Schema Correctness rules (S01-S08) as pure `RuleDefinition` literals with verbatim severities and fixHints from `spec/mtqs-v0.1.yaml`
- Reused `isValidJsonSchema2020`, `hasExternalRef`, and `schemaDepth` from `schema-checks.ts` — zero duplicated ajv logic
- Created clean fixture (schema-pass.json) that fires zero findings and broken fixtures (schema-fail.json) with one defect per rule
- 51 tests covering: positive (each rule fires on bad fixture), negative (clean fixture fires nothing), network-block (all rules pure under blocked fetch)

## Task Commits

Each task was committed atomically (both tasks combined in one commit per TDD flow):

1. **Task 1 + Task 2: schemaRules S01-S08 + fixtures + tests** - `7e3a7d4` (feat)

**Plan metadata:** (created after this section)

## Files Created/Modified

- `packages/linter/src/rules/schema.ts` - 8 RuleDefinition exports as `schemaRules: RuleDefinition[]`
- `tests/fixtures/rules/schema-pass.json` - Clean ToolSnapshot firing zero schema findings
- `tests/fixtures/rules/schema-fail.json` - 8 broken ToolSnapshots, one defect per rule
- `tests/rules/schema.test.ts` - 51 tests with network-block pattern

## Decisions Made

- **S03/S06 invalid schema representation**: JSON Schema 2020-12 allows additional/unknown keywords (they're ignored); only type field mismatches (e.g., `type: 42` instead of a string) and `required` type errors (string instead of array) reliably trigger `isValidJsonSchema2020` returning false with `strict: false`. Updated test fixtures to use these structurally invalid schemas.
- **S08 bare-property detection**: `Object.keys(schema).length === 0` correctly identifies bare `{}` schemas. Properties with ANY keyword (type, $ref, oneOf, anyOf, allOf) are not bare and correctly pass.
- **S04 two-finding scenario**: When both inputSchema and outputSchema have external $refs, S04 emits two findings (one per schema) with paths `['inputSchema']` and `['outputSchema']` respectively.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixtures and test cases used wrong invalid-schema pattern for S03/S06**
- **Found during:** Task 1-2 (GREEN phase — tests failing)
- **Issue:** Initial fixtures used `{ type: 'object', unknownKeyword: 'bad' }` expecting S03/S06 to fire, but JSON Schema 2020-12 allows unknown keywords per spec; `isValidJsonSchema2020` with `strict: false` only fails on type-field mismatches and structural errors
- **Fix:** Updated `invalidInputSchema` fixture to `{ type: 42, properties: {} }` and `invalidOutputSchema` fixture to use `required: "string-not-array"`. Updated corresponding test assertions.
- **Files modified:** tests/fixtures/rules/schema-fail.json, tests/rules/schema.test.ts
- **Verification:** 51/51 tests pass, `npx tsc --noEmit -p packages/linter` exits 0
- **Committed in:** 7e3a7d4

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix required for correct test semantics — schema.ts implementation was correct; tests needed to reflect actual JSON Schema 2020-12 behavior. No scope creep.

## Issues Encountered

None beyond the test fixture adjustment documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `schemaRules` array is ready to be registered in the Wave 2 integration plan (03-05)
- All 8 rules verified deterministic and pure
- Fixtures (schema-pass.json, schema-fail.json) reusable by integration tests in 03-05

## Self-Check

- [x] `packages/linter/src/rules/schema.ts` exists and exports `schemaRules`
- [x] `tests/fixtures/rules/schema-pass.json` exists
- [x] `tests/fixtures/rules/schema-fail.json` exists
- [x] `tests/rules/schema.test.ts` exists
- [x] Commit `7e3a7d4` exists
- [x] `npx vitest run tests/rules/schema.test.ts` exits 0 (51 tests pass)
- [x] `npx tsc --noEmit -p packages/linter` exits 0

## Self-Check: PASSED

---
*Phase: 03-rule-implementations*
*Completed: 2026-06-12*
