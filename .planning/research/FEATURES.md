# Feature Research: MTQS v0.1 Rule Landscape

**Domain:** MCP Tool Quality Specification — deterministic linter rules
**Researched:** 2026-06-12
**Confidence:** HIGH (all rules trace to primary sources verified via official docs + Context7-equivalent)

---

## Framing Note

The "features" of MTQS are its **rules**. Each rule is the product's substance. This document maps every candidate rule to:
- Its PRD §6.3 dimension
- A mechanical check (no LLM in the loop — anything requiring judgment is flagged as L4 anti-feature)
- A severity (error / warning / info / hint) following Spectral conventions
- A fix hint (actionable, one sentence)
- A primary source (not Glama — see hard constraint in PRD §4)

Rules are organized into three product-level categories:
- **Table Stakes** — any credible API linter would check these; missing = product feels broken
- **Differentiators** — annotation consistency, description-smells proxy checks, token-efficiency signals; no competing tool checks these mechanically
- **Anti-Features** — things that seem like rules but require an LLM; must stay out of L1 entirely

---

## Table Stakes: Rules Every Credible Linter Must Check

These map to "Schema correctness" and the mechanical floor of "Description-as-prompt" and "Parameter semantics." Missing any of these and the linter is not credible.

### Dimension: Schema Correctness
*Source: MCP Specification (tool definition §, JSON Schema 2020-12 SEP-2106, 2026-07-28 RC)*

| Rule ID | Check | Severity | Fix Hint | Source |
|---------|-------|----------|----------|--------|
| `MTQS-S01` | `inputSchema` is present and non-null | error | Add `"inputSchema": {"type": "object", "additionalProperties": false}` for no-param tools | MCP spec: "MUST be a valid JSON Schema object (not null)" |
| `MTQS-S02` | `inputSchema` root has `"type": "object"` | error | inputSchema root must be `type: object`; tool arguments are always objects | MCP spec + SEP-2106: input keeps `type: "object"` root constraint |
| `MTQS-S03` | `inputSchema` is structurally valid JSON Schema (no unknown top-level keys violating the dialect) | error | Validate against JSON Schema 2020-12 meta-schema | JSON Schema 2020-12 |
| `MTQS-S04` | No unresolved external `$ref` URIs in `inputSchema` or `outputSchema` (refs pointing outside `$defs`) | error | Move schema definitions into `$defs`; do not reference external URLs | MCP spec 2026-07-28 RC: "implementations MUST NOT auto-dereference external $ref" |
| `MTQS-S05` | Schema nesting depth does not exceed threshold (recommended ≤ 5 levels) | warning | Flatten deeply nested schemas; use `$defs` for reuse | MCP spec 2026-07-28 RC: "SHOULD bound schema depth" |
| `MTQS-S06` | `outputSchema`, if present, is structurally valid JSON Schema 2020-12 | error | Validate `outputSchema` against JSON Schema 2020-12 meta-schema | MCP spec + SEP-2106: "outputSchema follows JSON Schema usage guidelines" |
| `MTQS-S07` | `required` array is present when `properties` is defined (even if empty `[]`) | warning | Add `"required": []` or list the mandatory fields explicitly | JSON Schema best practice: explicit required/optional |
| `MTQS-S08` | No property uses bare `{}` (untyped) schema — every property in `properties` has at least a `type` or `$ref` | warning | Specify `"type"` or a composition keyword for every property | JSON Schema best practice: "no bare untyped objects" |

### Dimension: Description-as-Prompt — Structural Floor
*Source: Anthropic "Writing effective tools for agents" (Sep 2025), MCP spec*

