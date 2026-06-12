# Research Summary: Voke L1 (MTQS + Reference Linter)

**Synthesized:** 2026-06-12
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall confidence:** HIGH

## Executive Summary

Voke L1 is a TypeScript CLI that lints MCP servers by running a deterministic rule engine against the `tools/list` surface and producing a stable, per-rule per-tool score against an explicit published specification. The category is genuinely empty: Glama holds mindshare with a closed LLM-judge score (non-reproducible, no rules repo, cannot gate a PR), and no other tool mechanically checks annotation correctness, verb-annotation consistency, or token-efficiency signals. The correct model is ESLint/WCAG — own the open standard, ship the reference linter as proof, extend via a Spectral-shaped plugin interface.

TypeScript is confirmed: `@modelcontextprotocol/sdk` v1.29.0 provides a complete client with paginated `tools/list`; ajv v8.20.0 is the only validator implementing JSON Schema 2020-12 (the 2026-07-28 RC's required dialect); the stack is lean — commander, tsup, vitest, plus a hand-rolled ~50-line Spectral-shaped rule engine (do NOT embed `@stoplight/spectral-core`).

Build approach is spec-first, then engine, then rules. The MTQS v0.1 document (20 rules, scoring formula, A–F tier table) must exist before any rule code — it is the architecture contract and the launch differentiator. The architecture centers on one inviolable property: **determinism**. Seven explicit enforcement points identified; all must be baked in before rules are written.

Largest risk: phase-size abandonment — solo part-time work must decompose into 2–3h sessions with a runnable artifact as each session's exit criterion. Second-largest: a determinism leak — if the score differs on identical input, the value proposition vs Glama collapses. A reproducibility test (byte-identical output ×3 consecutive runs) is a hard Phase 2 exit criterion, not post-launch cleanup.

## Stack (prescriptive)

| Concern | Choice | Notes |
|---|---|---|
| MCP client | `@modelcontextprotocol/sdk` `~1.29.0` | `StreamableHTTPClientTransport`; `client.listTools({cursor})` paginated (229-tool Apideck exceeds one page); SSE fallback for pre-RC servers. Pin `~` until RC lands. |
| JSON Schema validation | `ajv` v8.20.0 via `ajv/dist/2020` (`Ajv2020`) | `{strict:true, allErrors:true}`; never wire `loadSchema` — unresolved external `$ref` should throw (it's an MTQS rule). Already a transitive SDK dep. |
| Rule engine | Hand-rolled (~50 lines) | Clone Spectral's rule *shape* (id, severity, given-target, then/fn); reject its runtime (204KB, JSONPath/YAML-oriented, can't do server-level rules). |
| CLI / build / test | commander v15 · tsup v8.5 · vitest v4.1 | No SDK dep-tree conflicts. |
| Runtime | Node 22 (Active LTS → Apr 2027) | Node 20 EOL Apr 2026, removed from runner toolcache May 2026. |

**Determinism risk vectors:** external `$ref` loading, tool sort order (network order undefined), IO in rule bodies, ANSI codes in scored output, SDK type drift. All preventable with documented conventions + canonicalization at ingest.

## Features — MTQS rule landscape

36 candidate rules across 7 dimensions; **20 are P1 (v0.1 launch)**, 16 are P2 (v0.2). **Zero require an LLM.**

**P1 / table stakes (20 rules):**
- **Schema correctness S01–S08:** inputSchema presence; `type:object` root; valid JSON Schema 2020-12; no external `$ref` (RC mandate); bounded depth; outputSchema validity; explicit `required`; no bare `{}` properties.
- **Description floor D01–D03:** presence; 20-char min; not a name-copy.
- **Naming N01–N03:** 1–128 chars; allowed characters; server-unique names (MCP spec + SEP-986 Final).
- **Parameter P01–P02:** per-property descriptions; enum for constrained values (Anthropic `user_id`).
- **Annotation presence A01–A05:** explicit booleans for all four hint fields; unannotated → most-risky posture.
- **Annotation cross-constraint A06:** `readOnlyHint:true` + `destructiveHint:true` is a spec contradiction; `destructiveHint` only meaningful when `readOnlyHint==false`.

**P2 / differentiators (16 rules):** verb-annotation consistency (A07–A09: `get_/list_/search_` not `readOnlyHint:false`; `delete_/remove_` not `readOnlyHint:true`); description proxy heuristics (D04–D06); token efficiency (O01–O04: outputSchema presence, pagination/filter params on list/search, enum on format params); namespace quality (N04–N06); surface coherence (C01–C03: 64-tool ungrouped threshold, near-dup description detection, `title` presence).

**Anti-features (L4, do NOT build in L1):** semantic clarity scoring, "would an agent select this tool?" simulation, 1–5 description quality scoring, NL comprehension, semantic dedup, cross-client compat — all need LLM judgment, break determinism.

**Engine implication:** must support two execution modes — per-tool rules and server-aggregate rules — decided before the engine is coded.

## Architecture

- **One artifact, two uses:** `LintReport` is both lint output and the L2 snapshot. `voke lint --save-snapshot` writes it; future `voke diff --base <file>` joins two reports on per-tool `contentHash`. L2 adds only a `diff/` module — no new ingestion/engine changes.
- **Stable identity:** `toolId = tool.name`; `contentHash = SHA-256` of canonical JSON of `{name, description, inputSchema, outputSchema, annotations}`. O(1) diff key + dedup key.
- **7 determinism enforcement points:** sort `tools[]` by toolId on ingest; freeze `RuleContext`; sort rules by id before run; sort `Finding[]` by toolId→ruleId→path before scoring; sort `ToolScore[]` by toolId before server mean; `PUBLISHED_WEIGHTS` const; hashes from sorted canonical JSON.
- **Registry = startup-time plugin boundary, not global singleton:** `createDefaultRegistry()` returns fresh sealed instance; custom/vendor rules `register()` before seal; `voke.yaml` severity overrides return a *new* registry via `applyOverrides()`.
- **Data flow:** ingest (SDK or saved dump) → canonicalize/sort → frozen context → run sorted rules → sorted findings → scoring (dimension→tool→server + A–F tier) → formatter (text/JSON/SARIF) → `--min-score` exit code.

## Pitfalls (each maps to a phase)

1. **Determinism leaks** (object key order, float accumulation, locale sort, Set iteration, `Date.now()`) — fix: canonicalization at ingest + integer-first scoring; reproducibility test = Phase 2 exit criterion.
2. **MCP RC `$ref` prohibition** — already crashing fastmcp/mastra in prod; never `dereference()`; ajv `Ajv2020` handles 2020-12 natively; fixture with external `$ref` asserting no outbound HTTP = Phase 2 requirement.
3. **Spec-vs-code drift** — machine-readable rule registry is single source of truth for both spec doc and code; rule-in-code-without-registry-entry fails build; `MTQS_VERSION` in `--version` from day one.
4. **Phase-size abandonment** — first `voke lint <live-server>` producing meaningful output by Phase 2–3, not Phase 7; demoable artifact reachable within first session of each phase.
5. **Scope creep (LLM-in-loop / gateway)** — rule fns typed `(tool: MCPTool) => RuleResult` (sync, pure, no IO) make drift structurally impossible; `SCOPE.md` linked from `CONTRIBUTING.md`.

## Roadmap Implications — suggested 6 phases

1. **MTQS v0.1 Specification Authoring** — 20 rules, scoring formula, A–F tiers, SCOPE.md; gates all code. (Writing task.)
2. **Engine Core + Ingestion + Determinism Infra** — RuleRegistry + pure `runRules`, McpIngestor (paginated listTools) + SnapshotReader, scoring types, committed 229-tool Apideck fixture, Node 22 pinned. Exit criterion = byte-identical output ×3. Highest technical risk; isolated before rules.
3. **Rule Implementations (20 v0.1 rules)** — pure fns vs frozen interface; positive+negative fixtures per rule; network blocked in unit tests.
4. **Scoring + Report + CLI** — full pipeline wiring; text/JSON formatters; `voke lint` with `--min-score`/`--timeout`/`--header`/`--from-file`; bearer masking; live Apideck run ×3.
5. **GitHub Action + SARIF + Spec Publication** — action wrapper, SARIF formatter, spec at voke.sh/spec, CONTRIBUTING.md + rule PR template before public.
6. **Launch — Blog + Live Apideck Demo** — `voke lint https://mcp.apideck.dev/mcp` + 1 other server; blog drafted in parallel from Phase 4; committed fixture for reproducible screenshots.

## Research Flags

**Needs a short spike before implementation:**
- Phase 2: depth-bound algorithm + `oneOf`-branch threshold for the 2020-12 composition/`$ref` constraints (real crash evidence); confirm ajv `Ajv2020` handles `unevaluatedProperties`/`unevaluatedItems`.
- Phase 5: SARIF 2.1.0 field mapping to GitHub Advanced Security objects.

**Standard — skip research:** Phase 1 (all 20 rules defined in FEATURES.md), Phase 3 (pure fns), Phase 4 (commander/tsup standard), Phase 6 (execution).

**Phase 1 spec-authoring decisions (not research gaps):** PUBLISHED_WEIGHTS per dimension; A–F tier boundaries; bounded-depth numeric value (chosen empirically vs Apideck fixture); missing-`outputSchema` severity.

---
*Research complete. Ready for requirements + roadmap.*
