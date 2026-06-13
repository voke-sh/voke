# Voke

## What This Is

Voke is an open-source observability platform for MCP servers, built as a layered roadmap (L1–L6). **The current build target is L1: the MCP Tool Quality Specification (MTQS) — an open, versioned, deterministic, auditable ruleset for MCP tool quality — shipped with a reference linter (`voke lint`) that runs locally and in any CI.** It answers "is this tool well-designed for an agent?" without a model in the loop. Built for developers who ship MCP servers and need a CI-gradeable quality signal.

## Core Value

`voke lint <server>` produces **deterministic** per-rule findings + a stable per-tool and server score against an explicit, published ruleset — same input always yields same output. Determinism is the entire wedge against the incumbent (Glama's closed, non-reproducible LLM-judge score). If everything else fails, this must hold.

## Requirements

### Validated

- [x] Author MTQS v0.1 spec (per-dimension rubrics, scoring formula + A–F tiers, rule IDs + severities, extensibility section) — original, justified from primary sources, explicitly NOT Glama-derived — **Validated in Phase 1: MTQS Specification.** 22 rules across 5 dimensions; `spec/MTQS-v0.1.md` + machine-readable `spec/mtqs-v0.1.yaml` registry + `spec/SCOPE.md`; deterministic integer-first scoring; 31 spec tests gate doc↔registry sync, completeness, and no-Glama derivation (SPEC-01..05)
- [x] Rule engine + result type, shaped so L2 (diff) and custom rules slot in later — **Validated in Phase 2: Engine + Ingestion + Determinism.** Pure `(ctx)=>Finding[]` rules on a frozen `RuleContext`; sealing `RuleRegistry` with `applyOverrides` returning a new registry; per-tool vs server-scoped routing; fail-on-throw `RuleExecutionError`; network-block test proves purity (ENG-01..03, D-14)
- [x] Tool-surface ingestion: connect via MCP SDK + pull `tools/list`; also read a saved tool dump; target JSON Schema 2020-12 — **Validated in Phase 2: Engine + Ingestion + Determinism.** Streamable-HTTP + SSE fallback, paginated `fetchAllTools` (fail-fast on partial page), header auth + masking; offline snapshot reader with zero SDK/network; Ajv2020 validity + depth cap (32) + external-`$ref` detection with no IO; canonicalize (sorted-key JSON, SHA-256 content hash). Determinism proof: byte-identical x3 + shuffle-invariant on Apideck fixture (`tests/engine/determinism.test.ts`). 163 tests green (ENG-04, ING-01..05, D-12)
- [x] Implement MTQS rules as the reference linter — **Validated in Phase 3: Rule Implementations.** All 22 v0.1 rules as pure synchronous `(ctx)=>Finding[]` functions across 5 dimension modules (S01–S08, D01–D03, N01–N03, P01–P02, A01–A06); each with positive + negative fixtures; `createDefaultRegistry()` seals exactly 22 rules with bidirectional doc↔registry parity vs `spec/mtqs-v0.1.yaml`; full surface reproduces spec §4.4 worked-example (search=38/F, crm_search_contacts=100/A, server=69/D); N03 sole server-scoped rule; A06 cross-constraint; network blocked in all rule tests, no IO. 500 tests green (RULE-01..06)
- [x] `voke lint` CLI: per-rule findings + per-tool + server score + tier; `--min-score` exit code — **Validated in Phase 4: Scoring + Output + CLI.** Full pipeline `resolveTarget → ingest(live|file) → runRules(createDefaultRegistry()) → buildReport → format`; commander program with `--min-score`/`--output`/`--ci`/`--header`/`--timeout`, D-13 exit-code map (gate 0/1, ingest 2/4/6, usage 3, internal 70), header/token masking (D-15/16); human formatter (uncolored banner, fixed-order weights, below-A tool table) + canonical JSON (D-10); self-contained `dist/cli/index.js` binary (tsup bundles @voke/core). Live `voke lint https://mcp.apideck.dev/mcp` → 62/100 Tier D, byte-identical across runs. 604 tests green (SCORE-01/02, OUT-01/02, CLI-01/02/03)

### Active

<!-- L1 scope. Building toward these. -->
- [ ] GitHub Action wrapper + YAML config + README that doubles as the demo
- [ ] Publish spec at voke.sh/spec (versioned, public repo, PRs open); linter declares which MTQS version it implements
- [ ] Launch blog post: run live against the Apideck MCP server (4-tool proxy surface) + ≥1 other public server

### Out of Scope

<!-- Explicit boundaries for this milestone (L1). -->

- **L2 diff / breaking-change gate** — next layer; designed-for, not built now. L1 data model must leave room (snapshots, stable per-tool identity, score deltas)
- **L3 runtime health** (scheduler/state machine/alert envelope) — preserved in PRD §8; not this milestone
- **L4 eval (model-in-the-loop)** — the moat; the ONE place a model belongs, deliberately kept out of L1 so the L1 signal stays deterministic
- **L5 analytics / L6 governance** — stubs
- **LLM-as-judge anywhere in L1** — non-determinism in a CI signal is a trust failure; that is the thing we are beating
- **Copying Glama's scoring system** — hard owner rule; MTQS synthesized from primary sources only
- **Hosted infra / paging / on-call** — creates an on-call obligation; conflicts with solo part-time constraint
- **MCP gateway/proxy / unified-API / connector** — hard line, employer-conflict boundary; Voke is a user/observer of MCP servers, never a gateway
- **Paid surface in MVP** — eval/hosted/cross-client are deferred open-core candidates

## Context

- **Strategic bet (PRD §4):** L1 is not "a linter," it is an open specification (ESLint/WCAG/AsyncAPI model) for which the linter is the reference implementation. Own the standard → own the ecosystem. The L1 quality-spec seat is effectively empty; the only occupant (Glama) holds it with a closed proprietary score.
- **Rule sources (PRD §6.2):** Anthropic "Writing effective tools for agents" (Sep 2025, gold-standard); the MCP specification (tool definition + five annotations + proposed sensitiveHint/egressHint); JSON Schema 2020-12 best practice; academic "MCP Tool Descriptions Are Smelly."
- **Rule format (PRD §6.4):** model on Spectral (id, severity, `given` target, `then`/function assertion) — native-feeling to anyone who has linted an API spec; clean path to custom/vendor rules.
- **Candidate dimensions (PRD §6.3):** Description-as-prompt; Parameter semantics; Naming & namespacing; Behavioral transparency (annotations); Output & token efficiency; Schema correctness; Surface coherence (server-level). Finalized in the spec doc.
- **Tailwind (PRD §11):** MCP RC (announced May 21 2026, targets 2026-07-28) lifts input/outputSchema to full JSON Schema 2020-12, mandates no auto-deref of external `$ref`, bounded schema depth — all mechanical MTQS rules. Every production server must migrate; nothing checks if the migrated surface is still good. Target JSON Schema 2020-12 from day one.
- **Reputational ROI (PRD §12):** Author holds AsyncAPI TSC seat; the Apideck MCP server (a proxy exposing 4 meta-tools) is the proof artifact. The largest payoff is an owned open standard + conference/API-Days artifacts, not MRR.
- **Competitors:** Glama (closed LLM-judge, no rules repo, can't gate a PR); mcpx (remote-API grading, URL-vs-URL diff); Optic (the L2 model — archived Jan 2026, seat empty); mcpindex (in-path enforcement, different use case); health-monitors (L3-only).

## Constraints

- **Team**: Solo, part-time (~2–3h/day alongside full-time job) — work must decompose into self-contained, schedulable units; nothing requiring the whole system in working memory at once.
- **No on-call**: Nothing that runs on its own clock / creates a paging obligation — why L1 (runs in user's CI) is the entry point and hosted/L3 is deferred.
- **Spec-first**: The spec is the product; the linter is its proof. Do not let code get ahead of a documented, defensible ruleset. MTQS v0.1 authoring gates all linter code.
- **Determinism**: Same input → same output, every run. No model in the L1 loop.
- **Tech stack**: TypeScript (PRD §15) — most complete MCP SDK, trivial in GitHub Actions, most contributor-friendly for OSS, good Spectral-style rule ergonomics. *Confirm before writing code (build-order step 1).*
- **OSS-native / build-in-the-open**: every rule and dimension is also shareable content; public feedback loop is a feature.
- **#1 risk is abandonment**: front-load the hard correct core (rule engine + deterministic score); keep a demoable artifact (`voke lint` one real server) reachable early, not buried at the end.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build L1 first, not the runtime monitor | Lowest-friction, ownable, runs anywhere with no infra; plants a flag on an empty category | — Pending |
| MTQS is an open spec, linter is reference impl | ESLint/WCAG model; the thing the incumbent structurally cannot do | ✓ Realized — Phase 1 (spec + YAML registry shipped) |
| Deterministic, no LLM-as-judge in L1 | Non-determinism in a CI signal is a trust failure; it's the wedge vs Glama | ✓ Locked — Phase 1 (integer-first scoring, no model in spec) |
| TypeScript (confirmed Phase 1) | Most complete MCP SDK; Actions-native; contributor-friendly | ✓ Confirmed — Phase 1 scaffolded in TS (vitest, zod) |
| v0.1 rule count is 22, not 20 | Roadmap "20" was an arithmetic error; enumeration 8+6+3+2+3 = 22 | ✓ Corrected in Phase 1 |
| Determinism proven by byte-identical x3 + shuffle-invariant test on a committed real-server fixture | The wedge vs Glama must be demonstrable, not asserted; sort-on-run + meta-strip + canonicalJson is the mechanism | ✓ Realized — Phase 2 (`tests/engine/determinism.test.ts`) |
| Target JSON Schema 2020-12 from day one | 2026-07-28 RC tailwind; avoids rework | — Pending |
| Spectral-style rule format | Native to API-spec linters; clean custom-rule path | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-13 after Phase 4 (Scoring + Output + CLI) completion*
