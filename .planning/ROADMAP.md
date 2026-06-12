# Roadmap: Voke L1 (MTQS + Reference Linter)

## Overview

Six phases deliver the MTQS v0.1 open specification and its `voke lint` reference linter. The journey is spec-first: Phase 1 writes the spec document that gates all code. Phase 2 builds the deterministic engine and ingestion layer — the highest-risk technical phase, isolated before any rules touch it. Phase 3 implements all 20 v0.1 rules as pure functions. Phase 4 wires the full pipeline into a working CLI (`voke lint` against a live server). Phase 5 ships the GitHub Action, publishes the spec, and prepares the repo for public contribution. Phase 6 executes the launch: live Apideck run, second server, blog post.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: MTQS Specification** - Author the v0.1 spec document, scoring formula, rule registry, and SCOPE.md — gates all linter code
- [ ] **Phase 2: Engine + Ingestion + Determinism** - Build rule engine, MCP ingestion, and bake in all 7 determinism enforcement points; exit criterion is byte-identical output x3
- [ ] **Phase 3: Rule Implementations** - Implement all 20 v0.1 rules (S01–S08, D01–D03, N01–N03, P01–P02, A01–A06) as pure functions with fixtures
- [ ] **Phase 4: Scoring + Output + CLI** - Wire the full pipeline; first demoable `voke lint` against the live 229-tool Apideck server
- [ ] **Phase 5: CI + Publication** - GitHub Action wrapper, spec published at voke.sh/spec, CONTRIBUTING.md + rule PR template, repo goes public
- [ ] **Phase 6: Launch** - Blog post + live Apideck demo run; `voke lint https://mcp.apideck.dev/mcp` green and reproducible is the DoD

## Phase Details

### Phase 1: MTQS Specification
**Goal**: The MTQS v0.1 spec exists as a versioned, defensible document — per-dimension rubrics, scoring formula, rule IDs + severities, and machine-readable registry — ready to be the architecture contract for all implementation phases
**Depends on**: Nothing (first phase)
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05
**Success Criteria** (what must be TRUE):
  1. A human can read the spec document and understand the justification for each of the 20 v0.1 rules with its primary source citation
  2. The scoring formula (per-dimension weights + A–F tier boundaries) is written down and a worked example shows how a tool score is computed
  3. A machine-readable rule registry file exists with one entry per rule (id, severity, dimension); a build check is defined that would fail if a rule ID is used in code without a registry entry
  4. SCOPE.md exists and explicitly states the L1 boundary: no LLM-in-loop, no gateway/proxy, no L2+ features
  5. The spec document does not reproduce or derive from Glama's scoring — every rubric traces to Anthropic / MCP spec / JSON Schema / academic sources
**Plans**: TBD

### Phase 2: Engine + Ingestion + Determinism
**Goal**: A working, determinism-guaranteed runtime exists — the engine can run rules against a canonicalized tool surface from either a live MCP server or a saved snapshot, and the output is byte-identical across repeated runs on identical input
**Depends on**: Phase 1
**Requirements**: ENG-01, ENG-02, ENG-03, ENG-04, ING-01, ING-02, ING-03, ING-04, ING-05
**Success Criteria** (what must be TRUE):
  1. Running the engine 3 consecutive times on the saved Apideck fixture produces byte-identical JSON output each time (the determinism test passes)
  2. The MCP client connects to a live streamable-HTTP server and retrieves the paginated `tools/list` surface; a static bearer token / custom header can be passed for auth
  3. A saved tool dump (snapshot file) can be read offline without any network call; the engine reaches the same state as a live connection on identical data
  4. Ingested tools are sorted by stable `toolId`, each with a SHA-256 `contentHash`; the data model is structurally ready for L2 diff (no changes needed to ingestion for diffing)
  5. External `$ref` in a tool schema never triggers an outbound HTTP call and a test fixture with an external `$ref` asserts this; schema depth is bounded and full JSON Schema 2020-12 composition is accepted
**Plans**: TBD

