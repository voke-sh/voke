# MTQS L1 — Scope

> **Status:** Normative  
> **Version:** v0.1  
> **Last updated:** 2026-06-12

This document is the single-page normative boundary statement for the MCP Tool Quality
Specification (MTQS) L1. It defines what L1 is, what it is not, the determinism guarantee
that makes it CI-trustworthy, the scope-creep prevention rule for rule PRs, and the version
boundary. Every rule, dimension, and score produced by MTQS L1 must remain inside these
boundaries. This document is linked from spec §1.3 and from CONTRIBUTING.md.

---

## 1. What MTQS L1 Is

MTQS L1 is a **deterministic, rule-based static analysis** of an MCP tool surface.

- **Runs locally and in CI** — no hosted service required; `voke lint <server>` is a single
  command that produces a result in any environment with Node.js ≥ 22.
- **Consumes:** the `tools/list` surface — specifically: `name`, `title`, `description`,
  `inputSchema`, `outputSchema`, and `annotations` (readOnlyHint, destructiveHint,
  idempotentHint, openWorldHint).
- **Produces:** per-rule findings → per-tool score (0–100) → server score (mean of tool
  scores) → A–F tier.
- **Auditable:** every lost point traces to exactly one rule ID, which traces to exactly one
  citable primary source (MCP spec / Anthropic guidance / JSON Schema 2020-12 / peer-reviewed
  paper). No black-box scoring.
- **Reproducible:** same `tools/list` input on any platform on any date → same findings,
  same scores, same tier. This is the core trust property.

---

## 2. What MTQS L1 Is Not (Hard Boundaries)

### NOT an LLM-as-judge

MTQS L1 does **no LLM** evaluation of any kind. There is no model call in any rule function.
Rule functions are typed `(ctx: RuleContext) => Finding[]` — pure, synchronous, no IO. The
**LLM-as-judge** pattern (sending tool descriptions to a model and asking "is this good?") is
explicitly excluded from L1. It belongs in L4 (Agent Evaluation), which is a separate
specification. The ICC inter-annotator agreement scores for LLM-based tool evaluation (0.62–
0.90, see arxiv:2602.14878) are acceptable for academic research but not for a CI gate where
reproducibility is non-negotiable.

### NOT a gateway or proxy

Voke is a **read-only observer** of `tools/list`. It NEVER sits in the execution path of tool
calls. It does not intercept, forward, transform, rewrite, or proxy MCP requests. The
**gateway** and **proxy** patterns are hard out-of-scope for MTQS L1. This is an employer-
conflict boundary: Voke observes MCP servers; it does not become one. Any proposed feature
that requires Voke to sit between an agent and a server is rejected from L1.

### NOT a runtime monitor

MTQS L1 has no scheduling, no alerting, no polling, no health checks, and no stateful
tracking of tool surface changes over time. These belong in L3 (Runtime Health Monitor), which
is a separate specification. L1 takes a point-in-time snapshot of `tools/list` and scores it.
It does not watch for changes.

### NOT an agent evaluator

MTQS L1 does not execute tasks, does not run an agent loop, and does not ask "would an agent
succeed at task X using this server?" That question requires L4 (Agent Evaluation). L1 checks
mechanical properties of the tool surface — properties that can be verified without running
any tool call.

### NOT a semantic linter

MTQS L1 rules check **mechanical properties only**. Whether a description is "clear,"
"accurate," or "helpful" cannot be determined without a model — that is an L4 evaluation.
L1 uses mechanical proxies: minimum length (≥ 20 chars), absence of copy-of-name, presence of
a description string. These proxies are imperfect by design: they set a floor, not a ceiling.
Semantic quality is a separate, harder problem that belongs in L4.

### NOT an L2 diff / breaking-change gate

MTQS L1 does not compare tool surfaces across versions, detect removed tools, flag parameter
renames, or gate deployments on breaking changes. **L2** (Diff and Breaking-Change Gate) is a
separate specification. The L1 data model (stable per-tool identity via `name`, integer-first
scoring) is designed to leave room for L2 tooling — but diffing is not built in L1. Any
proposed rule that requires access to a previous snapshot is an L2 candidate.

---

## 3. The Determinism Guarantee

**Same `tools/list` input → same output, every run, on any platform.**

This guarantee is the entire competitive wedge against closed, non-reproducible scoring
systems. Every design decision in MTQS L1 must preserve it. Violations are trust failures.

