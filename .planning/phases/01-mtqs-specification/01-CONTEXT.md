# Phase 1: MTQS Specification - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Author the MTQS v0.1 specification as a versioned, defensible, deterministic standard: per-dimension rubrics for the 20 P1 rules, the scoring formula, A–F tiers, a machine-readable rule registry (the shared source of truth for spec + linter), and SCOPE.md. This is a **writing/authoring** phase — no linter code. It gates all implementation phases. The exact rule set (IDs, severities, primary sources) is already enumerated in `.planning/research/FEATURES.md`; this phase turns it into the published spec + scoring system.

</domain>

<decisions>
## Implementation Decisions

### Scoring model
- **D-01:** Scoring is **weighted deduction** — every tool starts at 100; each finding subtracts a penalty scaled by severity. Every lost point traces to exactly one rule (the auditable-vs-Glama-black-box property is the launch story).
- **D-02:** `info` and `hint` severities are **report-only** — they surface as findings + fix hints but never move the score. Keeps the number about real quality; no death-by-a-thousand-hints on large surfaces (229-tool Apideck).
- **D-03:** **Hard tier caps** — certain critical errors (e.g. invalid JSON Schema, unresolved external `$ref`) cap the achievable tier regardless of numeric score ("a server with broken schemas can't be an A"). The capping rules + cap levels are pinned during drafting.
- **D-04:** Severity ladder drives penalty magnitude: error > warning; info/hint = 0 to score. Exact point values pinned during drafting against the dimension weights (D-08).

### Tiers & strictness
- **D-05:** **Calibrated strict** — boundaries + weights tuned so a genuinely well-built server lands B/A, a typical server lands C/D, a broken one lands F. "A" must mean something; avoid Glama's everyone-gets-an-A problem and avoid brutal alienation of early adopters.
- **D-06:** **Standard A–F cuts: A≥90, B≥80, C≥70, D≥60, F<60.** Familiar (school grades), legible in the blog post with no explanation. Calibration happens via weights/penalties under these fixed cuts, NOT by moving the cuts.
- **D-07:** **Server score = mean of per-tool scores**, and the report surfaces a **worst-offenders list** (lowest-scoring tools). One bad tool won't tank a 229-tool server, but the fix targets are visible. (Not min, not surface-weighted.)

