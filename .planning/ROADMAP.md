# Roadmap: Voke L1 (MTQS + Reference Linter)

## Overview

Six phases deliver the MTQS v0.1 open specification and its `voke lint` reference linter. The journey is spec-first: Phase 1 writes the spec document that gates all code. Phase 2 builds the deterministic engine and ingestion layer â the highest-risk technical phase, isolated before any rules touch it. Phase 3 implements all 22 v0.1 rules as pure functions. Phase 4 wires the full pipeline into a working CLI (`voke lint` against a live server). Phase 5 ships the GitHub Action, publishes the spec, and prepares the repo for public contribution. Phase 6 executes the launch: live Apideck run, second server, blog post.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: MTQS Specification** - Author the v0.1 spec document, scoring formula, rule registry, and SCOPE.md â gates all linter code (completed 2026-06-12)
- [x] **Phase 2: Engine + Ingestion + Determinism** - Build rule engine, MCP ingestion, and bake in all 7 determinism enforcement points; exit criterion is byte-identical output x3 (completed 2026-06-12)
- [ ] **Phase 3: Rule Implementations** - Implement all 20 v0.1 rules (S01âS08, D01âD03, N01âN03, P01âP02, A01âA06) as pure functions with fixtures
- [x] **Phase 4: Scoring + Output + CLI** - Wire the full pipeline; first demoable `voke lint` against the live Apideck MCP server (completed 2026-06-13 — server is a 4-tool proxy surface; scored 62/100 Tier D, reproducible)
- [x] **Phase 5: CI + Publication** - stdio transport (hermetic CI + local dev loop), GitHub Action wrapper, spec published at voke.sh/spec, CONTRIBUTING.md + rule PR template, repo goes public (completed 2026-06-13)
- [ ] **Phase 6: Launch** - Blog post + live Apideck demo run; `voke lint https://mcp.apideck.dev/mcp` green and reproducible is the DoD

## Phase Details

### Phase 1: MTQS Specification
**Goal**: The MTQS v0.1 spec exists as a versioned, defensible document â per-dimension rubrics, scoring formula, rule IDs + severities, and machine-readable registry â ready to be the architecture contract for all implementation phases
**Depends on**: Nothing (first phase)
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05
**Success Criteria** (what must be TRUE):
  1. A human can read the spec document and understand the justification for each of the 20 v0.1 rules with its primary source citation
  2. The scoring formula (per-dimension weights + AâF tier boundaries) is written down and a worked example shows how a tool score is computed
  3. A machine-readable rule registry file exists with one entry per rule (id, severity, dimension); a build check is defined that would fail if a rule ID is used in code without a registry entry
  4. SCOPE.md exists and explicitly states the L1 boundary: no LLM-in-loop, no gateway/proxy, no L2+ features
  5. The spec document does not reproduce or derive from Glama's scoring â every rubric traces to Anthropic / MCP spec / JSON Schema / academic sources
**Plans**: TBD

### Phase 2: Engine + Ingestion + Determinism
**Goal**: A working, determinism-guaranteed runtime exists â the engine can run rules against a canonicalized tool surface from either a live MCP server or a saved snapshot, and the output is byte-identical across repeated runs on identical input
**Depends on**: Phase 1
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ING-01, ING-02, ING-03, ING-04, ING-05
**Success Criteria** (what must be TRUE):
  1. Running the engine 3 consecutive times on the saved Apideck fixture produces byte-identical JSON output each time (the determinism test passes)
  2. The MCP client connects to a live streamable-HTTP server and retrieves the paginated `tools/list` surface; a static bearer token / custom header can be passed for auth
  3. A saved tool dump (snapshot file) can be read offline without any network call; the engine reaches the same state as a live connection on identical data
  4. Ingested tools are sorted by stable `toolId`, each with a SHA-256 `contentHash`; the data model is structurally ready for L2 diff (no changes needed to ingestion for diffing)
  5. External `$ref` in a tool schema never triggers an outbound HTTP call and a test fixture with an external `$ref` asserts this; schema depth is bounded and full JSON Schema 2020-12 composition is accepted
