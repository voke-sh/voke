---
gsd_state_version: 1.0
milestone: v0.2
milestone_name: Doctor Badge
status: unknown
stopped_at: Completed 07-02-PLAN.md
last_updated: "2026-06-16T22:19:59.572Z"
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** `voke lint <server>` produces deterministic per-rule findings + a stable score against an explicit published ruleset — same input always yields same output
**Current focus:** Phase 07 — mtqs-score-badge

## Current Position

Phase: 07 (mtqs-score-badge) — EXECUTING
Plan: 2 of 2

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
| Phase 04 P03 | 179 | 2 tasks | 2 files |
| Phase 04-scoring-output-cli P03 | 10 | 3 tasks | 2 files |
| Phase 05-ci-publication P03 | 3 | 2 tasks | 8 files |
| Phase 05 P02 | 3 | 2 tasks | 5 files |
| Phase 05-ci-publication P01 | 9m | 3 tasks | 8 files |
| Phase 05-ci-publication P04 | 4 | 2 tasks | 4 files |
| Phase 06-launch P01 | 4 | 3 tasks | 3 files |
| Phase 06-launch P02 | 30m | 3 tasks | 1 files |
| Phase 07 P01 | 4 | 2 tasks | 2 files |
| Phase 07 P02 | 5 | 3 tasks | 4 files |

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
- [Phase 04]: Guard built binary with beforeAll existsSync check to give clear error if Plan 02 build not run
- [Phase 04]: JSON determinism uses deepEqual on meta-stripped parsed objects (not string compare) — string compare would fail on generatedAt by design (D-10)
- [Phase 04]: SC#4 gate threshold computed dynamically from live JSON run — keeps test robust against future fixture changes
- [Phase 04]: Masking PRIMARY test uses schemeless host to trigger D-06 UsageError (exit 3) before network — exercises real header-in-scope code path
- [Phase 04]: Live Apideck server at mcp.apideck.dev/mcp is a proxy exposing 4 meta-tools (not 229) — voke correctly ingests all server-exposed tools; determinism and scoring hold regardless of tool count
- [Phase 05-ci-publication]: VitePress base set to '/' for custom domain (voke.sh); CNAME in docs/public/ persists through re-deploys; spec files copied at build time, never symlinked
- [Phase 05]: Published as @voke-sh/voke (scoped) because unscoped voke is taken on npm (v1.0.2 exists)
- [Phase 05]: Moving major tag is v0 (not v1) — matches v0.x versioning; action.yml uses: voke-sh/voke@v0
- [Phase 05]: @voke/core removed from runtime dependencies (moved to devDependencies) — tsup bundles it via noExternal; leaving as runtime dep would 404 on npm install
- [Phase 05]: publish.yml uses contents:write (not contents:read) — v0 tag force-push requires write access
- [Phase 05-ci-publication]: Pre-split process.argv at '--' before commander sees it — simpler than passThroughOptions; avoids scheme misdetection
- [Phase 05-ci-publication]: StdioClientTransport receives only opts.extraEnv, not process.env — SDK merges getDefaultEnvironment() automatically (Pitfall 3 guard)
- [Phase 05-ci-publication]: server.url=null for stdio ingestion — no URL available for subprocess transport
- [Phase 05-ci-publication]: README uses @v0 tag (not @v1) -- v0.x releases move the v0 moving tag; @v1 does not exist until 1.0.0 release
- [Phase 05-ci-publication]: Rule PR template makes NOT-Glama a checkbox item -- impossible to overlook vs prose
- [Phase 05-ci-publication]: Spec URL in README uses voke-sh.github.io/voke/spec/ interim with voke.sh/spec noted as target domain
- [Phase 06-launch]: Apideck live score 62/100 Tier D confirmed from captured fixture (matches D-08 blog number)
- [Phase 06-launch]: DeepWiki live score 92/100 Tier A confirmed — strong second-server proof for PUB-04
- [Phase 06-launch]: Committed snapshots are reproducibility gate (not live network) — decouples DoD from server availability
- [Phase 06-launch]: Final published version is 0.1.1 (bump-patched from broken 0.1.0 live-lint hang); blog CTA must reference @voke-sh/voke@0.1.1
- [Phase 06-launch]: Live Apideck published verification: 62/100 Tier D, exit 0, zero drift from Plan 01 fixture (D-11 gate satisfied)
- [Phase 06-launch]: Root-cause fix: ingestLive now closes MCP transport in finally (commit 34d0e6f) — live lint no longer hangs / exits non-zero
- [Phase 06-launch]: 06-03 blog draft complete + stop-slop 41/50 (zero em dashes); dev.to publish DEFERRED by user — PUB-03 unmet, draft ready at blog-launch-post.md awaiting manual publish + live URL
- [Roadmap v0.2]: Badge SVG uses tierFor() from @voke/core as the single source of truth for A/B/C/D/F color thresholds (A>=90 green, B>=80 teal, C>=70 yellow, D>=60 orange, F<60 red)
- [Roadmap v0.2]: formatBadge(report) is a pure function analogous to existing formatHuman/formatJson — same side-effect-free formatter pattern; no Date/Math.random in the SVG output path
- [Roadmap v0.2]: --badge is a side output — does not alter --format stdout, --min-score gate, or exit codes; only error is a clear usage/write error (exit 3) if the path cannot be written
- [Phase 07]: SVG xmlns namespace URI (http://www.w3.org/2000/svg) is a required namespace declaration not a network reference — BADGE-02 constraint satisfied despite grep for http flagging it
- [Phase 07]: Used cicirello flat badge pattern (shadow via fill-opacity=.3, no Gaussian blur filter) — cleaner diff, fewer bytes, RESEARCH Open Question 1 resolved
- [Phase 07]: TIER_COLORS exported as public const for potential future use by badge-writer tests or other modules
- [Phase 07]: writeBadge call lives in program.ts AFTER process.stdout.write (D-10): guarantees lint result printed before badge write error; runLint stays IO-free
- [Phase 07]: Used spawnSync (not execFileSync) for e2e runCapture: captures both stdout and stderr on all exit codes including 0
- [Phase 07]: BADGE-08a JSON equality uses meta-stripped deepEqual: generatedAt in meta differs by wall-clock design (mirrors e2e-determinism.test.ts)

### Pending Todos

- [2026-06-14] Provide score badge for repository README (area: general) — embeddable MTQS score/grade badge like Glama; lean static SVG for L1
- [2026-06-16] Research: GitHub Camo image proxy SVG sanitization — confirm inline-style SVG with system fonts survives proxy; affects Phase 7 BADGE-02 implementation approach

### Blockers/Concerns

- None open. (Phase 2 depth-bound / Ajv2020 research flags resolved during ING-05 implementation.)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260612-p42 | Restructure repo into npm workspaces monorepo (extract @voke/core) | 2026-06-12 | 8c5086a | [260612-p42-restructure-repo-into-npm-workspaces-mon](./quick/260612-p42-restructure-repo-into-npm-workspaces-mon/) |
| 260612-pd7 | Remove all em dashes from spec/MTQS-v0.1.md, prose editorial pass | 2026-06-12 | 212acf0 | [260612-pd7-remove-em-dashes-from-spec-mtqs-v0-1-md-](./quick/260612-pd7-remove-em-dashes-from-spec-mtqs-v0-1-md-/) |
| 260612-rm8 | Restructure §4 scoring formula: §4.0 formula-first, §4.3/§4.4 plain-English leads, §4.4 Rounding/Evaluation Order subheads | 2026-06-12 | ff1f9a0 | [260612-rm8-restructure-scoring-formula-section-of-s](./quick/260612-rm8-restructure-scoring-formula-section-of-s/) |
| 260614-x3w | Improve verbose mode output: multi-line renderer with MTQS prefix stripping, eliminates doubled ruleId/severity | 2026-06-14 | 14ab295 | [260614-x3w-improve-verbose-mode-output-of-voke-lint](./quick/260614-x3w-improve-verbose-mode-output-of-voke-lint/) |
| 260615-egi | Improve MTQS-S03/S06 error messages: surface specific ajv failure (keyword + schemaPath + reason), prefix preserved, deterministic cap at 3 | 2026-06-15 | 9752b32 | [260615-egi-improve-mtqs-s03-error-messages-with-spe](./quick/260615-egi-improve-mtqs-s03-error-messages-with-spe/) |

## Session Continuity

Last session: 2026-06-16T22:19:59.570Z
Stopped at: Completed 07-02-PLAN.md
Resume file: None
