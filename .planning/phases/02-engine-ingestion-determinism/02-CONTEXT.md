# Phase 2: Engine + Ingestion + Determinism - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the determinism-guaranteed runtime: a Spectral-shaped rule engine that runs pure synchronous rules against a canonicalized tool surface acquired from either a live MCP server or a saved snapshot, with all 7 determinism enforcement points baked in. Exit criterion: byte-identical output across 3 consecutive runs on identical input.

This phase delivers ENG-01..04 and ING-01..05. No MTQS rule logic (Phase 3) and no CLI/scoring-output wiring (Phase 4) — only the engine, ingestion, data model, and determinism scaffolding the rules will plug into. The `@voke/core` scoring helpers (integer-first, caps, tiers) already exist from Phase 1 and are consumed, not rebuilt.

</domain>

<decisions>
## Implementation Decisions

### Snapshot format & L2-readiness (Area A)
- **D-01:** Two distinct artifacts, two flags. `voke lint --save-snapshot` writes a **raw `VokeSnapshot`** (canonical tool surface, no scores); `voke lint --output json` writes a **scored `LintReport`**. This resolves the ARCHITECTURE.md contradiction (VokeSnapshot vs "LintReport doubles as snapshot") by keeping both as separate, purpose-built types. Ingestion output (`VokeSnapshot`) stays independent of rule/score changes; L2 diff can diff raw surfaces and/or score deltas.
- **D-02:** `capturedAt` (and any wall-clock/provenance) lives in a **separate metadata block**, excluded from `snapshotContentHash` and excluded from the byte-identical determinism test. The canonical hashed/compared body covers only the tool surface + findings/scores. Determinism preserved, provenance retained.
- **D-03:** Identity locked to the ARCHITECTURE/ING-04 design: `toolId = tool.name`; tools sorted ascending by `toolId`; per-tool `contentHash` = SHA-256 of canonical JSON of `{name, description, inputSchema, outputSchema, annotations}`; surface hash = SHA-256 of the sorted tools array. No namespace-composite id in v0.1 (N03 duplicate-name is the only server rule; composite id deferred).

### Schema validation strictness — ING-05 (Area B)
- **D-04:** **Two depth bounds, separated by purpose.** Ingestion enforces a HARD safety cap (stops hang/OOM/DoS) — a schema exceeding it is rejected at ingestion. A separate, lower QUALITY threshold is just a Phase-3 S-rule finding (too complex for an agent, not a crash risk). "Will crash us" ≠ "too complex."
- **D-05:** Depth counting: `depth(node) = 1 + max(depth of children)`. A `oneOf`/`anyOf`/`allOf` wrapper itself adds **0** levels — recurse into each branch and take the deepest. Machine-generated `allOf` chains are not penalized for wrapping alone.
- **D-06:** ajv config: instantiate `Ajv2020` from `ajv/dist/2020`, **`strict: false`**, accept full JSON Schema 2020-12 (`unevaluatedProperties`, `unevaluatedItems`, `prefixItems`, `$dynamicRef`). `loadSchema` is **never wired** (no network). Use ajv's `validateSchema` to determine whether the schema IS valid 2020-12 — that boolean feeds the S-rule. `strict:false` so legit-but-unusual schemas aren't rejected by ajv's own strictness (ajv-strictness ≠ MTQS-invalidity).
- **D-07:** Internal `$ref` (same-document `$defs`) is **left intact** — never dereferenced by us. ajv resolves it natively at validate time. Canonical JSON / `contentHash` keep `$ref` as-written: no circular-JSON crash, no surface mutation, stable L2 diff form. Only **external** `$ref` is flagged (S04, Phase 3).

