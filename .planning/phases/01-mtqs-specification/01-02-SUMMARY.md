---
phase: 01-mtqs-specification
plan: "02"
subsystem: spec
tags: [yaml, zod, vitest, mtqs, registry, mcp, json-schema]

requires:
  - phase: 01-mtqs-specification/01-01
    provides: spec/registry-types.ts (RuleRegistryEntrySchema, RuleRegistrySchema), spec/helpers/loadRegistry.ts (loadRegistryFile)

provides:
  - spec/mtqs-v0.1.yaml — machine-readable rule registry, single source of truth for all 22 MTQS v0.1 rules
  - tests/spec/registry.schema.test.ts — Zod validation gate (SPEC-04)
  - tests/spec/registry.rules.test.ts — 22-rule completeness, uniqueness, source non-Glama, weight checks (SPEC-03)

affects:
  - 01-03 (spec doc prose — consumes registry IDs and fix hints)
  - phase-02 (linter engine — loads registry to get rule IDs and weights)
  - phase-04 (CLI — score formula uses weights from registry)

tech-stack:
  added: []
  patterns:
    - "YAML registry as single source of truth: loadRegistryFile validates through Zod at parse time"
    - "TDD pattern: test expectations defined over exact EXPECTED_IDS array against live registry"
    - "Weight-by-dimension lookup map for test assertions"

key-files:
  created:
    - spec/mtqs-v0.1.yaml
    - tests/spec/registry.schema.test.ts
    - tests/spec/registry.rules.test.ts
  modified: []

key-decisions:
  - "22 rules in v0.1, not 20 — plan had arithmetic error (8+3+3+2+6=22); all 22 IDs explicitly enumerated in plan are correct"
  - "MTQS-N03 is the only server-scoped rule; all others are per-tool"
  - "Dimension weights locked: schema=1.5, annotations=1.5, description=1.2, parameters=1.2, naming=1.0"
  - "All sources cite primary references (MCP spec, Anthropic blog, JSON Schema 2020-12, SEP-986); zero Glama references"

patterns-established:
  - "Rule ID format: MTQS-[SDNPA]NN where dimension letter maps to schema/description/naming/parameters/annotations"
  - "Every registry entry requires 9 fields: id, severity, dimension, scope, weight, description, fixHint, source, mtqsVersion"
  - "Tests use beforeAll to load registry once; per-rule assertions use descriptive error messages for easier debugging"

requirements-completed: [SPEC-03, SPEC-04]

duration: 3min
completed: "2026-06-12"
---

# Phase 01 Plan 02: MTQS v0.1 Rule Registry Summary

**22-rule YAML registry locked as single source of truth with Zod validation gate and completeness/uniqueness/source tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-12T13:05:12Z
- **Completed:** 2026-06-12T13:08:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Authored `spec/mtqs-v0.1.yaml` with all 22 MTQS v0.1 P1 rules across 5 dimensions (8 schema + 3 description + 3 naming + 2 parameters + 6 annotations)
- Every entry has 9 required fields validated against `RuleRegistryEntrySchema` at parse time via `loadRegistryFile`
- Added `tests/spec/registry.schema.test.ts` — SPEC-04 Zod gate: verifies `loadRegistryFile('spec/mtqs-v0.1.yaml')` does not throw
- Added `tests/spec/registry.rules.test.ts` — SPEC-03 gate: 8 tests covering count, ID set completeness, no duplicates, ID regex, non-Glama sources, fixHint length, and dimension weights

## Final 22-rule ID/Severity/Dimension/Weight Table