### Phase 3: Rule Implementations
**Goal**: All 20 v0.1 MTQS rules are implemented as pure synchronous functions — each with positive and negative fixtures, each emitting findings with rule ID, severity, location, and fix hint, and with network blocked in all unit tests
**Depends on**: Phase 2
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04, RULE-05, RULE-06
**Success Criteria** (what must be TRUE):
  1. Schema-correctness rules (S01–S08) have passing positive and negative fixtures covering each mechanical check (inputSchema presence, type:object root, valid 2020-12, no external $ref, bounded depth, outputSchema, explicit required, no bare {})
  2. Description-floor (D01–D03), naming (N01–N03), and parameter-semantics (P01–P02) rules have fixtures that each fire on a known-bad tool and pass on a known-good tool
  3. Annotation rules (A01–A06 including the A06 cross-constraint) have fixtures; A06 specifically fires when `readOnlyHint:true` + `destructiveHint:true` are both set
  4. Every rule emits a finding that includes rule ID, severity, the path to the offending location, and a human-readable fix hint
  5. All rule unit tests run with network blocked — no rule implementation makes any IO call
**Plans**: TBD

### Phase 4: Scoring + Output + CLI
**Goal**: `voke lint <server-or-file>` works end-to-end and produces a human-readable + machine-readable report with per-rule findings, per-tool scores, and a server-level score + A–F tier; the first live run against the 229-tool Apideck server produces a meaningful, reproducible score
**Depends on**: Phase 3
**Requirements**: SCORE-01, SCORE-02, OUT-01, OUT-02, CLI-01, CLI-02, CLI-03
**Success Criteria** (what must be TRUE):
  1. `voke lint https://mcp.apideck.dev/mcp` runs against the live server, prints per-rule findings, per-tool scores, a server score, and an A–F tier
  2. Running the same command 3 consecutive times produces byte-identical output (determinism holds end-to-end through the full pipeline)
  3. `voke lint --output json <file>` emits a `LintReport` JSON document usable as a saved snapshot
  4. `voke lint --min-score 80 <server>` exits with a non-zero code when the server scores below 80 and exits 0 when it scores at or above 80
  5. `voke --version` prints the tool version and the MTQS version the linter implements; bearer tokens in `--header` arguments are masked in all output
**Plans**: TBD

### Phase 5: CI + Publication
**Goal**: The linter is usable from a GitHub Action with a one-line YAML config, the MTQS spec is publicly versioned at voke.sh/spec, and the repo is ready for external contribution before going public
**Depends on**: Phase 4
**Requirements**: CI-01, CI-02, PUB-01, PUB-02
**Success Criteria** (what must be TRUE):
  1. A GitHub Action workflow using `uses: voke-sh/voke` with a `min-score` input runs `voke lint` in CI and fails the build when the score falls below threshold
  2. Copy-pasting the README's quickstart snippet into a new repo's workflow file produces a working CI lint job without modification
  3. MTQS v0.1 spec is live at voke.sh/spec (or its public repo equivalent), versioned, and accepts pull requests
  4. CONTRIBUTING.md and a rule PR template exist in the repo; both are linked from the README; SCOPE.md is linked from CONTRIBUTING.md
**Plans**: TBD

### Phase 6: Launch
**Goal**: `voke lint https://mcp.apideck.dev/mcp` runs green and reproducibly against the 229-tool Apideck server and at least one other public MCP server; the launch blog post is live
**Depends on**: Phase 5
**Requirements**: PUB-03, PUB-04
**Success Criteria** (what must be TRUE):
  1. `voke lint https://mcp.apideck.dev/mcp` completes without error, produces a score + tier, and the output is byte-identical across 3 runs (committed fixture matches)
  2. `voke lint` runs successfully against at least one other public MCP server and produces a valid score
  3. The launch blog post is published and tells the "no open standard for MCP tool quality — here is one" story with the live Apideck run as the proof artifact
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. MTQS Specification | 3/4 | In Progress|  |
| 2. Engine + Ingestion + Determinism | 0/TBD | Not started | - |
| 3. Rule Implementations | 0/TBD | Not started | - |
| 4. Scoring + Output + CLI | 0/TBD | Not started | - |
| 5. CI + Publication | 0/TBD | Not started | - |
| 6. Launch | 0/TBD | Not started | - |
