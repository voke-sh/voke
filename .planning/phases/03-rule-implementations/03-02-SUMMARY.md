---
phase: 03-rule-implementations
plan: "02"
subsystem: linter-rules
tags: [rules, description, naming, tdd, mtqs-d01, mtqs-d02, mtqs-d03, mtqs-n01, mtqs-n02, mtqs-n03]
dependency_graph:
  requires: []
  provides:
    - packages/linter/src/rules/description.ts (descriptionRules D01-D03)
    - packages/linter/src/rules/naming.ts (namingRules N01-N03)
  affects:
    - packages/linter/src/engine/registry.ts (will register in 03-05)
tech_stack:
  added: []
  patterns:
    - TDD (RED-GREEN cycle per task)
    - Pure RuleDefinition functions (no IO, no Date.now, no fetch)
    - vi.stubGlobal network-block in beforeEach
    - server-scoped rule pattern (target:'server', ctx.tool=null, reads ctx.surface)
key_files:
  created:
    - packages/linter/src/rules/description.ts
    - packages/linter/src/rules/naming.ts
    - tests/rules/description.test.ts
    - tests/rules/naming.test.ts
    - tests/fixtures/rules/description-pass.json
    - tests/fixtures/rules/description-fail.json
    - tests/fixtures/rules/naming-pass.json
    - tests/fixtures/rules/naming-fail.json
    - tests/fixtures/rules/naming-duplicate-surface.json
  modified: []
decisions:
  - "D02 and D03 fire independently — no suppression: search tool produces exactly [MTQS-D02, MTQS-D03]"
  - "N03 is target:'server' (only server-scoped rule in MTQS v0.1); location.tool='' per engine convention"
  - "Spec example name for N01 is actually 144 chars (not 141 as stated in spec prose); test uses actual count"
metrics:
  duration_seconds: 324
  completed_date: "2026-06-12"
  tasks_completed: 2
  files_created: 9
  files_modified: 0
  tests_added: 55
---

# Phase 03 Plan 02: Description and Naming Rules Summary

**One-liner:** D01-D03 description rules + N01-N03 naming rules implemented as pure RuleDefinitions with independent firing and server-scoped duplicate detection.

## What Was Built

### Task 1: descriptionRules D01-D03

`packages/linter/src/rules/description.ts` exports `descriptionRules: RuleDefinition[]` with three rules:

- **MTQS-D01** (error, target:'tool'): fires when `tool.description` is absent or empty string; silent on non-empty.
- **MTQS-D02** (warning, target:'tool'): fires when `tool.description.length < 20`; interpolates actual count in message; independent of D03.
- **MTQS-D03** (error, target:'tool'): fires when `tool.description === tool.name` (strict byte-for-byte equality); independent of D02.

Key invariant proven: the `search` tool (`name:'search'`, `description:'search'`) fires **both** D02 (length 6 < 20) and D03 (description === name), with D01 silent (description is non-empty). No rule-suppression logic exists in either rule.

Severities and fixHints are verbatim from `spec/mtqs-v0.1.yaml`. Tests cross-check both against the YAML registry.

### Task 2: namingRules N01-N03

`packages/linter/src/rules/naming.ts` exports `namingRules: RuleDefinition[]` with three rules:

- **MTQS-N01** (error, target:'tool'): fires on absent/empty name or `name.length > 128`; message interpolates actual length.
- **MTQS-N02** (error, target:'tool'): fires when `tool.name` matches `/[^A-Za-z0-9_\-./]/`; names like "search contacts, all" trigger it.
- **MTQS-N03** (error, target:**'server'**): reads `ctx.surface` (ctx.tool is null); builds `Map<name, count>`; emits one finding per duplicated name with `location.tool=''`; names iterated in sorted order for deterministic output.

N03 is the only server-scoped rule in MTQS v0.1 and is the reference implementation for the engine's server-aggregate routing pattern.

## Test Coverage

| Module | Tests | Key assertions |
|--------|-------|---------------|
| description.test.ts | 27 | D01-D03 per-rule positive+negative, search worked example, fixture-based, spec cross-check, network-block |
| naming.test.ts | 28 | N01-N03 per-rule positive+negative, N03 server-scoped null-tool + location.tool='', fixture-based, spec cross-check, network-block |

All 55 tests pass. Both modules pass `npx tsc --noEmit -p packages/linter`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Spec prose name-length mismatch corrected in test**

- **Found during:** Task 2, N01 test (GREEN phase)
- **Issue:** The MTQS-v0.1.md spec prose states the example name is "141 characters" but the actual name string `search_for_contacts_in_the_crm_system_using_multiple_criteria_including_name_email_phone_and_company_with_pagination_support_and_sorting_options` is 144 characters. The rule implementation correctly reports the actual length (144). Tests were updated to assert `'144'` rather than `'141'` to match reality.
- **Fix:** Updated test assertion from `toContain('141')` to `toContain('144')` and updated inline comment.
- **Files modified:** `tests/rules/naming.test.ts`
- **Commit:** 0ad03c3 (test commit, pre-fix) / 9d60409 (final green)

## Known Stubs

None. All rule functions are fully implemented with real logic.

## Commits

| Commit | Description |
|--------|-------------|
| 5f02e64 | test(03-02): add failing tests for descriptionRules D01-D03 |
| b3dfb91 | feat(03-02): implement descriptionRules D01-D03 with fixtures |
| 0ad03c3 | test(03-02): add failing tests for namingRules N01-N03 |
| 9d60409 | feat(03-02): implement namingRules N01-N02 (per-tool) + N03 (server-scoped) |

## Self-Check: PASSED

All 9 created files exist on disk. All 4 plan commits found in git history:
- 5f02e64: test(03-02): add failing tests for descriptionRules D01-D03
- b3dfb91: feat(03-02): implement descriptionRules D01-D03 with fixtures
- 0ad03c3: test(03-02): add failing tests for namingRules N01-N03
- 9d60409: feat(03-02): implement namingRules N01-N02 (per-tool) + N03 (server-scoped)