| Rule ID | Severity | Dimension | Scope | Weight |
|---------|----------|-----------|-------|--------|
| MTQS-S01 | error | schema | per-tool | 1.5 |
| MTQS-S02 | error | schema | per-tool | 1.5 |
| MTQS-S03 | error | schema | per-tool | 1.5 |
| MTQS-S04 | error | schema | per-tool | 1.5 |
| MTQS-S05 | warning | schema | per-tool | 1.5 |
| MTQS-S06 | error | schema | per-tool | 1.5 |
| MTQS-S07 | warning | schema | per-tool | 1.5 |
| MTQS-S08 | warning | schema | per-tool | 1.5 |
| MTQS-D01 | error | description | per-tool | 1.2 |
| MTQS-D02 | warning | description | per-tool | 1.2 |
| MTQS-D03 | error | description | per-tool | 1.2 |
| MTQS-N01 | error | naming | per-tool | 1.0 |
| MTQS-N02 | error | naming | per-tool | 1.0 |
| MTQS-N03 | error | naming | **server** | 1.0 |
| MTQS-P01 | warning | parameters | per-tool | 1.2 |
| MTQS-P02 | warning | parameters | per-tool | 1.2 |
| MTQS-A01 | info | annotations | per-tool | 1.5 |
| MTQS-A02 | warning | annotations | per-tool | 1.5 |
| MTQS-A03 | warning | annotations | per-tool | 1.5 |
| MTQS-A04 | info | annotations | per-tool | 1.5 |
| MTQS-A05 | info | annotations | per-tool | 1.5 |
| MTQS-A06 | error | annotations | per-tool | 1.5 |

**MTQS-N03 is the ONLY server-scoped rule — confirmed.**

## Source URLs by Dimension

| Dimension | Primary Source URL |
|-----------|-------------------|
| schema (S01, S02, S04, S05) | https://modelcontextprotocol.io/specification/draft/basic/index#json-schema-usage |
| schema (S03, S06, S07, S08) | https://json-schema.org/draft/2020-12 |
| description (D01, D02, D03) | https://www.anthropic.com/engineering/writing-tools-for-agents |
| naming (N01, N02, N03) | https://modelcontextprotocol.io/seps/986-specify-format-for-tool-names |
| parameters (P01, P02) | https://www.anthropic.com/engineering/writing-tools-for-agents |
| annotations (A01–A06) | https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts |

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the 20-rule YAML registry** - `210269a` (feat)
2. **Task 2: Registry schema-validation + completeness/uniqueness tests** - `b93b028` (test)

**Plan metadata:** (forthcoming docs commit)

## Files Created/Modified

- `spec/mtqs-v0.1.yaml` — 22-entry rule registry, single source of truth for MTQS v0.1
- `tests/spec/registry.schema.test.ts` — SPEC-04 Zod validation gate (1 test)
- `tests/spec/registry.rules.test.ts` — SPEC-03 completeness/uniqueness/source/weight checks (7 tests)

## Decisions Made

- **22 rules not 20**: The plan's stated count of "20" is an arithmetic error (8+3+3+2+6=22). All 22 IDs are explicitly enumerated in the plan; implemented all 22.
- **MTQS-N03 scope=server**: The only rule that operates at server scope, checking for duplicate tool names across the entire tool list.
- **Description wording**: Used YAML block scalar `>` form for multi-line descriptions and fixHints, consistent with the sample entries in 01-RESEARCH.md.
- **S05 label**: Description explicitly notes "MTQS-RECOMMENDED, not MCP-mandated" to distinguish from spec-mandated depth limits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected rule count from 20 to 22**
- **Found during:** Task 1 (YAML authoring)
- **Issue:** Plan states "exactly 20 entries" but the explicit enumeration (8 schema + 3 description + 3 naming + 2 parameters + 6 annotations) sums to 22. The FEATURES.md MVP section also says "20 rules" with the same groups — consistent documentation arithmetic error.
- **Fix:** Implemented all 22 explicitly listed rules; updated EXPECTED_IDS in test to match actual count; noted deviation here.
- **Files modified:** spec/mtqs-v0.1.yaml, tests/spec/registry.rules.test.ts
- **Verification:** All tests pass; all 22 explicitly specified IDs present
- **Committed in:** 210269a (Task 1), b93b028 (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 1 — arithmetic error in plan)
**Impact on plan:** The 22-rule count matches every explicitly enumerated rule in the plan. Zero scope creep.

## Issues Encountered

None beyond the arithmetic discrepancy in the plan's stated count.

## Known Stubs

None — all registry fields are fully populated with real content.

## Next Phase Readiness

- `spec/mtqs-v0.1.yaml` is the locked registry; Plan 03 (spec doc prose) and Phase 2 (linter engine) can consume it
- All 8 registry tests green; full suite (26 tests) green
- SPEC-03 and SPEC-04 satisfied; SPEC-01 source field satisfied for all 22 rules
- Remaining Phase 1 plans: Plan 03 (MTQS-v0.1.md spec doc) and Plan 04 (SCOPE.md)

---
*Phase: 01-mtqs-specification*
*Completed: 2026-06-12*