### Ingestion failure & auth UX (Area C)
- **D-08:** **Fail fast, no retry.** Connection failure → exit non-zero with a distinct exit code and an actionable message (URL + cause). No auto-retry/backoff (timing variance = non-determinism; retry loops are on-call-shaped). CI-friendly: a flaky network fails loudly, never hangs.
- **D-09:** Auth via **repeatable `--header 'Key: Value'`** (mirrors curl; works for any scheme, multiple headers). Header/token values are **masked in all output** (logs, errors, report). Covers ING-02 bearer-token + custom-header.
- **D-10:** **Abort the whole ingest on any pagination page failure.** A partial surface produces a wrong score (missing tools shift the mean). Exit non-zero; never score incomplete data. Correctness + determinism over best-effort.
- **D-11:** Transport: **Streamable-HTTP primary + SSE fallback.** Try `StreamableHTTPClientTransport`; on the legacy handshake signal, fall back to `SSEClientTransport` (SDK ships both). Buys reach over the deployed SSE tail — important for a tool whose job is connecting to other people's servers. stdio deferred (its own later phase); offline snapshot mode covers anything not reachable live.

### Determinism exit-criterion artifact (Area D)
- **D-12:** The "byte-identical x3" DoD test: run the engine 3× on the saved Apideck fixture, serialize the `LintReport` with **sorted keys**, **strip the meta/`capturedAt` block**, assert the 3 strings are byte-identical. Tests the real scored artifact CI consumes — the thing that must not drift (not just the surface hash).
- **D-13:** A rule that **throws** → **fail the whole run, non-zero exit**, surfacing which rule + which tool threw. No silent swallow; a partial finding set = a wrong score. Built-in rules are ours, so this is a dev-time correctness signal.
- **D-14:** Purity enforcement (determinism point #2): rules receive an **`Object.freeze`'d `RuleContext`** and return `Finding[]` only; **unit tests run with network blocked** (any outbound socket attempt throws in CI). Mechanical, catches IO/clock violations at test time without runtime sandboxing.

### Claude's Discretion (pin during planning, no further user input needed)
- Exact depth numbers: hard safety cap (~32) and soft quality threshold (~7) — pin against real Apideck-fixture schema depths during the ING-05 spike.
- Exact distinct exit codes per failure class (connect, auth, partial-page, rule-throw, depth-exceeded).
- Canonical-JSON implementation: the deterministic key-sort serializer used for hashing and for the x3 comparison (recursive sorted-key `JSON.stringify`, explicit `localeCompare('en', {sensitivity:'variant'})` for any name sort — never default locale).
- SSE-fallback handshake-detection mechanism (which signal triggers the downgrade).
- `RuleContext` exact field shape beyond the ARCHITECTURE draft (`tool`, `surface`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & determinism (primary for this phase)
- `.planning/research/ARCHITECTURE.md` — full component layout (`ingestion/`, `engine/`, `scoring/`, `report/`), the 7 determinism enforcement points (summary table §"Determinism Enforcement Points"), and the type contracts: `ToolSnapshot`, `VokeSnapshot`, `RuleContext`, `RuleFunction`, `LintReport`. **The architecture spine for this phase.**
- `.planning/research/PITFALLS.md` — Pitfall 1 (determinism leaks: `Object.keys` order, float accumulation, locale-aware sort), Pitfall on external-`$ref`/depth (ajv `$ref` handling, `$RefParser` ban, depth-bound + DoS), `new Ajv2020()` vs `new Ajv()` gotcha, Node-version pinning.

### Spec & registry contract (consumed, not rebuilt)
- `spec/MTQS-v0.1.md` §"Fixed evaluation order" (findings sorted `toolId`→`ruleId`→`path`; server score after per-tool sort) and §7 Extensibility (`register()` boundary, `(ctx: RuleContext) => Finding[]` purity contract).
- `spec/mtqs-v0.1.yaml` — machine-readable rule registry the engine loads (id, severity, dimension, scope `per-tool`|`server`, weight).
- `packages/core/src/` — existing `@voke/core`: `scoring.ts` (integer-first `penaltyFor`/`scoreTool`/`applyCaps`/`tierFor`/`serverScore`), `registry-types.ts` (zod schemas), `loadRegistry.ts`. **Reuse — do not reimplement scoring or registry parsing.**

### Stack & MCP/JSON-Schema sources
- `prd.md` §11 — MCP 2026-07-28 RC: JSON Schema 2020-12 lift, no auto-deref of external `$ref`, bounded schema depth (the requirements behind ING-05).
- `prd.md` §15 — TypeScript stack rationale.
- `CLAUDE.md` (project) "Technology Stack" + "Determinism Risk Register" — pinned versions (`@modelcontextprotocol/sdk` ~1.29.0, `ajv` 8.20.0 via `ajv/dist/2020`, `ajv-formats` 3.0.1, `commander` 15, `vitest` 4, `tsup` 8), `StreamableHTTPClientTransport`+SSE decision, external-ref blocking, the risk-register mitigations.
- `.planning/REQUIREMENTS.md` — ENG-01..04, ING-01..05 acceptance criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@voke/core` (`packages/core/`) is published and consumed: `scoring.ts` (deterministic integer-first scoring, caps, tiers, server mean), `registry-types.ts` (zod `RuleRegistryEntry`, `Severity`, `DimensionId`, `RuleScope`), `loadRegistry.ts` (`loadRegistry`/`loadRegistryFile`). The engine loads rules via these — no new registry parser.
- `Finding` type already defined in `scoring.ts` (`{ruleId, severity, dimension}`). Phase 2 likely extends the *runtime* finding with `location.path` + message per the spec's finding-message format, but the scoring-facing `Finding` shape is set.
- `spec/mtqs-v0.1.yaml` is the live registry with `scope: per-tool | server` per rule — the engine routes per-tool vs server-aggregate (ENG-02) off this field.

### Established Patterns
- Monorepo via npm workspaces (`@voke/core` extracted, quick-task 260612-p42). New ingestion/engine code lands as workspace package(s) consuming `@voke/core`.
- Pure-function + zod-validation style already in core; rules follow `(ctx) => Finding[]`.
- vitest test layout under `tests/` mirrors source; spec tests already enforce doc↔registry sync.

### Integration Points
- Engine input = canonicalized surface from ingestion (`VokeSnapshot.tools`, sorted by `toolId`).
- Engine output (`Finding[]` per tool) → `@voke/core` scoring → `LintReport` (Phase 4 wires the CLI; Phase 2 builds the report builder + snapshot writer the determinism test exercises).
- Registry seal/plugin boundary (ENG-03): fresh sealed instance per run; `voke.yaml` severity overrides produce a NEW registry without mutating the default.

</code_context>

<specifics>
## Specific Ideas

- Determinism is the launch wedge — every Phase 2 decision favors reproducibility over best-effort resilience (no retry, abort-on-partial, fail-on-rule-throw, locale-pinned sorts, integer-first arithmetic). "A flaky run must fail loudly, never produce a different number."
- The x3 byte-identical test on the real Apideck fixture is the phase's proof artifact — wire it early as the executable definition of done.
- Two-bound depth model embodies the "will-crash-us vs too-complex-for-an-agent" distinction — a legitimately deep schema gets a quality finding, not a hard rejection, unless it actually threatens the runtime.

</specifics>

<deferred>
## Deferred Ideas

- **stdio transport** (lint local/pre-deploy MCP servers) — its own later phase; v0.1 is Streamable-HTTP + SSE only.
- **Namespace-composite `toolId`** (multi-server merge) — premature; revisit if/when cross-server surfaces exist.
- **Retry/backoff on connect** — rejected for v0.1 (non-determinism + on-call shape); could revisit as an opt-in CI knob far later.
- **Score-what-was-fetched on partial pagination** — rejected; conflicts with reproducibility.
- **Runtime sandbox / ESLint static guard for rule purity** — frozen-context + network-blocked tests suffice for v0.1's trusted rules; static guard is a cheap future add when custom/vendor rules arrive.

</deferred>

---

*Phase: 02-engine-ingestion-determinism*
*Context gathered: 2026-06-12*