### Dimension weights
- **D-08:** Penalties are **weighted by dimension importance** (a dimension multiplier on top of severity), NOT equal — so the score emphasizes high-value signals rather than letting rule-count (schema's 8 rules) dominate by volume. Each weight must be justifiable from a primary source (the anti-Glama property).
- **D-09:** **Weight tiers:** Tier 1 (highest) = Schema-correctness + Annotation-transparency (mechanical, under-served, high-trust — the wedge). Tier 2 = Description-as-prompt + Parameter-semantics (Anthropic core). Tier 3 = Naming. Exact multipliers pinned while writing the rubrics with sources open.

### Spec document & registry
- **D-10:** **Registry format = YAML** — one entry per rule (id, severity, dimension, weight, source, fix hint). Human-editable, PR-friendly, language-agnostic; it is the single source of truth. Linter loads it and validates against TS types at build; a rule ID used in code without a registry entry fails the build (SPEC-04).
- **D-11:** **Doc shape = standard-style with per-rule anchors:** thesis/intro → dimensions → one rubric section per rule with a stable anchor → scoring formula + worked example → versioning/extensibility. Every rule is independently linkable (shareable content per rule, PRD §2).
- **D-12:** **Doc tone = authoritative + rationale** — RFC/WCAG-like normative authority, but each rule carries its "why" + primary-source citation + a good/bad example. Matches the author's AsyncAPI-TSC credibility; rationale is the anti-black-box differentiator.
- **D-13:** **Versioning = semver, additive minors:** v0.1 now; rule IDs are stable forever; adding rules = minor bump; changing severities/weights = major bump. Linter declares which MTQS version it implements (SCORE-02). Predictable for CI gating.

### Claude's Discretion (pin during drafting, no further user input needed)
- Exact penalty point values per severity.
- Exact dimension multipliers within the D-09 tier ordering.
- Which specific errors trigger hard tier caps and at what cap level (D-03).
- The worked scoring example chosen for the spec.
- YAML registry field schema details and the TS-type validation mechanism.
- Spec doc section ordering details and anchor naming convention.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project framing & scope
- `prd.md` §4 — the open-spec strategic bet (ESLint/WCAG model; why NOT to copy Glama)
- `prd.md` §6 — L1 build target: the three deliverables, what MTQS is/isn't, dimensions, rule format
- `prd.md` §6.2 — primary sources every rule must trace to
- `prd.md` §6.4 — Spectral-style rule format
- `prd.md` §11 — MCP 2026-07-28 RC (JSON Schema 2020-12, no external `$ref`, bounded depth)
- `prd.md` §16 — project constraints (spec-first, determinism, no-Glama, no-gateway)
- `.planning/PROJECT.md` — vision, constraints, key decisions
- `.planning/REQUIREMENTS.md` — SPEC-01..05 acceptance criteria

### Rule set (already researched — turn into spec)
- `.planning/research/FEATURES.md` — the 20 P1 rules with IDs, severities, mechanical checks, fix hints, and primary-source citations; the 16 P2 rules (v0.2, out of scope here)
- `.planning/research/SUMMARY.md` — dimension overview + Phase-1 spec-authoring decision list

### Primary sources (the rules must cite these, not Glama)
- Anthropic, "Writing effective tools for agents — with agents" (Sep 2025) — five principles
- MCP specification — tool definition + five annotations (readOnlyHint/destructiveHint/idempotentHint/openWorldHint/title); SEP-986 (naming, Final); SEP-2106 (JSON Schema 2020-12 lift)
- JSON Schema 2020-12 — per-property descriptions, enums, required, no bare untyped objects, bounded depth, no external `$ref`
- Academic: "MCP Tool Descriptions Are Smelly" — description-smells taxonomy (note: paper uses LLM scoring; only mechanical proxies belong in L1)

</canonical_refs>

<code_context>
## Existing Code Insights

Greenfield — no code yet. Phase 1 produces documents + a YAML registry only.

### Forward constraints from research (shape this phase's outputs)
- Registry must support **two rule execution modes** (per-tool and server-aggregate) — encode a mode/scope field per rule entry so the Phase 2 engine can route them.
- Registry is the **single source of truth**; the Phase 5 spec publication and the linter both consume it. Design the YAML schema so it can be both rendered into the human spec doc and loaded by the linter.
- Scoring must be **deterministic** (Phase 2 enforces it, but the formula authored here must use a fixed evaluation order and integer-first arithmetic where possible — no floating-point accumulation ambiguity).

</code_context>

<specifics>
## Specific Ideas

- The launch story is "there is no open standard for MCP tool quality — here is one." Every spec decision should reinforce **auditable + reproducible + traceable-to-a-source** vs Glama's closed LLM-judge.
- Each rule = independently shareable content (its own anchor) so individual rules can be posted/cited.
- "A server with broken schemas can't be an A" is the kind of opinionated, defensible line the spec should embody (hard caps, D-03).

</specifics>

<deferred>
## Deferred Ideas

- 16 P2 differentiator rules (verb-annotation consistency A07–A09, description proxies D04–D06, token-efficiency O01–O04, namespace quality N04–N06, surface coherence C01–C03) — v0.2, post-launch. Output & Surface-coherence dimensions have no P1 rules, so they carry zero weight in v0.1 scoring.
- SARIF formatter — v2 output (REQUIREMENTS OUT-P2-01), Phase 5 spike noted.
- Empirically re-tuning tier boundaries after the real Apideck fixture run — possible Phase 4 follow-up, but v0.1 ships with the D-06 standard cuts as committed.

</deferred>

---

*Phase: 01-mtqs-specification*
*Context gathered: 2026-06-12*