### Required implementation constraints

To uphold the determinism guarantee, implementations MUST:

1. **Sort tool arrays** alphabetically by `tool.name` before scoring — the MCP protocol does
   not guarantee `tools/list` ordering.
2. **Use integer-first arithmetic** — compute `penalty = Math.round(basePenalty * multiplier)`
   per finding, then sum the rounded integers; do not accumulate floats and round at the end.
3. **Make no external network calls in rule functions** — rule functions receive a typed
   `RuleContext` object containing the tool snapshot; they must not call `fetch`, `http`, or
   any async IO.
4. **Reference no wall-clock values in scoring** — scores must not depend on the current
   date, time, or environment variables.
5. **Evaluate rules in alphabetical order by rule ID** — MTQS-A01, MTQS-A02, …, MTQS-S01,
   …, MTQS-S08; findings sorted by `toolId → ruleId → path`.

### Prohibited in rule functions

Any rule requiring IO, randomness, a model call, a network request, or access to system state
**MUST NOT** be added to L1. If the rule cannot be expressed as a pure function of a typed
`ToolSnapshot` object, it is an L4 candidate, not an L1 rule.

---

## 4. Scope Creep Prevention

This section governs how rules are added or changed. It is normative for rule PRs.

### A rule PR MUST

1. **Cite a primary source** — one of: the MCP specification, Anthropic's published guidance
   ("Writing effective tools for agents"), JSON Schema 2020-12, or a peer-reviewed paper. The
   citation must be a direct URL or DOI, not a blog post paraphrasing a primary source, and
   **never Glama** (competitor reference is prohibited as a primary source; Voke must
   synthesize from independent primary sources to remain a credible open standard).

2. **Demonstrate mechanical checkability** — the PR must include a concrete test showing that
   the rule passes/fails on a typed `ToolSnapshot` without any model call. If the check
   requires sending text to an LLM, it is not mechanical.

3. **Assign a dimension** — one of: `schema`, `description`, `naming`, `parameters`,
   `annotations`. Rules that do not fit a v0.1 dimension are L2+ candidates or require a
   spec amendment to add a new dimension (minor version bump).

### A rule PR MUST NOT

- Introduce any IO in the rule function body.
- Use `any` TypeScript type in the rule implementation.
- Reference Glama's scoring system, methodology, or rule set as justification.
- Require a previous tool snapshot (that is an L2 feature).

### Rejection criteria

Any proposed rule requiring **semantic understanding** (e.g., "is this description accurate?",
"does this tool name communicate its intent?") is **rejected from L1** and labeled as an
**L4 candidate**. The L4 label is not a rejection of the idea — it is an accurate routing
decision. The idea is preserved for the Agent Evaluation specification.

---

## 5. Version Boundary

MTQS L1 versioning follows semver with additive minors:

| Version | Rules | Dimensions | Status |
|---------|-------|------------|--------|
| **v0.1** | 20 rules across 5 active dimensions (schema, description, naming, parameters, annotations) | 5 active | This specification |
| **v0.2** | +16 differentiator rules (A07–A09, D04–D06, O01–O04, N04–N06, C01–C03) | 7 active | Planned |

### Stability guarantees

- **Rule IDs are stable forever.** `MTQS-S01` will always mean "inputSchema presence." Rule
  IDs are never reassigned or removed — they may be deprecated (severity downgraded to `hint`)
  but the ID persists.
- **Adding rules = minor version bump** (v0.1 → v0.2). Existing rules are unchanged.
- **Changing severities or weights = major version bump** (v0.x → v1.0). This changes scores
  for existing tool surfaces and must be communicated as a breaking change.
- **A linter MUST declare which MTQS version it implements.** A v0.1 linter evaluates exactly
  the 20 v0.1 rules; it does not silently pick up v0.2 rules.

### Layer boundary

**New layers (L2–L6) are separate specifications, not extensions of L1.** L2 (Diff), L3
(Runtime Health), L4 (Agent Evaluation), L5 (Analytics), and L6 (Governance) each have their
own specification documents. MTQS L1 does not absorb their scope. A feature request that
belongs in L2–L6 is welcomed but routed to the correct specification track.

---

*This document is maintained in the Voke repository at `spec/SCOPE.md`. To propose a change,
open a PR with a rationale that references this document and the relevant primary source.*