| Rule ID | Check | Severity | Fix Hint | Source |
|---------|-------|----------|----------|--------|
| `MTQS-D01` | `description` field is present and non-empty | error | Add a description explaining what the tool does, when to use it, and what it returns | Anthropic (principle 5): "prompt-engineer tool descriptions"; MCP spec |
| `MTQS-D02` | `description` length is at least 20 characters | warning | A one-word or one-sentence description is almost always insufficient; expand with purpose and usage context | Anthropic principle 5; "MCP Tool Descriptions Are Smelly" (arxiv:2602.14878): Underspecified smell |
| `MTQS-D03` | `description` is not a byte-for-byte duplicate of the tool `name` (e.g., `name: "get_user"`, `description: "get_user"`) | error | Replace the name-copy with a real description of what the tool does and returns | Anthropic principle 5; description smell: Unclear Purpose |

### Dimension: Naming and Namespacing — Structural Floor
*Source: MCP spec SEP-986 (Final, 2025-07-16), Anthropic principle 2*

| Rule ID | Check | Severity | Fix Hint | Source |
|---------|-------|----------|----------|--------|
| `MTQS-N01` | Tool `name` is present, non-empty, and between 1–128 characters | error | Keep names concise and within the spec-defined length (SHOULD 1–128 chars per draft spec; SEP-986 proposes 1–64) | MCP spec: "SHOULD be between 1 and 128 characters" |
| `MTQS-N02` | Tool `name` contains only allowed characters: `[A-Za-z0-9_\-./]`, no spaces or commas | error | Rename using allowed characters only; use `_` or `-` as word separators | MCP spec + SEP-986 (Final) |
| `MTQS-N03` | Tool names are unique within the server (no two tools share the same `name`) | error | Rename one of the colliding tools to uniquely identify it | MCP spec: "SHOULD be unique within a server" |

### Dimension: Parameter Semantics — Structural Floor
*Source: Anthropic "Writing effective tools for agents" (Sep 2025), JSON Schema best practice*

| Rule ID | Check | Severity | Fix Hint | Source |
|---------|-------|----------|----------|--------|
| `MTQS-P01` | Every property in `inputSchema.properties` has a non-empty `description` | warning | Add a `"description"` to each parameter explaining its meaning, type constraints, and valid values | Anthropic principle 5: "user_id not user"; smells paper: Opaque Parameters smell (84.3% prevalence) |
| `MTQS-P02` | Properties whose values are drawn from a finite, known set of strings use `"enum"` | warning | Replace free-text strings like `"status"` or `"format"` with `"enum": ["value1", "value2", ...]` | Anthropic principle 5; JSON Schema best practice |

---

## Differentiators: Rules No Competing Tool Checks Mechanically

These are the competitive moat. Annotation consistency, verb-semantic cross-checks, description proxy heuristics, and token-efficiency signals are absent from Glama (LLM-judge, not checked), mcpx (remote, opaque), and all other known tools.