**Plans**: 4 plans
- [x] 02-01-PLAN.md â Scaffold @voke/linter package + canonicalize module (canonical JSON + SHA-256) + Apideck fixture (Wave 0; ING-04)
- [x] 02-02-PLAN.md â Ingestion layer: data-model types, Ajv2020/depth/external-$ref checks, live MCP client + offline snapshot reader (Wave 1; ING-01/02/03/05)
- [x] 02-03-PLAN.md â Rule engine: types, sealable registry with overrides, pure frozen-context runner + network-block test infra (Wave 1; ENG-01/02/03)
- [x] 02-04-PLAN.md â Report builder (reusing @voke/core scoring) + byte-identical x3 determinism test (Wave 2; ENG-04)

### Phase 3: Rule Implementations
**Goal**: All 22 v0.1 MTQS rules are implemented as pure synchronous functions â each with positive and negative fixtures, each emitting findings with rule ID, severity, location, and fix hint, and with network blocked in all unit tests
**Depends on**: Phase 2
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04, RULE-05, RULE-06
**Success Criteria** (what must be TRUE):
  1. Schema-correctness rules (S01âS08) have passing positive and negative fixtures covering each mechanical check (inputSchema presence, type:object root, valid 2020-12, no external $ref, bounded depth, outputSchema, explicit required, no bare {})
  2. Description-floor (D01âD03), naming (N01âN03), and parameter-semantics (P01âP02) rules have fixtures that each fire on a known-bad tool and pass on a known-good tool
  3. Annotation rules (A01âA06 including the A06 cross-constraint) have fixtures; A06 specifically fires when `readOnlyHint:true` + `destructiveHint:true` are both set
  4. Every rule emits a finding that includes rule ID, severity, the path to the offending location, and a human-readable fix hint
  5. All rule unit tests run with network blocked â no rule implementation makes any IO call
**Plans**: 5 plans
- [x] 03-01-PLAN.md â Schema Correctness rules S01-S08 (Wave 1; RULE-01)
- [x] 03-02-PLAN.md â Description D01-D03 + Naming N01-N03 (N03 server-scoped) (Wave 1; RULE-02, RULE-03)
- [x] 03-03-PLAN.md â Parameter Semantics rules P01-P02 (Wave 1; RULE-04)
- [x] 03-04-PLAN.md â Annotation Transparency rules A01-A06 (incl. A06 cross-constraint) (Wave 1; RULE-05)
- [x] 03-05-PLAN.md â Integration: register all 22 rules in createDefaultRegistry + coverage/determinism proof (Wave 2; RULE-06)

### Phase 4: Scoring + Output + CLI
**Goal**: `voke lint <server-or-file>` works end-to-end and produces a human-readable + machine-readable report with per-rule findings, per-tool scores, and a server-level score + AâF tier; the first live run against the Apideck MCP server produces a meaningful, reproducible score (note: the live server is a proxy exposing 4 meta-tools, not 229 individual tools — voke lints the MCP surface, not the underlying Unify API op-count)
**Depends on**: Phase 3
**Requirements**: SCORE-01, SCORE-02, OUT-01, OUT-02, CLI-01, CLI-02, CLI-03
**Success Criteria** (what must be TRUE):
  1. `voke lint https://mcp.apideck.dev/mcp` runs against the live server, prints per-rule findings, per-tool scores, a server score, and an AâF tier
  2. Running the same command 3 consecutive times produces byte-identical output (determinism holds end-to-end through the full pipeline)
  3. `voke lint --output json <file>` emits a `LintReport` JSON document usable as a saved snapshot
  4. `voke lint --min-score 80 <server>` exits with a non-zero code when the server scores below 80 and exits 0 when it scores at or above 80
  5. `voke --version` prints the tool version and the MTQS version the linter implements; bearer tokens in `--header` arguments are masked in all output
