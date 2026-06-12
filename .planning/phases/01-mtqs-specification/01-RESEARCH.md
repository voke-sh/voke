# Phase 1: MTQS Specification — Research

**Researched:** 2026-06-12
**Domain:** Spec authoring — versioned technical standard, scoring formula, YAML rule registry, SCOPE.md
**Confidence:** HIGH (all primary sources verified via official docs and paper HTML)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Scoring is weighted deduction — every tool starts at 100; each finding subtracts a penalty scaled by severity. Every lost point traces to exactly one rule.
- **D-02:** `info` and `hint` severities are report-only — they surface as findings + fix hints but never move the score.
- **D-03:** Hard tier caps — certain critical errors cap the achievable tier regardless of numeric score. Capping rules + cap levels pinned during drafting.
- **D-04:** Severity ladder drives penalty magnitude: error > warning; info/hint = 0 to score. Exact point values pinned during drafting against D-08.
- **D-05:** Calibrated strict — boundaries + weights tuned so a genuinely well-built server lands B/A, a typical server lands C/D, a broken one lands F.
- **D-06:** Standard A–F cuts: A≥90, B≥80, C≥70, D≥60, F<60. Fixed — calibration via weights, not by moving cuts.
- **D-07:** Server score = mean of per-tool scores; report surfaces worst-offenders list.
- **D-08:** Penalties weighted by dimension importance (a dimension multiplier on top of severity).
- **D-09:** Weight tiers: Tier 1 (highest) = Schema-correctness + Annotation-transparency; Tier 2 = Description-as-prompt + Parameter-semantics; Tier 3 = Naming.
- **D-10:** Registry format = YAML — one entry per rule. Single source of truth. Linter loads it and validates against TS types at build; rule ID in code without registry entry fails build (SPEC-04).
- **D-11:** Doc shape = standard-style with per-rule anchors: thesis/intro → dimensions → rubric per rule → scoring formula + worked example → versioning/extensibility.
- **D-12:** Doc tone = authoritative + rationale (RFC/WCAG-like normative authority + "why" + primary-source citation + good/bad example).
- **D-13:** Versioning = semver, additive minors: v0.1 now; rule IDs stable forever; adding rules = minor bump; changing severities/weights = major bump.

### Claude's Discretion (pin during drafting, no further user input needed)

- Exact penalty point values per severity.
- Exact dimension multipliers within the D-09 tier ordering.
- Which specific errors trigger hard tier caps and at what cap level (D-03).
- The worked scoring example chosen for the spec.
- YAML registry field schema details and the TS-type validation mechanism.
- Spec doc section ordering details and anchor naming convention.

### Deferred Ideas (OUT OF SCOPE)

- 16 P2 differentiator rules (A07–A09, D04–D06, O01–O04, N04–N06, C01–C03) — v0.2.
- Output and Surface-coherence dimensions have no P1 rules → zero weight in v0.1 scoring.
- SARIF formatter — v2.
- Empirically re-tuning tier boundaries after Apideck fixture run — possible Phase 4 follow-up.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPEC-01 | MTQS v0.1 authored as versioned document — per-dimension rubrics, every rule justified from primary source (Anthropic / MCP spec / JSON Schema / academic), explicitly not Glama-derived | Primary source citations section below; per-rule citation table with exact spec language |
| SPEC-02 | Spec defines scoring formula with published per-dimension weights and A–F tier boundaries | Worked scoring example section; concrete penalty/multiplier proposal; determinism section |
| SPEC-03 | Spec defines stable rule IDs + severities for all 20 v0.1 rules | Rule registry sample section; all 20 rule IDs enumerated in FEATURES.md; severity ladder documented |
| SPEC-04 | Machine-readable rule registry is single source of truth; build check fails on rule-in-code without registry entry | YAML schema proposal section; TypeScript validation mechanism |
| SPEC-05 | SCOPE.md documents L1 boundary (no LLM-in-loop; no gateway/proxy) | SCOPE.md section below |
</phase_requirements>

---

## Summary

Phase 1 is a writing task, not a coding task. Its outputs — the MTQS v0.1 document, scoring formula, YAML rule registry, and SCOPE.md — are the architecture contract that gates all linter code. The raw material (20 rule definitions, severities, mechanical checks, fix hints) is fully enumerated in `.planning/research/FEATURES.md`. This research answers the five remaining questions the planner needs to assemble a defensible, citable, immediately authorable spec.

The five primary sources have been verified against live documentation. The Anthropic blog post (Sep 11, 2025, "Writing effective tools for agents — with agents") provides five principles with quantitative evidence. The MCP spec draft provides exact normative language for tool fields, tool name constraints, annotations with cross-constraints, and JSON Schema 2020-12 requirements including the external-$ref prohibition. SEP-986 (Final, 2025-07-16) pins the 1–64 character / alphanumeric-plus-four-chars name format. The smells paper (arxiv:2602.14878) provides six smell categories with prevalence rates and ICC scores establishing why LLM-based evaluation is out of L1. JSON Schema 2020-12 composition rules (oneOf/anyOf/allOf bounded depth) and the $ref resolution requirements are specified in the MCP draft spec's JSON Schema Usage section.

**Primary recommendation:** Author the spec in this order — (1) SCOPE.md first (one page, no ambiguity about what L1 is), (2) the scoring formula with concrete numbers (so every rule author knows what their rule "costs"), (3) the YAML registry schema, (4) the per-rule rubric sections consuming the rule material from FEATURES.md with citations inserted. The YAML registry is the anchor — it locks rule IDs, severities, and dimension assignments before prose is written. Prose without a registry leads to drift.

