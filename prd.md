# Voke — Product Requirements Document

> Name: **Voke** (`voke.sh`, CLI is `voke`). Coined word, reads as a clip of
> *invoke* — the CLI invokes checks against a server. Locked; do not reopen.

---

## 0. How to use this document

This PRD is self-contained on purpose. It is meant to be dropped into a fresh
build session with no prior context. It encodes both **what** to build and
**why** each scope decision was made — the "why" is load-bearing, because the
main risk to this project is not technical difficulty, it's abandonment
mid-build.

The document was rewritten after a strategy pivot. Voke is no longer scoped as a
single runtime-monitoring tool; it is a **layered MCP observability platform**,
and the **first thing being built is not the monitor — it's an open
specification for MCP tool quality (MTQS) plus its reference linter.** If you
are about to write code, read §6 (the L1 build target), §13 (Build Order), and
§16 (Project Constraints) first.

---

## 1. One-sentence summary

Voke is an **open-source observability platform for MCP servers** — answering,
across a layered roadmap, "is this server well-designed, did this change break
it, is it still healthy, and can an agent actually succeed with it?" — and its
**entry point is the MCP Tool Quality Specification (MTQS): an open, versioned,
auditable ruleset for tool quality, shipped with a reference linter that runs in
any CI.**

---

## 2. The vision (read this before the scope)

The original framing of this project was a runtime monitor: "is my deployed MCP
server up and still itself?" That is a real product, but it is **one layer of a
larger thing**. The reframing: Voke is *the* observability layer for MCP
servers, and monitoring is a feature, not the whole product.

The platform is organized as a **layered roadmap**. Each layer is independently
shippable and independently useful; they are built in sequence, and each one
earns the right to the next by being good on its own.

| Layer | Question it answers | Status |
|---|---|---|
| **L1 — Quality / linting** | *Is this tool well-designed for an agent?* | **← current build target (this PRD)** |
| **L2 — Diff / breaking-change gate** | *Did this PR break or degrade the surface?* | Next; designed-for |
| **L3 — Runtime health** | *Is the deployed server still up and still itself?* | Designed-for (was the original PRD; preserved in §9) |
| **L4 — Eval (model-in-the-loop)** | *Can an agent actually succeed at real tasks with these tools?* | The moat / main pricing power |
| **L5 — Analytics** | *How is the surface used and how is quality trending?* | Stub |
| **L6 — Governance / blast-radius** | *Which tools are dangerous, and who can call them?* | Stub |

Why this order and not "monitor first": L1 is the lowest-friction way to put
something defensible and *ownable* into the ecosystem. It runs anywhere (no
deployed server required, no infra to operate), it produces shareable content on
every rule, and — critically — it lets Voke plant a flag on a category nobody
credible owns yet: **the standard for what "good" means for an MCP tool.**

---

## 3. Problem

There are really three problems stacked on top of each other. The platform
addresses them at different layers; **L1 addresses the first.**

### 3.1 There is no agreed, transparent definition of MCP tool quality (L1)