**Plans**: 3 plans
- [x] 04-01-PLAN.md — Leaf modules: version source-of-truth + extensible target resolver + human/JSON formatters (Wave 1; SCORE-01/02, OUT-01/02)
- [x] 04-02-PLAN.md — CLI wiring: runLint orchestrator + commander program + bin entrypoint + tsup build + exit-code map + masking (Wave 2; CLI-01/02/03)
- [x] 04-03-PLAN.md — End-to-end determinism x3 + acceptance tests + live Apideck checkpoint (Wave 3; all 7 req IDs)

### Phase 5: CI + Publication
**Goal**: The linter ingests stdio MCP servers (hermetic CI + local dev loop), is usable from a GitHub Action with a one-line YAML config, the MTQS spec is publicly versioned at voke.sh/spec, and the repo is ready for external contribution before going public
**Depends on**: Phase 4
**Requirements**: ING-06, CI-01, CI-02, PUB-01, PUB-02
**Note**: Published npm name is `@voke-sh/voke` (unscoped `voke` is taken on npm v1.0.2). GitHub Action reference stays `uses: voke-sh/voke@v0`.
**Success Criteria** (what must be TRUE):
  1. `voke lint -- <cmd>` launches a stdio MCP server as a subprocess, retrieves the same canonicalized tool surface as live/offline modes, and tears the subprocess down deterministically (no orphan process, byte-identical output x3)
  2. A GitHub Action workflow using `uses: voke-sh/voke@v0` with a `min-score` input runs `voke lint` in CI and fails the build when the score falls below threshold
  3. Copy-pasting the README's quickstart snippet into a new repo's workflow file produces a working CI lint job without modification
  4. MTQS v0.1 spec is live at voke.sh/spec (or its public repo equivalent), versioned, and accepts pull requests
  5. CONTRIBUTING.md and a rule PR template exist in the repo; both are linked from the README; SCOPE.md is linked from CONTRIBUTING.md
**Plans**: 4 plans
- [x] 05-01-PLAN.md — stdio ingestion: StdioClientTransport + dash-dash/--env + exit codes 8/9 + byte-identical x3 (Wave 1; ING-06)
- [x] 05-02-PLAN.md — npm publish prep (@voke-sh/voke) + composite action.yml + publish/ci workflows (Wave 1; CI-01)
- [x] 05-03-PLAN.md — VitePress spec site at voke.sh/spec + GitHub Pages deploy workflow (Wave 1; PUB-01)
- [x] 05-04-PLAN.md — Apache-2.0 LICENSE + Action-first README + CONTRIBUTING + rule PR template (Wave 2; CI-02, PUB-02)

### Phase 6: Launch
**Goal**: `voke lint https://mcp.apideck.dev/mcp` runs green and reproducibly against the Apideck MCP server (4-tool proxy surface) and at least one other public MCP server; the launch blog post is live
**Depends on**: Phase 5
**Requirements**: PUB-03, PUB-04
**Success Criteria** (what must be TRUE):
  1. `voke lint https://mcp.apideck.dev/mcp` completes without error, produces a score + tier, and the output is byte-identical across 3 runs (committed fixture matches)
  2. `voke lint` runs successfully against at least one other public MCP server and produces a valid score
  3. The launch blog post is published and tells the "no open standard for MCP tool quality â here is one" story with the live Apideck run as the proof artifact
**Plans**: TBD

## Progress

**Execution Order:** 1 â 2 â 3 â 4 â 5 â 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. MTQS Specification | 4/4 | Complete   | 2026-06-12 |
| 2. Engine + Ingestion + Determinism | 4/4 | Complete   | 2026-06-12 |
| 3. Rule Implementations | 4/5 | In Progress|  |
| 4. Scoring + Output + CLI | 3/3 | Complete   | 2026-06-13 |
| 5. CI + Publication | 4/4 | Complete   | 2026-06-13 |
| 6. Launch | 0/TBD | Not started | - |