---

## Primary Source Citations

This section gives the planner the exact citable references each dimension's rules trace to.

### Dimension: Schema Correctness

**Primary:** MCP Specification (draft), Tools section, "JSON Schema Usage" subsection.
URL: https://modelcontextprotocol.io/specification/draft/basic/index#json-schema-usage

Key normative language (verified):
- "`inputSchema` **MUST** be a valid JSON Schema object (not `null`)" — supports S01, S02, S03, S06
- "Default dialect: When a schema does not include a `$schema` field, it defaults to JSON Schema 2020-12" — supports S03
- "Implementations **MUST NOT** automatically dereference `$ref` values that resolve to a network URI" — supports S04 (exact spec language, not paraphrase)
- "Schemas that fail to validate due to an unresolved external `$ref` **SHOULD** be rejected rather than silently treated as permissive" — reinforces S04 error severity
- "Composition keywords (`anyOf`, `oneOf`, `allOf`, `if`/`then`/`else`) and `$defs` enable expressive schemas but can be expensive to validate. Implementations **SHOULD** apply reasonable bounds, such as a maximum schema depth, a cap on the total number of subschemas, or a per-validation time budget, to prevent a malicious schema from acting as a Denial-of-Service vector" — supports S05

**Secondary:** JSON Schema 2020-12 spec (https://json-schema.org/draft/2020-12) — supports bare-object warning (S08), required-array explicitness (S07).

**Note on S05 depth threshold:** The MCP spec says "should apply reasonable bounds" but does not specify a numeric threshold. The FEATURES.md recommendation of ≤5 levels is a reasonable default. The spec author should pick a number (5 recommended) and label it "MTQS-RECOMMENDED" to distinguish it from a spec-mandated value.

### Dimension: Annotation Transparency

**Primary:** MCP Specification (draft), Tools section, ToolAnnotations definition.
URL: https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts

Exact field definitions and defaults (verified from TypeScript schema source):

| Field | Type | Default | Spec language |
|-------|------|---------|---------------|
| `title` | `string?` | — | "A human-readable title for the tool" |
| `readOnlyHint` | `boolean?` | `false` | "If true, the tool does not modify its environment" |
| `destructiveHint` | `boolean?` | `true` | "If true, the tool may perform destructive updates. If false, performs only additive updates." |
| `idempotentHint` | `boolean?` | `false` | "If true, calling the tool repeatedly with same args has no additional effect" |
| `openWorldHint` | `boolean?` | `true` | "If true, may interact with an 'open world' of external entities" |

**Cross-constraint (A06 citation):** The schema source explicitly notes: "`destructiveHint` and `idempotentHint` are only meaningful when `readOnlyHint == false`." This is the exact source for A06 (readOnlyHint:true + destructiveHint:true = contradiction).

**Implication for unannotated tools (A01–A05 rationale):** With defaults readOnly=false, destructive=true, idempotent=false, openWorld=true, any unannotated tool is assumed to be maximally risky. This makes annotation presence a safety-relevant check, not just stylistic.

### Dimension: Description-as-Prompt

**Primary:** Anthropic, "Writing effective tools for agents — with agents" (Sep 11, 2025)
URL: https://www.anthropic.com/engineering/writing-tools-for-agents

Five principles (verified):
1. Choose the right tools — "a few thoughtful tools targeting specific high-impact workflows" not thin wrappers
2. Namespace your tools — "common prefixes (e.g., `asana_projects_search`, `asana_users_search`)"
3. Return meaningful context — "prioritize contextual relevance over flexibility"; avoid raw UUIDs
4. Optimize for token efficiency — "pagination, range selection, filtering, and/or truncation with sensible defaults"
5. Prompt-engineer tool descriptions — "make implicit context explicit"; "instead of a parameter named `user`, try a parameter named `user_id`"; description refinements caused "dramatically reducing error rates" on SWE-bench

Quantitative evidence for description quality:
- "Small refinements to descriptions yielded dramatic benchmark improvements" (SWE-bench Verified, state-of-the-art performance)
- Concise vs. detailed response format: "approximately ⅓ of the tokens" for concise — token-efficiency principle anchor

**Secondary:** arxiv:2602.14878, "Model Context Protocol (MCP) Tool Descriptions Are Smelly! Towards Improving AI Agent Efficiency with Augmented MCP Tool Descriptions" (Hasan, Li, Rajbahadur, Adams, Hassan; submitted Feb 2026)
URL: https://arxiv.org/html/2602.14878v1

Six smell categories and prevalence (verified):
1. **Unclear Purpose** — 56% of tools
2. **Missing Usage Guidelines** — majority
3. **Unstated Limitations** — majority
4. **Opaque Parameters** — 84.3% of tools (highest mechanical detectability)
5. **Underspecified or Incomplete** — majority
6. **Exemplar Issues** — majority

97.1% of 856 tools across 103 servers have at least one smell.

ICC scores (LLM-as-Jury, multi-model): Purpose 0.82, Guidelines 0.85, Limitations 0.84, Parameter 0.90, Length 0.76, Examples 0.62. These are acceptable for academic research but NOT acceptable for a CI gate — this is the mechanical justification for why L1 uses proxy checks only (D01–D03) and defers semantic evaluation to L4.

### Dimension: Parameter Semantics

**Primary:** Anthropic principle 5 (same source as above): "`user_id` not `user`" — exact quoted example.
**Secondary:** JSON Schema best practice — enum for constrained string values, per-property descriptions.
**Tertiary proxy:** Smells paper — Opaque Parameters smell (84.3% prevalence) for P01 (missing property descriptions).

### Dimension: Naming

**Primary:** SEP-986 (Final, 2025-07-16, author: kentcdodds)
URL: https://modelcontextprotocol.io/seps/986-specify-format-for-tool-names

Exact normative language (verified):
- "Tool names **SHOULD** be between 1 and 64 characters in length (inclusive)." — SEP-986 final
- "Allowed characters: uppercase and lowercase ASCII letters (A-Z, a-z), digits (0-9), underscore (\_), dash (-), dot (.), and forward slash (/)"
- "Tool names **SHOULD NOT** contain spaces, commas, or other special characters"
- "Tool names **SHOULD** be unique within their namespace"

**Tension note:** The MCP spec draft says 1–128 characters; SEP-986 Final says 1–64. SEP-986 is a more recent and stricter proposal. MTQS-N01 should reference the MCP spec's 1–128 as the current normative value but note SEP-986's tighter proposal. The rule should flag over-128 as error and flag 64–128 as warning (stricter convention) — or simplify to "SHOULD be 1–128 per MCP spec; SEP-986 Final recommends 1–64." The planner should pick one; recommendation: use 1–128 (MCP spec) as the error threshold since SEP-986 is SHOULD not MUST, but note the 64-char recommendation in the fix hint.

**Additional naming citation:** Anthropic principle 2: "grouping related tools under common prefixes" — namespace rationale for N01–N03 context and the P2 N04–N06 rules.

---

## Proposed Scoring Formula

### Severity Penalty Values

These are proposed concrete numbers. The planner locks them; reasoning follows.

| Severity | Score Penalty | Rationale |
|----------|--------------|-----------|
| `error` | 15 points | An error is a spec violation or dangerous misconfiguration; even one error should move a tool from A to B territory; 7 errors = F regardless of dimension |
| `warning` | 5 points | A warning is a quality deficit; 3 warnings = -15 points; keeps scores meaningful without catastrophizing normal imperfection |
| `info` | 0 points | Report only; never moves score (D-02 locked) |
| `hint` | 0 points | Report only; never moves score (D-02 locked) |

**Calibration check for "typical server lands C/D":** A typical server with A01 (info), A02 (warning), A03 (warning), D02 (warning), P01 (warning) — 0 + 5 + 5 + 5 + 5 = 20 points deducted → score 80 (B). With additional schema issues: S07 (warning) + S08 (warning) = 10 more → score 70 (C). A completely bare server (no description, no annotations, broken schema) accumulates multiple errors quickly into F territory. This calibration feels right for "well-built = B/A, typical = C/D, broken = F."

### Dimension Multipliers

Multipliers applied on top of the base penalty per finding. Encodes D-09 weight tiers.

| Dimension | Tier | Multiplier | Justification |
|-----------|------|-----------|---------------|
| `schema` | T1 | 1.5× | Correctness floor; broken schema means the tool literally cannot be used; highest trust signal |
| `annotations` | T1 | 1.5× | Safety-critical; unannotated = maximal risk posture; the differentiator the spec uniquely checks |
| `description` | T2 | 1.2× | Agent usability; direct Anthropic guidance; high prevalence (97.1% have smells) |
| `parameters` | T2 | 1.2× | Anthropic explicit naming guidance; Opaque Parameters at 84.3% prevalence |
| `naming` | T3 | 1.0× | Spec compliance floor; important but less safety-critical than schema/annotations |

**Result:** A schema error costs 15 × 1.5 = 22.5 points. An annotation error costs 15 × 1.5 = 22.5 points. A description warning costs 5 × 1.2 = 6 points. A naming error costs 15 × 1.0 = 15 points.

**Determinism note:** These are floating-point multiplications. To avoid float accumulation, the implementation MUST compute `penalty = Math.round(basePenalty * multiplier)` per-finding and sum the rounded integers. This loses at most 0.5 points per finding but keeps the arithmetic deterministic across platforms.

### Worked Scoring Example

**Tool: `search` (a poorly-designed tool)**

```
name: "search"
description: "search"        ← copy of name (D-03 error)
inputSchema:
  type: object
  properties:
    q: {}                    ← bare untyped object (S-08 warning)
                             ← missing description on 'q' (P-01 warning)
  # no required array        ← S-07 warning
annotations: {}              ← annotations block present (A-01 passes)
  # readOnlyHint absent      ← A-02 warning
  # destructiveHint absent   ← A-03 warning
```

**Findings:**
| Rule | Severity | Base | Multiplier | Rounded Penalty |
|------|----------|------|-----------|----------------|
| MTQS-D03 | error | 15 | 1.2× | 18 |
| MTQS-S07 | warning | 5 | 1.5× | 8 |
| MTQS-S08 | warning | 5 | 1.5× | 8 |
| MTQS-P01 | warning | 5 | 1.2× | 6 |
| MTQS-A02 | warning | 5 | 1.5× | 8 |
| MTQS-A03 | warning | 5 | 1.5× | 8 |

**Total deduction:** 18 + 8 + 8 + 6 + 8 + 8 = **56 points**
**Tool score:** 100 − 56 = **44 (F)**

**Well-designed tool: `crm_search_contacts`**

```
name: "crm_search_contacts"
description: "Search CRM contacts by name, email, or phone. Returns up to 50 matching
              contacts. Use when you need to find an existing contact before creating
              a new one. Returns id, name, email, and phone fields."
inputSchema:
  type: object
  properties:
    query:
      type: string
      description: "Search query matching against name, email, or phone number"
    limit:
      type: integer
      description: "Max results to return (1–50, default 25)"
  required: [query]
annotations:
  readOnlyHint: true
  destructiveHint: false
  idempotentHint: true
  openWorldHint: false
```

**Findings:** None (all 20 P1 rules pass)
**Tool score:** 100 (A)

**Interpretation:** The spec's worked example should be the `crm_search_contacts` pair showing exactly what earns 100 versus the `search` tool showing how quickly score falls with real anti-patterns.

### Hard Tier Caps

These enforce D-03: "a server with broken schemas can't be an A."

| Condition | Cap Applied | Rule IDs | Rationale |
|-----------|-------------|----------|-----------|
| Any tool has `MTQS-S01` error (inputSchema absent/null) | Tool capped at D (≤69) regardless of numeric score | S01 | Tool is unusable — no schema means agents cannot know what args to send |
| Any tool has `MTQS-S03` or `MTQS-S06` error (invalid JSON Schema) | Tool capped at D (≤69) | S03, S06 | A schema that fails validation is structurally broken |
| Any tool has `MTQS-S04` error (unresolved external $ref) | Tool capped at C (≤79) | S04 | External $ref is a spec violation AND a runtime hazard; still usable but compromised |
| Any tool has `MTQS-A06` error (readOnly:true + destructive:true) | Tool capped at C (≤79) | A06 | Dangerous misclassification; tool may cause unintended side effects |
| Any tool has `MTQS-D03` error (description = copy of name) | Tool capped at C (≤79) | D03 | No genuine description; agent cannot understand what the tool does |

**Cap logic in the engine:** The scoring function first computes the raw deduction-based score, then applies any applicable caps by taking `min(rawScore, capValue)`. Caps are applied per-tool, not at the server level.

### Server Score Formula

```
serverScore = mean(toolScores)            // simple arithmetic mean, sorted by toolId
serverTier  = tier(serverScore)           // A≥90, B≥80, C≥70, D≥60, F<60
worstOffenders = toolScores.sort(asc).slice(0, 5)  // bottom 5 tools by score
```

Server score uses the capped tool scores (not raw). The server cannot be an A if its mean is pulled down by multiple broken tools. The worst-offenders list is the actionable fix target.

---

## YAML Registry Schema

### Field Specification

Every registry entry MUST contain these fields:

```yaml
# Required fields (all must be present; build fails if any are missing)
id: string          # stable identifier: "MTQS-S01" — prefix-dimension-sequence
severity: string    # "error" | "warning" | "info" | "hint"
dimension: string   # "schema" | "description" | "naming" | "parameters" | "annotations"
scope: string       # "per-tool" | "server" — determines rule engine routing
weight: number      # dimension multiplier (e.g., 1.5 for T1 dimensions)
description: string # one-sentence human-readable summary (used in CLI output)
fixHint: string     # actionable one-sentence fix guidance (quoted in findings)
source: string      # citable URL or spec reference (required for anti-Glama auditability)
mtqsVersion: string # "0.1" — version that introduced this rule
```

### Sample Entries

```yaml
# .voke/rules/mtqs-v0.1.yaml  (or spec/rules.yaml)
rules:
  - id: MTQS-S03
    severity: error
    dimension: schema
    scope: per-tool
    weight: 1.5
    description: inputSchema must be structurally valid JSON Schema 2020-12
    fixHint: >
      Validate inputSchema against the JSON Schema 2020-12 meta-schema.
      Common errors: unknown keywords, incorrect type values, malformed $ref.
    source: "https://modelcontextprotocol.io/specification/draft/basic/index#json-schema-usage"
    mtqsVersion: "0.1"

  - id: MTQS-A06
    severity: error
    dimension: annotations
    scope: per-tool
    weight: 1.5
    description: >
      When readOnlyHint is true, destructiveHint must not also be true —
      a read-only tool cannot be destructive.
    fixHint: >
      Set destructiveHint: false (or omit it) when readOnlyHint: true.
      The MCP schema notes destructiveHint is only meaningful when readOnlyHint == false.
    source: "https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts"
    mtqsVersion: "0.1"

  - id: MTQS-D02
    severity: warning
    dimension: description
    scope: per-tool
    weight: 1.2
    description: Tool description must be at least 20 characters
    fixHint: >
      Expand the description to cover what the tool does, when to use it,
      and what it returns. Single-word or single-phrase descriptions rarely
      provide agents enough context for correct selection.
    source: "https://www.anthropic.com/engineering/writing-tools-for-agents"
    mtqsVersion: "0.1"
```

### TypeScript Validation at Build

The registry MUST be validated at build time against a TypeScript type. The mechanism:

1. A `RuleRegistryEntry` interface is defined in `src/spec/registry-types.ts`:

```typescript
export type Severity = 'error' | 'warning' | 'info' | 'hint';
export type DimensionId = 'schema' | 'description' | 'naming' | 'parameters' | 'annotations';
export type RuleScope = 'per-tool' | 'server';

export interface RuleRegistryEntry {
  id: string;
  severity: Severity;
  dimension: DimensionId;
  scope: RuleScope;
  weight: number;
  description: string;
  fixHint: string;
  source: string;
  mtqsVersion: string;
}
```

2. A build-time script (or vitest setup) reads the YAML file, parses each entry, and validates against the type. Any entry with missing fields or invalid enum values throws, causing the build to fail.

3. A separate check validates that every rule ID used in `src/rules/*.ts` (the `id` field of `RuleDefinition`) exists in the registry. This is the SPEC-04 gate — rules in code without registry entries fail the build.

4. The `PUBLISHED_WEIGHTS` constant in `src/scoring/weights.ts` is generated from (or validated against) the registry's weight fields, ensuring the scoring formula and the registry stay in sync.

### Registry as Spec Doc Source

The human spec doc is not generated from the YAML (too complex for Phase 1). Instead:
- The YAML is the **canonical source** for: rule ID, severity, dimension, weight, source citation, fix hint
- The spec doc prose (rationale, good/bad examples) is written in Markdown alongside the YAML
- A validation script checks that every rule ID in the YAML appears in the spec doc (as an anchor `## MTQS-S03`), and every anchor in the spec doc has a corresponding YAML entry
- This bidirectional check (YAML ↔ doc) is the SPEC-01/SPEC-04 gate

---

## Spec Document Structure

### Recommended Section Outline

```
# MCP Tool Quality Specification (MTQS) v0.1

## Abstract
  One paragraph: the open-standard bet, the thesis (tool = contract between
  deterministic system and non-deterministic agent), the three deliverables.

## 1. Motivation and Scope
  1.1 The problem (97.1% of tools have description smells; no open standard exists)
  1.2 What MTQS is (deterministic, auditable, rule-per-finding)
  1.3 What MTQS is not (L4 eval, gateway, LLM-as-judge)
  → Links to SCOPE.md for L1 boundary

## 2. Dimensions
  Brief table: dimension name, T1/T2/T3 tier, rule count, primary source.
  One paragraph per dimension explaining its rationale.

## 3. Rules
  One subsection per rule with stable anchor (#MTQS-S01, etc.):
    ### MTQS-S01: inputSchema Presence {#MTQS-S01}
    **Dimension:** Schema Correctness | **Severity:** error | **Scope:** per-tool
    **What it checks:** [mechanical description]
    **Why it matters:** [rationale + primary source citation]
    **Passing example:** [code block]
    **Failing example:** [code block]
    **Fix hint:** [verbatim from registry]

## 4. Scoring Formula
  4.1 Severity penalty table (base points per severity)
  4.2 Dimension multipliers (weight table)
  4.3 Hard tier caps (table: condition → cap level → affected rules)
  4.4 Tool score calculation (worked example with arithmetic shown)
  4.5 Server score (mean formula; worst-offenders list)
  4.6 A–F tier table

## 5. Tiers
  Table: A ≥90 / B ≥80 / C ≥70 / D ≥60 / F <60
  Descriptive guidance for each tier (what it means in practice).

## 6. Versioning
  Semver policy. Rule ID stability guarantee. Minor = add rules.
  Major = change severities/weights. Linter MUST declare MTQS version.

## 7. Extensibility
  Custom rulesets (v1.0+). The register() interface. Vendor namespaces.
  (Forward-looking, not built in v0.1.)

## 8. References
  Numbered citation list. All primary sources.
```

### Per-Rule Rubric Template

The planner should produce one task that writes this template, then separate tasks per dimension group (schema, annotations, description, naming, parameters). Each task produces N rubric sections all using the same template.

```markdown
### MTQS-{ID}: {Short Name} {#MTQS-ID}

| Property | Value |
|----------|-------|
| **Dimension** | {dimension name} |
| **Severity** | `{error/warning/info/hint}` |
| **Scope** | `per-tool` or `server` |
| **Weight** | {multiplier}× |
| **Introduced** | v0.1 |
| **Source** | [{citable reference}]({URL}) |

**What it checks:** {One sentence: the mechanical test}

**Why it matters:** {One paragraph: agent-usability or safety rationale, with citation.}

**Passing example:**
```json
{...}
```

**Failing example:**
```json
{...}
```
**Finding message:** `{example finding message as the linter would emit it}`

**Fix hint:** {Verbatim from registry: actionable one sentence}
```

### Spectral-Style Rule Format (PRD §6.4)

The spec should acknowledge the Spectral inspiration but NOT use Spectral's runtime. The rule format in the registry mirrors Spectral's vocabulary:

| Spectral concept | MTQS equivalent |
|-----------------|-----------------|
| `id` | `id` (stable, namespaced: `MTQS-S01`) |
| `severity` | `severity` (error/warning/info/hint) |
| `given` (JSONPath target) | `scope` (per-tool / server) + dimension determines the target object |
| `then` / `function` | Rule implementation function in `src/rules/` |
| `message` | `description` + `fixHint` in registry |

The key difference: Spectral's `given` is a JSONPath expression over a raw JSON document. MTQS `scope` + the rule function receive a typed `ToolSnapshot` TypeScript object (or full `ToolSnapshot[]` for server-scope rules). This is why Spectral's engine cannot be embedded — its JSONPath model doesn't support server-aggregate rules.

---

## SCOPE.md Content

SCOPE.md must be a single-page normative boundary statement. It MUST contain:

### Required Sections

**1. What MTQS L1 Is**
- A deterministic, rule-based static analysis of MCP tool surface
- Runs locally and in CI
- Consumes: `tools/list` surface (name, title, description, inputSchema, outputSchema, annotations)
- Produces: per-rule findings + per-tool score + server score + A–F tier

**2. What MTQS L1 Is Not (Hard Boundaries)**
- NOT an LLM-as-judge: no model call in any rule function; rule functions are typed `(ctx: RuleContext) => Finding[]` (pure, synchronous, no IO)
- NOT a gateway or proxy: Voke is a read-only observer of `tools/list`; it NEVER sits in the execution path of tool calls
- NOT a runtime monitor: no scheduling, no alerting, no health checks (L3 scope)
- NOT an agent evaluator: no task execution, no agent loop, no "would an agent succeed?" evaluation (L4 scope)
- NOT a semantic linter: rules check mechanical properties only; whether a description is "clear" or "accurate" requires L4 eval

**3. The Determinism Guarantee**
- Same `tools/list` input → same output, every run, on any platform
- This requires: no wall-clock references in scoring, sorted tool arrays, integer-first arithmetic, no external network calls in rule functions
- Any rule that would require IO, randomness, or a model call MUST NOT be added to L1; it belongs in L4

**4. Scope Creep Prevention**
- A rule PR to this repo must cite a primary source (MCP spec / Anthropic guidance / JSON Schema / academic paper)
- A rule PR must demonstrate that the check is mechanical (no model in the loop)
- Any proposed rule requiring semantic understanding → reject from L1, label as L4 candidate

**5. Version Boundary**
- MTQS v0.1 covers 20 rules across 5 active dimensions
- v0.2 adds 16 differentiator rules (P2)
- New layers (L2–L6) are separate specifications, not extensions of L1

---

## Determinism in the Formula

The formula authors in Phase 1 must ensure the scoring math is reproducible by Phase 2's engine.

### Integer-First Arithmetic Rules

1. **Base penalties are integers:** 15 (error), 5 (warning), 0 (info/hint)
2. **Dimension multipliers are decimals:** 1.5, 1.2, 1.0
3. **Per-finding rounding:** `penalty = Math.round(basePenalty * multiplier)` — round immediately per finding, not at the end
4. **Accumulation is integer addition of rounded values** — no floating-point accumulation
5. **Score is integer subtraction from 100:** `score = Math.max(0, 100 - sum(roundedPenalties))`
6. **No floating-point averages until server score:** `serverScore = Math.round(sum(toolScores) / toolScores.length)` — round once at server level

**Why this matters:** `1.5 * 5 = 7.5`, then `sum(7.5, 7.5) = 15.0` vs `Math.round(1.5 * 5) = 8`, `Math.round(1.5 * 5) = 8`, `sum(8, 8) = 16`. The per-finding rounding approach produces consistent results across JavaScript engines (no IEEE 754 accumulation differences). The spec must declare which rounding model is used.

### Fixed Evaluation Order

The spec MUST state:
1. Rules are evaluated in alphabetical order by rule ID (MTQS-A01, MTQS-A02, ..., MTQS-S01, ..., MTQS-S08)
2. Findings are sorted: toolId ascending → ruleId ascending → path ascending
3. The server score is computed after all tool scores are computed and sorted by toolId

This order must be specified in the spec, not left to the engine. The spec is the contract; the engine implements it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom YAML parser | `js-yaml` (already in MCP SDK transitive deps) or built-in Node.js `yaml` module (Node 22) | YAML is complex; hand-rolled parsers miss anchors, multi-line strings |
| JSON Schema validation in rules | Custom validator | `ajv/dist/2020` (`Ajv2020`) | Only validator with full 2020-12 support; already a transitive dep; strict mode is deterministic |
| Type-checking registry at build | Runtime instanceof checks | `zod` schema for registry entries | Type safety at parse time; already a project dep |
| Spec doc HTML generation from YAML | Custom template engine | None needed in Phase 1 — write Markdown directly; auto-generation is v0.2 | Adds complexity to a writing task; Markdown is the publication format |
| Spec version semver parsing | Custom semver parser | None needed — string equality is sufficient for v0.1 | The MTQS_VERSION constant is a string; no arithmetic needed |

---

## Common Pitfalls

### Pitfall 1: Writing Prose Before Locking the Registry

**What goes wrong:** You write 20 rubric sections in Markdown, then discover the YAML registry needs different field names than what you implied in prose. Now both need updates.
**Why it happens:** Natural to start with what you know (the rules) before designing the schema.
**How to avoid:** Lock the YAML schema (field names, required fields, enum values) before writing a single rubric section. The registry schema is the contract; prose serves it.
**Warning signs:** Writing a rubric section that references a concept (e.g., "penalty weight") that has no registry field yet.

### Pitfall 2: Ambiguous Penalty Arithmetic in the Spec

**What goes wrong:** The spec says "multiply by dimension weight" without specifying rounding. Phase 2 implements one rounding approach; a community linter implements another. Scores differ for the same input.
**Why it happens:** Scoring formulas feel obvious to the author.
**How to avoid:** Specify the exact arithmetic order: base penalty → multiply by weight → `Math.round` → sum integers → subtract from 100. Include a worked example with the arithmetic shown step-by-step so there is no ambiguity.
**Warning signs:** Any sentence like "approximately" or "roughly" in the scoring formula section.

### Pitfall 3: Cap Logic That Conflicts with the Deduction Formula

**What goes wrong:** A tool has both a raw score of 85 (B) and an S01 error (cap at D, ≤69). The spec is unclear whether the cap takes the raw score or applies as an additional deduction.
**Why it happens:** Caps are conceptually separate from the deduction formula.
**How to avoid:** Specify caps as post-computation overrides: "first compute the deduction-based score; then, if any hard-cap conditions apply, replace the score with `min(rawScore, capValue)`." Never model a cap as an additional point deduction.
**Warning signs:** Using language like "additional penalty" for cap conditions.

### Pitfall 4: Server Score Includes Uncapped Tool Scores

**What goes wrong:** The server mean is computed before caps are applied per tool. A server with one broken tool (S01 error, raw score 85 before cap → should be ≤69) shows as A.
**How to avoid:** The spec must state the computation order: (1) raw tool score; (2) apply caps per tool; (3) capped scores go into the server mean. Caps are a per-tool operation.

### Pitfall 5: Rule ID Namespace Conflict with v0.2 Rules

**What goes wrong:** v0.1 uses MTQS-A01–A06; v0.2 adds A07–A09. If the numbering was non-sequential (e.g., A01, A05, A09), v0.2 additions create gaps.
**Why it happens:** Rule IDs assigned by priority rather than sequentially.
**How to avoid:** Reserve a sequence range: v0.1 uses A01–A06, S01–S08, D01–D03, N01–N03, P01–P02. v0.2 continues the sequence. Document this in the versioning section.

### Pitfall 6: Spec-vs-Registry Drift

**What goes wrong:** The spec doc says MTQS-S04 has severity `error`; the YAML registry says `warning`. The linter loads the registry; the spec is wrong. Community members follow the spec, not the linter.
**Why it happens:** Manual edits to spec without updating registry (or vice versa).
**How to avoid:** The registry YAML is the single source of truth for severity, weight, and fixHint. The spec doc is the narrative explanation. A validation script verifies consistency (SPEC-04 gate). Add this to the build.

---

## Code Examples

### YAML Registry Entry (complete example for MTQS-S04)

```yaml
- id: MTQS-S04
  severity: error
  dimension: schema
  scope: per-tool
  weight: 1.5
  description: >
    No unresolved external $ref URIs in inputSchema or outputSchema.
    References pointing outside $defs are external $refs.
  fixHint: >
    Move all schema definitions into $defs within the schema object.
    Do not reference external URLs. The MCP spec (2026-07-28 RC) states:
    "implementations MUST NOT automatically dereference $ref values that
    resolve to a network URI."
  source: "https://modelcontextprotocol.io/specification/draft/basic/index#ref-resolution"
  mtqsVersion: "0.1"
```

### Rule Engine Interface (the contract the spec defines)

```typescript
// From ARCHITECTURE.md — the interface the spec must be consistent with
type RuleFunction = (ctx: RuleContext) => Finding[];

interface RuleDefinition {
  id: string;          // must match registry id
  dimension: DimensionId;
  target: 'tool' | 'server';   // maps to registry scope
  defaultSeverity: Severity;   // must match registry severity
  fixHint: string;             // must match registry fixHint
  fn: RuleFunction;            // pure function, no IO
}
```

### Registry Validation Zod Schema (for build-time check)

```typescript
import { z } from 'zod';

const SeveritySchema = z.enum(['error', 'warning', 'info', 'hint']);
const DimensionSchema = z.enum(['schema', 'description', 'naming', 'parameters', 'annotations']);
const ScopeSchema = z.enum(['per-tool', 'server']);

export const RuleRegistryEntrySchema = z.object({
  id: z.string().regex(/^MTQS-[A-Z]\d{2}$/),
  severity: SeveritySchema,
  dimension: DimensionSchema,
  scope: ScopeSchema,
  weight: z.number().min(0.1).max(3.0),
  description: z.string().min(10),
  fixHint: z.string().min(10),
  source: z.string().url(),
  mtqsVersion: z.string().regex(/^\d+\.\d+$/),
});

export const RuleRegistrySchema = z.object({
  rules: z.array(RuleRegistryEntrySchema),
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAPI / Swagger lint (Spectral) as the API quality standard | MCP tool surface requires its own linter; Spectral's JSONPath model can't express server-aggregate rules | Jan–May 2026 | Need custom engine; MTQS is the new category |
| Glama TDQS as the only scoring system | MTQS is the open alternative; rules are public, scores are reproducible | Jun 2026 (this spec) | Competitive positioning |
| JSON Schema draft-07 as default | JSON Schema 2020-12 as default in MCP (no `$schema` field = 2020-12) | MCP draft (SEP-2106, targeting 2026-07-28) | MTQS must validate 2020-12 from day 1 |
| `inputSchema` as "any JSON object" | `inputSchema` MUST be a valid JSON Schema object; external $ref MUST NOT auto-deref | MCP 2026-07-28 RC | S01–S04 are now spec-mandated, not just best practice |
| Tool annotations as optional decorations | Unannotated tools default to maximally risky posture (readOnly=false, destructive=true) | MCP spec (March 2026 annotations blog) | A01–A06 are safety-relevant, not just stylistic |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest v4.1.8 |
| Config file | `vitest.config.ts` — none yet (Wave 0 gap) |
| Quick run command | `npm run test:spec` or `vitest run spec/` |
| Full suite command | `vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPEC-01 | Every rule in registry has a non-empty `source` field (URL or spec reference) | unit | `vitest run spec/registry-completeness.test.ts` | Wave 0 gap |
| SPEC-01 | Every rule in registry has a non-empty `fixHint` | unit | same file | Wave 0 gap |
| SPEC-01 | Every rule in registry has a corresponding anchor in the spec doc | unit | `vitest run spec/registry-doc-sync.test.ts` | Wave 0 gap |
| SPEC-02 | Worked example arithmetic is correct (round-per-finding, then sum) | unit | `vitest run spec/scoring-formula.test.ts` | Wave 0 gap |
| SPEC-02 | Hard cap conditions produce correct capped scores | unit | same file | Wave 0 gap |
| SPEC-02 | Server score = mean of capped tool scores | unit | same file | Wave 0 gap |
| SPEC-03 | All 20 rule IDs exist in registry with correct severity | unit | `vitest run spec/registry-completeness.test.ts` | Wave 0 gap |
| SPEC-03 | No duplicate rule IDs in registry | unit | same file | Wave 0 gap |
| SPEC-04 | Registry parses and validates against Zod schema without errors | unit | `vitest run spec/registry-schema.test.ts` | Wave 0 gap |
| SPEC-04 | Rule IDs in registry match the RuleDefinition id values in src/rules/ | unit | `vitest run spec/registry-code-sync.test.ts` | Wave 0 gap |
| SPEC-05 | SCOPE.md file exists and contains the five required sections | unit | `vitest run spec/scope-md.test.ts` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `vitest run spec/registry-completeness.test.ts` (< 5 seconds)
- **Per wave merge:** `vitest run` (full suite)
- **Phase gate:** All spec tests green before `/gsd:verify-work`

### Wave 0 Gaps (files to create before implementation)

- [ ] `spec/mtqs-v0.1.yaml` — the rule registry (core deliverable)
- [ ] `spec/MTQS-v0.1.md` — the spec document (core deliverable)
- [ ] `spec/SCOPE.md` — L1 boundary statement (core deliverable)
- [ ] `spec/registry-types.ts` — TypeScript types for registry entries (Zod schema)
- [ ] `tests/spec/registry-completeness.test.ts` — all 20 rules present, source/fixHint non-empty
- [ ] `tests/spec/registry-schema.test.ts` — YAML parses against Zod schema
- [ ] `tests/spec/registry-doc-sync.test.ts` — every registry ID has a spec doc anchor
- [ ] `tests/spec/scoring-formula.test.ts` — arithmetic correctness for worked example
- [ ] `tests/spec/scope-md.test.ts` — SCOPE.md has required sections

---

## Open Questions

1. **Schema depth threshold for MTQS-S05**
   - What we know: MCP spec says "SHOULD apply reasonable bounds"; no numeric threshold specified
   - What's unclear: Whether 5 levels is the right practical default; might be too strict for some legitimate schemas
   - Recommendation: Use 5 as the initial MTQS recommendation; label it "MTQS-RECOMMENDED" (not "MCP-MANDATED"); treat as warning not error so it doesn't over-penalize legitimate complex schemas

2. **Name length conflict: MCP spec (1–128) vs SEP-986 Final (1–64)**
   - What we know: Both are SHOULD, not MUST; SEP-986 is a separate standards-track document
   - What's unclear: Which becomes normative when the 2026-07-28 RC is finalized
   - Recommendation: MTQS-N01 flags >128 as error (clear MCP spec violation), flags 65–128 as warning (SEP-986 stricter recommendation), treats 1–64 as passing

3. **v0.1 rule ID format**
   - What we know: FEATURES.md uses `MTQS-S01` style (dimension letter + two-digit sequence)
   - What's unclear: Whether to use letter codes (S, A, D, N, P) or full dimension names
   - Recommendation: Keep `MTQS-S01` style (shorter in CLI output, stable if dimension names change)

---

## Sources

### Primary (HIGH confidence)

- MCP Specification (draft), Tools section + JSON Schema Usage section — verified live at modelcontextprotocol.io/specification/draft; exact normative language extracted
- MCP TypeScript schema (draft) at raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts — ToolAnnotations exact fields and cross-constraints
- SEP-986 (Final) at modelcontextprotocol.io/seps/986-specify-format-for-tool-names — tool name character set and length (1–64)
- Anthropic "Writing effective tools for agents — with agents" (Sep 11, 2025) at anthropic.com/engineering/writing-tools-for-agents — five principles, quantitative claims, `user_id` example

### Secondary (MEDIUM confidence)

- arxiv:2602.14878 HTML at arxiv.org/html/2602.14878v1 — six smell categories, prevalence rates (97.1% / 56% / 84.3%), ICC scores (0.62–0.90) confirming LLM-only evaluation; verified against abstract
- JSON Schema 2020-12 spec at json-schema.org/draft/2020-12 — composition keywords, property descriptions, required arrays, bare-object anti-pattern

### Tertiary (LOW confidence — not needed; registry approach avoids these)

- Glama TDQS scoring (competitor reference only; hard rule: do NOT use as template)

---

## Metadata

**Confidence breakdown:**
- Primary source citations: HIGH — all verified live
- Scoring formula proposal: MEDIUM — concrete numbers are defensible but require calibration against Apideck fixture (Phase 4 follow-up)
- YAML registry schema: HIGH — field set derived directly from CONTEXT.md D-10 + ARCHITECTURE.md engine types
- Spec doc structure: HIGH — follows CONTEXT.md D-11 exactly, with section outline derived from PRD §6 + standard RFC structure
- SCOPE.md content: HIGH — directly derived from CONTEXT.md deferred section + PROJECT.md constraints

**Research date:** 2026-06-12
**Valid until:** 2026-08-01 (MCP spec changes are frequent; verify annotations defaults if spec moves past 2026-07-28 RC)
