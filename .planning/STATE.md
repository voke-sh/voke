---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: unknown
stopped_at: Completed 04-scoring-output-cli/04-01-PLAN.md
last_updated: "2026-06-12T23:04:12.309Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 16
  completed_plans: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-12)

**Core value:** `voke lint <server>` produces deterministic per-rule findings + a stable score against an explicit published ruleset — same input always yields same output
**Current focus:** Phase 04 — scoring-output-cli

## Current Position

Phase: 04 (scoring-output-cli) — EXECUTING
Plan: 2 of 3

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: N/A
- Total execution time: 0h

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: N/A
- Trend: N/A

*Updated after each plan completion*
| Phase 01-mtqs-specification P01 | 6 | 3 tasks | 11 files |
| Phase 01-mtqs-specification P04 | 2 | 2 tasks | 2 files |
| Phase 01-mtqs-specification P02 | 3 | 2 tasks | 3 files |
| Phase 01-mtqs-specification P03 | 60 | 3 tasks | 3 files |
| Phase 02-engine-ingestion-determinism P01 | 6 | 3 tasks | 9 files |
| Phase 02-engine-ingestion-determinism P02 | 16 | 3 tasks | 14 files |
| Phase 02-engine-ingestion-determinism P03 | 6 | 3 tasks | 9 files |
| Phase 02-engine-ingestion-determinism P04 | 3 | 2 tasks | 5 files |
| Phase 03-rule-implementations P04 | 4 | 2 tasks | 5 files |
| Phase 03-rule-implementations P03 | 4 | 1 tasks | 4 files |
| Phase 03-rule-implementations P02 | 324 | 2 tasks | 9 files |
| Phase 03-rule-implementations P01 | 7 | 2 tasks | 4 files |
| Phase 03-rule-implementations P05 | 5 | 2 tasks | 6 files |
| Phase 04-scoring-output-cli P01 | 6 | 3 tasks | 11 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: TypeScript confirmed as tech stack (to be locked in Phase 1)
- Roadmap: Spec-first enforced — no rule code before SPEC-01..05 complete
- Roadmap: Phase 2 is the highest-risk phase (determinism) — isolated before rules
- Roadmap: First demoable `voke lint` artifact is Phase 4 exit criterion
- [Phase 01-mtqs-specification]: id regex tightened to [SDNPA] not [A-Z] to enforce only valid v0.1 dimension letters at build time (Pitfall 5 guard)
- [Phase 01-mtqs-specification]: Integer-first arithmetic: Math.round per finding then sum integers, not float-sum then round — ensures cross-platform scoring determinism
- [Phase 01-mtqs-specification]: Hard tier caps implemented as min(rawScore, capValue) post-computation overrides, never additional deductions (Pitfall 3)
- [Phase 01-mtqs-specification]: Hard employer-conflict line documented in SCOPE.md: Voke is a read-only observer, never a gateway or proxy
- [Phase 01-mtqs-specification]: LLM-as-judge explicitly excluded from MTQS L1 with ICC-score rationale (0.62-0.90 not sufficient for CI gate)
- [Phase 01-mtqs-specification]: Scope-creep PR rule: primary source citation required, never Glama (documented in SCOPE.md §4)
- [Phase 01-mtqs-specification]: 22 rules in MTQS v0.1 (not 20) — plan had arithmetic error; all 22 IDs explicitly enumerated are correct
- [Phase 01-mtqs-specification]: MTQS-N03 is the only server-scoped rule; dimension weights locked: schema=1.5, annotations=1.5, description=1.2, parameters=1.2, naming=1.0
- [Phase 01-mtqs-specification]: D02 and D03 fire independently in MTQS — no rule-suppression logic; each rule fires on its own condition (search worked example corrected: deduction 62, raw 38, server 69/Tier D)
- [Phase 01-mtqs-specification]: MTQS-D02 worked-example correction applied post human review: description length check fires independently of description=name check; both D02 and D03 fire for 'search' tool
- [Phase 02-engine-ingestion-determinism]: canonicalJson uses .filter for undefined-omission mirroring JSON.stringify (Pitfall 7 guard); toolContentHash hashes exactly 5 canonical fields D-03
- [Phase 02-engine-ingestion-determinism]: schemaDepth composition rule: pass current (not nodeDepth) to branches so oneOf/allOf/anyOf adds 0 depth levels (D-05)
- [Phase 02-engine-ingestion-determinism]: NodeNext module shims: ambient module declarations in src/types/ajv.d.ts for ajv/dist/2020 and ajv-formats (both lack package.json exports)
- [Phase 02-engine-ingestion-determinism]: Object.freeze(RuleContext) is shallow in Phase 2; deep freeze deferred to Phase 3 per RESEARCH.md open question #3
- [Phase 02-engine-ingestion-determinism]: network-block stub uses Promise.reject (not synchronous throw) — fetch() always returns Promise; synchronous throw is not awaitable via .rejects.toThrow()
- [Phase 02-engine-ingestion-determinism]: buildReport sorts snapshot.tools by toolId defensively before building per-tool reports (sort-on-run for shuffle-invariance)
- [Phase 02-engine-ingestion-determinism]: serializeReportBody strips meta block via destructuring to produce wall-clock-free determinism body (D-02/D-12)
- [Phase 03-rule-implementations]: annotations:{} fires A02+A03 (warning) + A04+A05 (info) but not A01 — object presence is the gate
- [Phase 03-rule-implementations]: A06 uses strict boolean equality (=== true) for both readOnlyHint and destructiveHint, not truthiness
- [Phase 03-rule-implementations]: fixHints in rule files must be single-line strings matching YAML folded scalar collapsed output from loadRegistryFile
- [Phase 03-rule-implementations]: P02 heuristic uses two regex patterns (one-of, values:/options:/allowed:) as CLOSED_SET_PATTERNS const — conservative to avoid false positives while ensuring spec failing example fires
- [Phase 03-rule-implementations]: P01 treats empty string description same as absent description (fires P01); P02 only fires when description is non-empty (P01 covers the absence case)
- [Phase 03-rule-implementations]: D02 and D03 fire independently in MTQS — no rule-suppression; search tool fires both
- [Phase 03-rule-implementations]: MTQS-N03 is target:'server' — only server-scoped rule in v0.1; location.tool='' for server findings
- [Phase 03-rule-implementations]: S03/S06 fire on type-field mismatches (type:42) not unknown keywords — JSON Schema 2020-12 allows extra keywords per spec with strict:false
- [Phase 03-rule-implementations]: allRules defined as static array spread; fixHint parity uses .trim() on both sides; registry-coverage test uses dynamic for-loop over all 22 YAML entries for automatic new-rule coverage; full-surface test reads crm_search_contacts from committed fixture
- [Phase 04-scoring-output-cli]: UsageError kept in resolve-target.ts (not errors.ts) to avoid parallel wave conflicts in Phase 4 Wave 1
- [Phase 04-scoring-output-cli]: MULT and BASE exported from @voke/core barrel (previously missing, required by format-human)
- [Phase 04-scoring-output-cli]: Dimension weights always formatted to one decimal place (toFixed(1)) for consistent CLI output

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 research flag: depth-bound algorithm + oneOf-branch threshold for 2020-12 constraints needs a short spike before implementing ING-05
- Phase 2 research flag: confirm ajv Ajv2020 handles unevaluatedProperties/unevaluatedItems correctly

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260612-p42 | Restructure repo into npm workspaces monorepo (extract @voke/core) | 2026-06-12 | 8c5086a | [260612-p42-restructure-repo-into-npm-workspaces-mon](./quick/260612-p42-restructure-repo-into-npm-workspaces-mon/) |
| 260612-pd7 | Remove all em dashes from spec/MTQS-v0.1.md, prose editorial pass | 2026-06-12 | 212acf0 | [260612-pd7-remove-em-dashes-from-spec-mtqs-v0-1-md-](./quick/260612-pd7-remove-em-dashes-from-spec-mtqs-v0-1-md-/) |
| 260612-rm8 | Restructure §4 scoring formula: §4.0 formula-first, §4.3/§4.4 plain-English leads, §4.4 Rounding/Evaluation Order subheads | 2026-06-12 | ff1f9a0 | [260612-rm8-restructure-scoring-formula-section-of-s](./quick/260612-rm8-restructure-scoring-formula-section-of-s/) |

## Session Continuity

Last session: 2026-06-12T23:04:12.306Z
Stopped at: Completed 04-scoring-output-cli/04-01-PLAN.md
Resume file: None