### Dimension: Behavioral Transparency (Annotations)
*Source: MCP specification ToolAnnotations (introduced 2025-03-26 via PR #185); official blog post "Tool Annotations as Risk Vocabulary" (Mar 2026)*

The spec's cautious defaults are: `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`. This means **unannotated tools are treated as maximally risky**. Checking annotation presence is therefore a high-value, zero-LLM rule.

| Rule ID | Check | Severity | Fix Hint | Source |
|---------|-------|----------|----------|--------|
| `MTQS-A01` | `annotations` object is present | info | Add `"annotations": {}` with at minimum `readOnlyHint` and `destructiveHint`; unannotated tools default to the most-risky posture | MCP spec: annotations optional but defaults are cautious |
| `MTQS-A02` | `readOnlyHint` is explicitly set (boolean) | warning | Set `"readOnlyHint": true` if the tool only reads data; false if it writes; do not leave the agent to assume the worst | MCP spec: default false (conservative) |
| `MTQS-A03` | `destructiveHint` is explicitly set (boolean) | warning | Set `"destructiveHint": false` for additive operations (create/append); `true` for delete/overwrite; default is `true` | MCP spec: default true (conservative) |
| `MTQS-A04` | `idempotentHint` is explicitly set (boolean) | info | Set `"idempotentHint": true` if repeated calls with same args produce no additional effect (safe to retry on failure) | MCP spec: default false |
| `MTQS-A05` | `openWorldHint` is explicitly set (boolean) | info | Set `"openWorldHint": false` for closed-domain tools (local file, internal DB); `true` for tools touching external APIs or the internet | MCP spec: default true (conservative) |
| `MTQS-A06` | When `readOnlyHint: true`, `destructiveHint` is not simultaneously `true` | error | A read-only tool cannot be destructive; remove the contradiction — set `destructiveHint: false` or omit it when `readOnly: true` | MCP spec: "destructiveHint is meaningful only when readOnlyHint == false" |
| `MTQS-A07` | Tool names beginning with read-verb prefixes (`get_`, `list_`, `search_`, `fetch_`, `read_`, `query_`, `find_`) do not have `readOnlyHint: false` explicitly set | warning | Read-verb tools that write state are counterintuitive; either rename the tool or confirm annotation intentionality | Anthropic principle 2 + MCP annotation semantics (verb-annotation consistency) |
| `MTQS-A08` | Tool names beginning with write-verb prefixes (`delete_`, `remove_`, `destroy_`, `drop_`) do not have `readOnlyHint: true` set | error | A delete-verb tool marked read-only is a dangerous misclassification; correct the annotation immediately | MCP annotation semantics + Anthropic principle 2 |
| `MTQS-A09` | Tool names beginning with `create_`, `add_`, `insert_`, `append_` do not have `destructiveHint: true` (additive, not destructive) | warning | Additive operations should set `destructiveHint: false` to reduce confirmation friction; they do not overwrite or delete | MCP spec annotation intent + official blog |

### Dimension: Description-as-Prompt — Proxy Smell Heuristics
*Source: "MCP Tool Descriptions Are Smelly" (arxiv:2602.14878, Feb 2026) — six-component rubric; mechanically-detectable proxies only (full smell evaluation is L4)*

Note: The academic paper establishes that all six smells require LLM-based rubric scoring (ICC 0.62–0.90). The rules below are **proxy heuristics** — deterministic signals that are statistically associated with smells but do not guarantee one. They are explicitly marked as proxies.

| Rule ID | Check | Severity | Fix Hint | Source |
|---------|-------|----------|----------|--------|
| `MTQS-D04` | `description` length is at least 60 characters (proxy for Underspecified smell) | warning | Descriptions under 60 characters rarely cover purpose, usage guidance, and output; expand significantly | Smells paper: "Underspecified or Incomplete" smell; Anthropic principle 5 |
| `MTQS-D05` | `description` does not consist solely of a restatement of the name with spaces/underscores replaced (e.g., name `"get_user_by_id"` → description `"Get user by id"`) | warning | A name-restatement description gives agents no new information; describe what the tool returns and when to prefer it | Anthropic principle 5: "small refinements to descriptions yielded dramatic benchmark improvements"; smells: Unclear Purpose |
| `MTQS-D06` | `description` contains at least one of: a purpose clause (what), a when-to-use signal, or a constraint/limitation mention (proxy for Missing Usage Guidelines + Unstated Limitations smells combined) | hint | Structure descriptions as: "[what it does]. Use when [condition]. Returns [output]. [Limitation if any]." | Smells paper: Missing Usage Guidelines (89.3% prevalence) + Unstated Limitations (89.8% prevalence) |

### Dimension: Naming and Namespacing — Differentiation Rules
*Source: Anthropic "Writing effective tools for agents" principle 2 (namespacing); PRD §6.3*

| Rule ID | Check | Severity | Fix Hint | Source |
|---------|-------|----------|----------|--------|
| `MTQS-N04` | On servers with more than 10 tools, at least 50% of tool names follow a consistent namespace prefix pattern (e.g., `crm_*`, `files_*`, or `service/resource_verb`) | warning | Group related tools under a shared prefix so agents disambiguate by namespace first, then verb; use `asana_` not bare `search` | Anthropic principle 2: "grouping related tools under common prefixes... non-trivial effects on tool-use evals" |
| `MTQS-N05` | Tool names use a consistent casing convention within the server (not a mix of `snake_case` and `camelCase`) | warning | Pick one convention (snake_case preferred per community >90% usage) and apply it uniformly | SEP-986; community convention (>90% snake_case) |
| `MTQS-N06` | Tool names follow `[verb]_[noun]` or `[namespace]_[verb]_[noun]` structure (single-word names on servers with 5+ tools flagged) | hint | Single-word tool names like `"search"` or `"export"` provide no namespace context; use `crm_search_contacts` instead | Anthropic principle 2; smells paper: Unclear Purpose |

### Dimension: Parameter Semantics — Differentiation Rules
*Source: Anthropic "Writing effective tools for agents" (Sep 2025) — explicit naming examples*

| Rule ID | Check | Severity | Fix Hint | Source |
|---------|-------|----------|----------|--------|
| `MTQS-P03` | Parameters that appear to represent identifiers (property name ends in `id`, `_id`, or contains `identifier`) are typed as `"string"` or `"integer"`, not bare `{}` or `"object"` | warning | ID parameters should be scalar types; name them `user_id` not `user` per Anthropic guidance | Anthropic principle 5: "`user_id` not `user`" |
| `MTQS-P04` | Parameters named `user`, `account`, `contact`, `record` (bare entity names without `_id` suffix) are flagged for ambiguity when their type is `"string"` (suggests they are IDs, not objects) | warning | If this parameter accepts an identifier, rename it `user_id`; if it accepts a full object, give it `type: object` with `properties` | Anthropic principle 5: explicit `user_id` guidance |
| `MTQS-P05` | No parameter description is a duplicate of the parameter's property name with underscores replaced by spaces | warning | Parameter descriptions must add information beyond the name; state the format, valid range, or relationship to other params | Anthropic principle 5; smells paper: Opaque Parameters |

### Dimension: Output and Token Efficiency
*Source: Anthropic "Writing effective tools for agents" principles 3 and 4; MCP spec outputSchema*

| Rule ID | Check | Severity | Fix Hint | Source |
|---------|-------|----------|----------|--------|
| `MTQS-O01` | `outputSchema` is present (signals structured output intent) | info | Add `outputSchema` to declare what the tool returns; enables client-side validation and helps agents parse results | MCP spec: optional but valuable; Anthropic principle 3: "return meaningful context" |
| `MTQS-O02` | On tools whose name or description contains list/search/query terms, `inputSchema` exposes at least one of: a `limit`/`max`/`count` parameter, a `cursor`/`page`/`offset` parameter, or a filter/query parameter | warning | List and search tools without pagination or filtering can flood agent context; add `limit` with a sensible default | Anthropic principle 4: "implement pagination, range selection, filtering, and/or truncation with sensible defaults" |
| `MTQS-O03` | On tools that return what appears to be a collection (name starts with `list_`, `get_*s`, `search_`, or `query_`), `inputSchema` does not require zero parameters (a parameter-less list tool with no filter is an unbounded data dump) | warning | Even a simple `limit` parameter prevents unbounded context consumption; Claude Code defaults to 25,000-token cap | Anthropic principle 4: token efficiency |
| `MTQS-O04` | Parameters named `format`, `response_format`, `output_format` use `"enum"` to constrain allowed values | warning | Free-text format parameters cause agents to hallucinate format names; enumerate: `["detailed", "concise", "ids_only"]` | Anthropic principle 3: "optional response_format enum parameters allowing agents to request detailed or concise outputs" |

### Dimension: Surface Coherence (Server-Level)
*Source: Anthropic principle 1 (high-leverage tools, not thin wrappers); PRD §6.3*

| Rule ID | Check | Severity | Fix Hint | Source |
|---------|-------|----------|----------|--------|
| `MTQS-C01` | Server does not expose more than 64 tools without any namespace prefix grouping (>64 flat ungrouped tools signals thin API wrapping) | warning | Group tools by namespace; agents with >64 undifferentiated tools show measurable selection degradation (smells paper finding) | Anthropic principle 1: "high-impact workflows rather than wrapping every API endpoint"; smells paper: selection accuracy degrades with toolset size |
| `MTQS-C02` | No two tools have descriptions that are more than 90% identical (character-level similarity, not semantic) | warning | Nearly identical descriptions signal redundant or insufficiently differentiated tools; merge or differentiate them | Anthropic principle 1: "namespace and differentiate"; avoids agent confusion |
| `MTQS-C03` | `title` field is present on the tool (human-readable display name distinct from `name`) | hint | Set `title` to a human-readable label for UI display; `name` is machine-addressable, `title` is what users see | MCP spec: "title: Optional human-readable name for display purposes" |

---

## Anti-Features: Do NOT Build in L1

These are rules that **seem like they belong in the linter** but cannot be checked without a model. Including them in L1 would break the determinism guarantee — they belong in L4 eval.

| Anti-Feature | Why Requested | Why It Is L4, Not L1 | What to Do Instead |
|--------------|---------------|----------------------|-------------------|
| Semantic clarity scoring ("is this description clear?") | Catches Unclear Purpose smell directly | Requires LLM rubric scoring (ICC 0.62–0.90 per smells paper); not reproducible | Proxy rules MTQS-D04, MTQS-D05, MTQS-D06 catch the mechanical surface signals |
| "Would an agent select the right tool?" simulation | Directly measures agent usability | Requires running an agent against a prompt set; non-deterministic across models/versions | L4 eval; deterministic proxies from naming and description rules catch worst cases |
| Description quality scoring on a 1–5 scale | Mirrors smells paper rubric | All six rubric components require LLM-as-Jury (the paper explicitly states this) | MTQS-D01 through MTQS-D06 are the mechanical proxies |
| Natural language understanding ("does this description make sense?") | Detects confusing descriptions | Requires comprehension; no deterministic check | Flag as needing L4 eval when D05/D06 hints fire |
| Semantic deduplication ("do two tools do the same thing?") | Catches redundant tools (Anthropic principle 1) | Semantic equivalence is not deterministically checkable without embeddings/LLM | MTQS-C02 catches the mechanical similarity proxy (character overlap) |
| Cross-client compatibility ("does this tool work in Claude vs GPT-4o?") | Real usability concern | Requires running both clients; inherently non-deterministic | L4 cross-client eval matrix |
| "Is this error message actionable?" rating | Validates error guidance quality | Requires understanding agent error-recovery patterns | Flag as L4; L1 can only check error schema structure |
| Description freshness ("does the description match the schema?") | Catches semantic drift (L2 concern) | Requires comparing two versions semantically | L2 diff layer; not L1 |

---

## Feature Dependencies

```
MTQS-S01 (inputSchema present)
    └── required by: MTQS-S02, MTQS-S03, MTQS-S04, MTQS-S05, MTQS-P01, MTQS-P02
                         └── P01/P02 require properties block to exist inside inputSchema

MTQS-A01 (annotations present)
    └── required by: MTQS-A02 through MTQS-A09
        └── A06 requires BOTH A02 and A03 to have values to check cross-constraint

MTQS-N01 (name present and valid)
    └── required by: MTQS-N02, MTQS-N03, MTQS-N04, MTQS-N05, MTQS-N06
    └── required by: MTQS-A07, MTQS-A08, MTQS-A09 (verb-prefix checks)

MTQS-D01 (description present)
    └── required by: MTQS-D02, MTQS-D03, MTQS-D04, MTQS-D05, MTQS-D06, MTQS-C02

Server-level rules (MTQS-C01, MTQS-C02, MTQS-N04, MTQS-N05)
    └── require full tools/list (all tools evaluated together, not individually)
    └── are computed AFTER all per-tool rules complete
```

### Dependency Notes

- **Schema rules (S01–S08) are the prerequisite gate**: if `inputSchema` is absent or invalid JSON, parameter rules (P01–P05) cannot run. The rule engine must skip dependent rules when their parent is an error.
- **Server-level rules (C01–C03, N04–N05) require aggregation**: they run over the full tool list, not individual tools. This shapes the rule engine data model — single-tool mode must skip these.
- **Annotation cross-constraint (A06) requires A02 and A03 values**: it is a compound check that fires only when both `readOnlyHint: true` AND `destructiveHint: true` are explicitly present.
- **Verb-prefix annotation rules (A07–A09) combine N01 (name) and A02/A03 (annotation values)**: they are cross-dimension rules that need both dimensions evaluated.

---

## MVP Definition (MTQS v0.1)

### Launch With (v0.1)

Minimum viable ruleset — sufficient to produce a credible, defensible score against any MCP server.

- [ ] All 8 Schema Correctness rules (MTQS-S01 to S08) — correctness floor, non-negotiable
- [ ] Description presence and floor (MTQS-D01 to D03) — the most prevalent failures per smells paper
- [ ] Tool naming rules (MTQS-N01 to N03) — spec compliance, table stakes
- [ ] Parameter description and enum rules (MTQS-P01, MTQS-P02) — highest-prevalence issues
- [ ] Annotation presence rules (MTQS-A01 to A05) — the differentiator with the lowest implementation cost
- [ ] Annotation consistency rule (MTQS-A06) — prevents dangerous misclassification

**v0.1 total: 20 rules across 5 dimensions.** Produces a valid score. Demonstrates the thesis against the Apideck 229-tool server.

### Add After Validation (v0.2 — post-launch)

- [ ] Verb-annotation consistency (MTQS-A07 to A09) — add once annotation presence is established
- [ ] Description proxy heuristics (MTQS-D04 to D06) — add once D01–D03 baseline is validated
- [ ] Parameter ID-naming rules (MTQS-P03 to P05) — Anthropic `user_id` guidance
- [ ] Token efficiency rules (MTQS-O01 to O04) — output schema + pagination signals
- [ ] Naming differentiators (MTQS-N04 to N06) — namespace consistency
- [ ] Surface coherence rules (MTQS-C01 to C03) — server-level aggregation

**v0.2 total: 36 rules across 7 dimensions.** Full MTQS v0.1 feature parity.

### Future Consideration (v1.0+)

- [ ] `sensitiveHint` and `egressHint` annotation rules — pending spec ratification (SEP under discussion; "lethal trifecta" framing)
- [ ] `reversibleHint` annotation rule — same SEP track
- [ ] outputSchema property-level description rules — mirrors P01 for output schemas
- [ ] Custom ruleset / vendor extension mechanism — Spectral-style `extends` for org-specific rules

---

## Feature Prioritization Matrix

| Rule Group | User Value | Implementation Cost | Priority |
|------------|------------|---------------------|----------|
| Schema correctness (S01–S08) | HIGH — catches invalid schemas that break clients | LOW — JSON Schema validator library | P1 |
| Description presence (D01–D03) | HIGH — 97.1% of tools have description smells | LOW — string length + equality checks | P1 |
| Tool naming (N01–N03) | HIGH — spec compliance, clients reject bad names | LOW — regex + set uniqueness | P1 |
| Annotation presence (A01–A05) | HIGH — differentiator; unannotated = maximal risk posture | LOW — property presence checks | P1 |
| Annotation cross-constraint (A06) | HIGH — prevents dangerous misclassification | LOW — boolean logic | P1 |
| Parameter descriptions (P01–P02) | HIGH — 84.3% opaque parameters prevalence | LOW — iterate properties object | P1 |
| Verb-annotation consistency (A07–A09) | HIGH — catches semantic mismatches | MEDIUM — regex prefix matching + annotation lookup | P2 |
| Description proxies (D04–D06) | MEDIUM — proxies not guarantees; false positives possible | LOW–MEDIUM — length + string similarity | P2 |
| Token efficiency (O01–O04) | HIGH — prevents context flooding | MEDIUM — name/description pattern matching | P2 |
| Namespace consistency (N04–N06) | MEDIUM — server-quality signal | MEDIUM — aggregation across tools | P2 |
| Surface coherence (C01–C03) | MEDIUM — high-value but server-level | MEDIUM — aggregation, string similarity | P2 |
| ID-naming rules (P03–P05) | MEDIUM — Anthropic explicit guidance | LOW — property name pattern matching | P2 |
| sensitiveHint/egressHint (future) | HIGH — governance / L6 foundation | LOW once spec ratified | P3 |
| Custom ruleset extension | HIGH for enterprise adoption | HIGH — requires plugin system | P3 |

---

## Competitor Feature Analysis

| Rule Category | Glama TDQS | mcpx | Voke MTQS |
|---------------|------------|------|-----------|
| Schema validity | Inferred (LLM-judge) | Unknown (remote API, opaque) | Explicit per-rule (MTQS-S01–S08) |
| Description quality | LLM-judge, non-reproducible | Unknown | Deterministic proxies (D01–D06); full eval deferred to L4 |
| Annotation checking | Not documented | Not documented | Explicit presence + consistency (A01–A09) |
| Verb-annotation consistency | No | No | Yes (A07–A09) |
| Token efficiency signals | No | No | Yes (O01–O04) |
| Namespace consistency | No | No | Yes (N04–N06) |
| Per-rule findings with fix hints | No (narrative only) | No | Yes — every rule has a fix hint |
| CI-gradeable, reproducible score | No (LLM drift) | No (remote API, privacy concern) | Yes — same input, same output, always |
| Public rules repo | No | No | Yes (voke.sh/spec, accepts PRs) |
| Custom/vendor rule extension | No | No | Planned v1.0 (Spectral-style extends) |

---

## Sources

- Anthropic, "Writing effective tools for AI agents — using AI agents" (Sep 2025): https://www.anthropic.com/engineering/writing-tools-for-agents
- MCP Specification, Tools section (draft): https://modelcontextprotocol.io/specification/draft/server/tools
- MCP spec 2025-06-18 schema reference: https://modelcontextprotocol.io/specification/2025-06-18/schema
- MCP Blog, "Tool Annotations as Risk Vocabulary" (Mar 2026): https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/
- MCPBlog.dev, "MCP Tool Annotations" (Mar 2026): https://mcpblog.dev/blog/2026-03-13-mcp-tool-annotations
- SEP-986 (Final), "Specify Format for Tool Names": https://modelcontextprotocol.io/seps/986-specify-format-for-tool-names
- SEP-2106, Tools inputSchema/outputSchema JSON Schema 2020-12 (merged May 2026): https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2106
- MCP 2026-07-28 RC announcement: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- arxiv:2602.14878, "MCP Tool Descriptions Are Smelly!" (Feb 2026): https://arxiv.org/html/2602.14878v1
- arxiv:2602.18914, "From Docs to Descriptions: Smell-Aware Evaluation" (Feb 2026): https://arxiv.org/html/2602.18914
- JSON Schema 2020-12: https://json-schema.org/draft/2020-12
- Spectral rule format reference: https://github.com/stoplightio/spectral/blob/develop/docs/guides/4a-rules.md

---
*Feature research for: MTQS v0.1 — MCP Tool Quality Specification rule landscape*
*Researched: 2026-06-12*