People ship MCP servers with tool surfaces that agents struggle to use:
descriptions that read like internal API docs instead of prompts, parameters
named `user` instead of `user_id`, no enums on constrained fields, missing
behavioral annotations, raw UUIDs in responses, no pagination on tools that
return unbounded data. Anthropic's own engineering guidance documents exactly
these failure modes — yet there is **no open, reproducible, auditable standard**
a team can run in CI to check their surface against. The one public scoring
system (Glama's TDQS) is **closed and non-reproducible** (see §4).

### 3.2 Three kinds of breaking change, only one of which anyone catches (L2)

When a server changes, breakage comes in three flavors:

- **Structural** — a tool or field is removed, renamed, or retyped. Mechanically
  diffable. *Partially* solved by existing tools.
- **Semantic** — the schema is byte-identical but a *description* is reworded, so
  the agent now behaves differently. **Nobody solves this.**
- **Behavioral** — the schema and description are unchanged but the underlying
  logic changed, so the same call now does something different. **Nobody solves
  this.**

Semantic + behavioral drift is Voke's wedge: it is real, it is painful, and the
incumbents are structurally blind to it.

### 3.3 "Up" is not "healthy and still itself" (L3)

Transport can respond `200` while `tools/list` quietly drops a tool, a schema
drifts, auth silently 401s, or a working tool starts 500-ing. Generic HTTP
uptime monitors don't understand MCP, so they miss exactly the failures that
matter. (This is the original PRD; it is fully specified in §9 and is *not* the
current build target.)

---

## 4. Why an open specification wins — the core strategic bet

The single most important decision in this document: **L1 is not "a linter," it
is an open specification — the MCP Tool Quality Specification (MTQS) — for which
the linter is merely the reference implementation.** The model is
ESLint / WCAG / AsyncAPI: own the standard, and you own the ecosystem around it.

This is the thing the incumbent structurally cannot do:

- **Glama's scoring is closed and non-reproducible.** The dimension *weights* are
  published, but the methodology post that explained them now 404s, there is no
  rules repo, and the explanations are narrative and context-sensitive — the
  fingerprint of an **LLM-as-judge**. That is why the same server can score "A"
  one hour and "C" the next with no code change. **Non-determinism leaking into a
  CI signal is a fundamental trust problem for developer tooling.** You cannot
  gate a release on a number that changes when nothing changed.
- **An open, deterministic spec is auditable.** Rules live in a repo, run
  locally and in CI, produce the same score for the same input every time, and
  every score traces to a specific rule. "Why did my score drop?" has an answer.
- **It is non-gameable in the bad sense and improvable in the good sense.**
  Because the rules are explicit, a team can systematically fix their surface
  instead of guessing what a black box wants.
- **It compounds into authority.** A versioned spec that accepts community PRs,
  anchored to the author's AsyncAPI TSC credibility and the 229-tool Apideck
  reference server, becomes a conference/API-Days artifact and an industry
  reference. Glama (a marketplace + gateway business) cannot publish a neutral
  open standard for the same thing it scores proprietarily.

**Hard rule (from the project owner): do not copy Glama's scoring system.** MTQS
is synthesized from first principles out of primary sources — the MCP
specification, Anthropic's tool-writing guidance, JSON Schema, and the academic
literature on tool-description quality (§6.2). Glama's weights are noted only as
a competitor data point, never as a template.

---

## 5. Competitive landscape

| Player | What it actually is | Gap Voke exploits |
|---|---|---|
| **Glama.ai (TDQS)** | MCP marketplace + gateway; TDQS is a directory metric | Closed, LLM-judge, non-reproducible; no rules repo; no `--fix`; crawls on *their* schedule, not your CI; can't gate a PR |
| **mcpx** | CLI with lint/inspect/health/diff + A–F grade | Thin client — all grading runs on a remote API (privacy, fragility, no air-gap, opaque); diff is URL-vs-URL, wrong for CI |
| **Optic** | OpenAPI diff-lint CI gate (the L2 model) | **Repo archived Jan 2026** — category seat empty; was REST-only, never MCP |
| **mcpindex** | Runtime in-path contract gate (pins contract, HOLDs on drift) | Different use case (in-path enforcement, not pre-merge quality/diff) |
| **Bellwether / FlareCanary / health-monitors** | OSS or SaaS runtime MCP drift/uptime | L3-only; none touch tool *quality* (L1) or semantic diff (L2) |

The **L1 quality-spec seat is effectively empty.** The only occupant (Glama)
holds it with a closed proprietary score. That is the opening.

---

## 6. L1 — the current build target: MTQS + reference linter

L1 ships **three coupled deliverables**:

1. **The MTQS specification** — an original, versioned, documented ruleset for
   MCP tool quality, published at `voke.sh/spec`, in a public repo, accepting PRs.
2. **The reference linter** — the CLI (`voke lint`) that *is* the canonical
   implementation of MTQS. It runs locally and in CI, is fully deterministic, and
   emits per-rule findings + a score.
3. **The launch blog post** — frames the problem, introduces the spec, runs it
   live against real servers (incl. the 229-tool Apideck reference), and makes
   the category claim.

### 6.1 What MTQS is (and is not)

MTQS scores a tool surface **deterministically** against an explicit set of
rules. Each rule has a stable **rule ID**, a **severity** (error / warning /
info / hint), a **mechanical check** (no model in the loop — that is L4's job),
and a **fix hint**. Scores aggregate per-tool dimension scores into a tool
score, and tool scores into a server score, with **published weights and tiers**
(the formula is part of the spec, versioned alongside the rules).

MTQS is **not** an LLM-as-judge. The entire point versus Glama is that the same
input always produces the same output. Anything that genuinely needs a model
("would an agent pick the right tool?") is **L4 eval**, deliberately kept out of
L1 so the L1 signal stays CI-gradeable.

### 6.2 Where the rules come from (primary sources, not Glama)

The ruleset is synthesized from authoritative, citable sources:

- **Anthropic, "Writing effective tools for agents — with agents"** (Sep 2025) —
  the gold-standard primary source. Its five principles map almost directly onto
  MTQS dimensions: choose high-leverage tools (not thin API wrappers); namespace
  and differentiate; return meaningful context (not raw IDs); optimize for token
  efficiency (pagination/filtering/truncation); and **prompt-engineer tool
  descriptions** ("describe it like you would to a new hire"; `user_id` not
  `user`; `search_contacts` not `list_contacts`). The framing — a tool is *a
  contract between a deterministic system and a non-deterministic agent* — is the
  spec's thesis.
- **The MCP specification** (tool definition: `name`, `title`, `description`,
  `inputSchema`, optional `outputSchema`, `annotations`) and its **five tool
  annotations** (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`,
  `openWorldHint`), plus the community-proposed `sensitiveHint` / `egressHint`
  (the "lethal trifecta" SEPs). Annotation presence + consistency is a
  mechanical, high-value signal almost no server uses today.
- **JSON Schema** best practice (per-property descriptions, enums for constrained
  values, explicit required/optional, no bare untyped objects) — and the
  **2026-07-28 RC's lift to full JSON Schema 2020-12** (see §11).
- **Academic literature** — "MCP Tool Descriptions Are Smelly" (selection
  accuracy degrades with toolset size; poisoned/ambiguous descriptions; silent
  failure because the "client" is an LLM that reasons around bad data instead of
  erroring). This gives a concrete "description smells" taxonomy to turn into
  mechanical rules.

### 6.3 Candidate MTQS dimensions (to be finalized in the spec doc itself)

These are the working dimensions — each must be justified from a source above,
each must reduce to mechanical checks, and each must carry a fix hint. (The full
per-dimension rubrics are authored in the spec document, not here.)

| Dimension | Sample mechanical checks | Primary source |
|---|---|---|
| **Description-as-prompt** | description present; min length; covers purpose / when-to-use / output / errors; not a bare API restatement | Anthropic; AWS guidance |
| **Parameter semantics** | every property has a description; constrained fields use `enum`; IDs named `*_id`; required list explicit; no bare untyped params | Anthropic (`user_id`); JSON Schema |
| **Naming & namespacing** | namespaced names (service/resource prefix); no two tools collide in purpose; clear distinct verbs | Anthropic (principle 2) |
| **Behavioral transparency** | annotations present; `readOnly`/`destructive`/`idempotent`/`openWorld` set; consistent with verb (e.g. `delete_*` not marked readOnly) | MCP annotations |
| **Output & token efficiency** | `outputSchema` present; responses expose pagination/filter/`response_format`; avoids raw-ID-only fields | Anthropic (principles 3–4) |
| **Schema correctness** | valid JSON Schema 2020-12; root `type: object`; bounded depth; no unresolved external `$ref` | MCP spec / RC |
| **Surface coherence** *(server-level)* | high-leverage tools (flagged thin wrappers); no redundant/overlapping tools; reasonable tool count | Anthropic (principle 1) |

### 6.4 Rule format

Model the rule definition format on **Spectral** (the OpenAPI/AsyncAPI linter,
familiar from the AsyncAPI TSC seat): a rule has an ID, severity, a target
(`given`), and an assertion (`then`/function). This makes MTQS rules feel native
to anyone who has linted an API spec, and leaves a clean path to custom/local
rules and rule extensibility (vendor rulesets, opt-in strictness levels).

### 6.5 L1 deliverable definition of done

- `voke lint <server-url-or-file>` connects to a real MCP server (or reads a
  saved tool dump), evaluates every MTQS rule deterministically, and prints
  per-rule findings + a per-tool and server score + tier.
- Same input → same output, every run (the anti-Glama property).
- Runs in a GitHub Action and can **fail the build below a threshold** (`--min-score`).
- The spec is published and versioned at `voke.sh/spec`; the linter version
  declares which MTQS version it implements.
- The launch post runs it live against the 229-tool Apideck server and at least
  one other public server.

---

## 7. L2 — diff / breaking-change gate (next, designed-for)

The Optic analog for MCP, and the seat Optic vacated when it was archived.

- `voke diff --base main` compares the current tool surface against a committed
  baseline (branch/ref), **not** URL-vs-URL (that is mcpx's mistake — wrong for
  CI). Forwards-only governance, run pre-merge.
- Catches **structural** drift mechanically (tools/fields added/removed/retyped)
  and flags **semantic** drift (description changed, schema unchanged) — the
  thing nobody else surfaces.
- Reuses the L1 rule engine: a diff is "did any MTQS-relevant property change,
  and did the score move?"

Not built yet; specified here so L1's data model leaves room for it (snapshots,
stable per-tool identity, score deltas).

---

## 8. L3 — runtime health (the original PRD, preserved)

> This section is the **complete original runtime-monitoring PRD**. It is a real,
> well-specified layer and nothing here is discarded — but it is **no longer the
> first thing built**. It is retained verbatim-in-substance so the design isn't
> lost and so L1's primitives stay compatible with it.

### 8.1 What L3 is

A check runner built around one primitive — *connect to an MCP server → do
something → assert → report* — running **liveness** and **tool-surface-snapshot**
checks on a schedule, debouncing results through a **state machine**, and
emitting exactly one normalized `firing`/`resolved` event into the customer's
own paging stack (Slack / generic webhook). Runnable as a **GitHub Action
cron**, with no hosted infrastructure the maintainer has to operate.

```
scheduler → check engine → evaluator (thresholds + state machine)
          → emitter (normalized envelope) → adapter fan-out → customer's pager
```

### 8.2 L3 scope

- **Transport:** streamable HTTP only (monitoring deployed servers; stdio is local-only).
- **Auth:** static bearer token / custom header.
- **Liveness check:** connect + `tools/list` succeeds. Optional canary *call*
  only against a tool the user explicitly marks read-only. Default probe is the
  side-effect-free `tools/list` — never blind-call tools on a cron.
- **Snapshot check:** capture tool names + input schemas, diff against the last
  stored snapshot, flag added/removed/changed tools.
- **Evaluator / state machine:** consecutive-failure threshold, explicit
  `firing → resolved`, one dedup key per `(server, check)`. **Load-bearing core.**
- **Envelope:** versioned `voke.alert.v1` contract (§8.3).
- **Destinations:** `stdout-json` (testing), `webhook` (generic — maps ~1:1 onto
  PagerDuty Events v2), `slack` (the demoable one).
- **Runtime:** GitHub Action wrapper + YAML config.

**Explicitly out of scope for L3:** hosted/always-on; paging/escalation/on-call;
dead-man's-switch; web dashboard; OAuth; non-HTTP transports. **We are not a
pager** — Voke decides firing/resolved; the customer's tool owns escalation and
delivery.

### 8.3 Alert envelope — `voke.alert.v1`

A public, versioned contract. Maps almost 1:1 onto PagerDuty Events API v2
(native `dedup_key` + trigger/resolve), so the generic webhook adapter covers
PagerDuty with no bespoke code.

```json
{
  "schema": "voke.alert.v1",
  "dedup_key": "server_id:check_id",
  "state": "firing | resolved",
  "severity": "critical | warning",
  "server": { "id": "...", "name": "...", "url": "..." },
  "check":  { "id": "...", "type": "liveness | snapshot_diff | eval", "name": "..." },
  "summary": "Canary tool `create_invoice` returned 500",
  "detail":  { "...": "check-specific, e.g. which tool disappeared from tools/list" },
  "first_seen": "ts",
  "last_seen": "ts",
  "occurrences": 3
}
```

### 8.4 State machine (the part "just integrate with their pager" hides)

A single red reading is **not** an alert. The runner owns three things before
any handoff: a **consecutive-failure threshold** (kills flapping), **explicit
`firing → resolved` transitions** (or you strand open incidents in someone's
pager), and a **dedup key per `(server, check)`** (50 reds collapse into one
incident).

| Current | Observation | Counter | Action | New |
|---|---|---|---|---|
| `ok` | pass | reset 0 | none | `ok` |
| `ok` | fail | +1 | if ≥N emit `firing` | `pending` or `firing` |
| `pending` | fail | +1 | if ≥N emit `firing` | `pending` or `firing` |
| `pending` | pass | reset 0 | none | `ok` |
| `firing` | fail | — | update `last_seen`/`occurrences` | `firing` |
| `firing` | pass | reset 0 | emit `resolved` | `ok` |

### 8.5 Cross-run state persistence

Every Action run is a fresh stateless process, but the state machine needs
yesterday's snapshot *and* current firing status. **Recommended default:** commit
a `snapshots/` dir + `state.json` back to the repo (Actions cache is evicted; git
is reliable). Bonus: a git-tracked, PR-diffable audit trail of the surface over
time.

### 8.6 L3 SLO (publish it — honesty is a trust signal)

Check every 5 min (configurable); detection→emit p95 under ~30s; **not**
sub-minute, **not** a guaranteed-delivery pager (emit is best-effort, the
customer's pager owns delivery). No dead-man's-switch in this layer.

---

## 9. L4 — eval (the moat and the main pricing power)

Model-in-the-loop grading: *can an agent actually succeed at real tasks using
these tools?* This is where the genuinely hard, genuinely valuable, genuinely
defensible work lives — and the one place a model belongs (kept out of L1/L2/L3
precisely so those stay deterministic).

- Generates real-world, multi-tool-call eval tasks (per Anthropic's eval
  methodology), runs agentic loops against the server, and grades tool selection,
  schema usability, error legibility, and context cost.
- **Non-deterministic by nature** → reports pass-*rates* and thresholds (e.g.
  8/10), never pass/fail. Costs model calls per run.
- Natural home is a **CI/PR gate** ("did this PR make our server harder for an
  agent to use?") — a release-confidence product in the lineage of
  Chromatic / Snyk / CodeRabbit.
- **Cross-client matrix** ("works in Claude vs ChatGPT vs Cursor") is just the
  eval run against different models.

This is the layer with real pricing power. Nobody does it. Do not build it until
L1 has earned an audience.

---

## 10. L5 / L6 — analytics, governance (stubs)

- **L5 Analytics:** how the surface is used, how MTQS scores trend over time,
  which tools churn. Mostly falls out of data the lower layers already collect.
- **L6 Governance / blast-radius:** which tools are destructive / sensitive /
  egress-capable (built on annotations from L1), and policy over who may call
  them. Adjacent to the "lethal trifecta" annotation work.

Intentionally underspecified. Listed so the roadmap shows depth, not so anyone
builds them soon.

---

## 11. Tailwind: the 2026-07-28 MCP release candidate

The next MCP spec revision (RC announced May 21 2026; targeting 2026-07-28) is
the largest since launch and is a direct tailwind for L1/L2:

- **`inputSchema`/`outputSchema` lift to full JSON Schema 2020-12** (SEP-2106):
  input keeps a `type: "object"` root but now allows composition
  (`oneOf`/`anyOf`/`allOf`), conditionals, and `$ref`/`$defs`; output is
  unrestricted; `structuredContent` can be any JSON value. Implementations **must
  not** auto-dereference external `$ref` and **should** bound schema depth — both
  are mechanical MTQS rules.
- Missing-resource error code changes `-32002` → standard `-32602` (SEP-2164).
- Formal deprecation policy; stateless core; Extensions, Tasks, MCP Apps; OAuth/
  OIDC hardening.

**Every production server must migrate, and no tool helps them check whether
their migrated surface is still good.** That is precisely L1 + L2. The spec
should target JSON Schema 2020-12 from day one.

---

## 12. Monetization

- **L1 (spec + linter): free, forever.** It is the distribution and reputation
  layer, not the revenue. Trying to monetize a self-hosted CLI directly would
  cap the project at a thin $10–150/mo uptime band and kill the adoption flywheel.
- **Real pricing power is L4** (eval/CI gate) and a hosted tier for L3
  (operate the scheduler/evaluator/emitter; add dead-man's-switch there).
- **The largest actual ROI for the owner is reputational**, not MRR: an owned
  open standard, API-industry influence, conference artifacts, Field-CTO-style
  external positioning. Optimize L1 for that, not for subscriptions.

Open-core, ESLint-style: the standard and its CLI are free and ubiquitous; the
paid surface (eval, hosted, cross-client) sits above it and is never built into
the MVP.

---

## 13. Build order (spec → linter → post; CORE BEFORE ADAPTERS)

The pivot changes the entry point from L3's state machine to **L1's spec +
linter**. The discipline is the same: build the boring correct core first, let
the shareable surface be the reward.

1. **Finalize TS vs Python** (TS recommended — most complete MCP SDK, trivial in
   Actions, contributor-friendly). The only decision required before code.
2. **Author MTQS v0.1** — per-dimension rubrics (definition + 1–5 scale +
   mechanical checks + fix hint), scoring formula + A–F tiers, rule IDs +
   severities, extensibility section. Original, justified from §6.2 sources,
   explicitly not Glama-derived. This is a *writing* task and it gates the code.
3. **Rule engine + result type** — shaped so L2 (diff) and custom rules slot in.
4. **Tool-surface ingestion** — connect via the MCP SDK and pull `tools/list`
   (and read a saved dump), targeting JSON Schema 2020-12.
5. **Implement MTQS rules** as the reference linter; deterministic scoring.
6. **`voke lint` CLI** — findings + scores + `--min-score` exit code.
7. **GitHub Action wrapper + config + README that is also the demo.**
8. **Publish the spec** at `voke.sh/spec` (versioned, public repo, PRs open).
9. **Write the launch blog post**, run live against the 229-tool Apideck server.

### First finishable unit
> `voke lint` against one real server → deterministic per-rule findings + a
> stable score → same output on a re-run. That is the spine; the spec doc and the
> post hang off it.

---

## 14. Definition of done (this is the launch)

`voke lint https://mcp.apideck.dev/mcp` runs the full MTQS ruleset against a
real 229-tool production server, prints per-rule findings + per-tool + server
scores + tier, returns the **same** result on a re-run, and can fail a GitHub
Action below a threshold. The spec is published and versioned at `voke.sh/spec`.
The launch post tells the "there is no open standard for MCP tool quality — here
is one" story with the linter as proof.

The day that runs green (and reproducibly) against a server you didn't write is
the day you have a category claim to post about.

---

## 15. Recommended stack

**TypeScript.** The official MCP SDK is most complete in TS (talk to servers via
maintained protocol code, not hand-rolled JSON-RPC); GitHub Actions runs Node
with zero fuss; it is the most contributor-friendly choice for OSS in this
space; and Spectral-style rule tooling has good TS ergonomics. Python is
defensible if strongly preferred, but TS is the lower-friction path. **Confirm
this before writing anything** (build-order step 1).

---

## 16. Project constraints (these shaped the scope — keep them)

- **Solo, part-time:** ~2–3h/day alongside a full-time job. Work must decompose
  into self-contained, schedulable units. Nothing requiring the whole system in
  working memory at once, and **nothing that creates an on-call obligation
  running on its own clock** (this is why hosted/paging is deferred, and why L1 —
  which runs in the user's CI, not on the owner's infra — is the right entry
  point).
- **Build in the open:** OSS-native. Every rule, dimension, and layer is also
  shareable content; the public feedback loop is a feature.
- **Spec-first, then implementation:** the spec is the product; the linter is its
  proof. Do not let the code get ahead of a documented, defensible ruleset.
- **Do not copy Glama.** MTQS is synthesized from primary sources. Glama is a
  competitor data point, never a template.
- **Open-core monetization, deferred:** CLI + spec free (drives adoption); eval/
  CI gate, hosted L3, cross-client matrix are paid candidates later. Don't build
  the paid surface in the MVP.
- **No employer conflict:** Voke is a *user/observer* of MCP servers, never a
  unified-API or connector or agent-authorization-fabric product. **Hard line: do
  not drift toward an MCP gateway/proxy.**
- **Abandonment is the #1 risk.** The build order front-loads the hard core
  (the rule engine + a deterministic score) and keeps a demoable artifact
  reachable early — `voke lint` against one real server — not buried at step 9.
