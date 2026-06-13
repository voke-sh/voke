# Requirements: Voke L1 (MTQS + Reference Linter)

**Defined:** 2026-06-12
**Core Value:** `voke lint <server>` produces deterministic per-rule findings + a stable score against an explicit published ruleset — same input always yields same output.

## v1 Requirements

L1 milestone. Each maps to a roadmap phase. v1 ships the 20 P1 (table-stakes) MTQS rules; the 16 P2 differentiator rules are v2.

### Specification

- [x] **SPEC-01**: MTQS v0.1 is authored as a versioned document — per-dimension rubrics (definition + mechanical checks + fix hint), every rule justified from a primary source (Anthropic / MCP spec / JSON Schema / academic), explicitly not Glama-derived
- [x] **SPEC-02**: Spec defines the scoring formula with published per-dimension weights and A–F tier boundaries
- [x] **SPEC-03**: Spec defines stable rule IDs + severities (error / warning / info / hint) for all 20 v0.1 rules
- [x] **SPEC-04**: A machine-readable rule registry (one entry per rule) is the single source of truth shared by spec and linter; a build check fails on any rule-in-code without a registry entry
- [x] **SPEC-05**: SCOPE.md documents the L1 boundary (no LLM-in-loop; no gateway/proxy) to prevent scope creep

### Engine

- [x] **ENG-01**: A Spectral-shaped rule engine runs rules typed as pure synchronous functions `(context) => Finding[]` (no IO, no model)
- [x] **ENG-02**: Engine supports both per-tool rules and server-aggregate (surface-level) rules
- [x] **ENG-03**: Rule registry is a startup-time plugin boundary (fresh sealed instance; custom/vendor rules register before seal); `voke.yaml` severity overrides produce a new registry without mutating the default
- [x] **ENG-04**: Output is byte-identical across 3 consecutive runs on identical input (determinism enforced at all 7 identified points)

### Ingestion

- [x] **ING-01**: Connect to a live streamable-HTTP MCP server via the MCP SDK and pull the full `tools/list` surface with pagination
- [x] **ING-02**: Auth via static bearer token / custom header
- [x] **ING-03**: Read a saved tool dump (snapshot) offline instead of connecting
- [x] **ING-04**: Ingested surface is canonicalized — tools sorted by stable `toolId`, per-tool `contentHash` (SHA-256 of canonical JSON) computed — leaving the data model L2-diff-ready
- [x] **ING-05**: External `$ref` is never auto-dereferenced (no outbound HTTP); schema depth is bounded; full JSON Schema 2020-12 (`oneOf`/`anyOf`/`allOf`/conditionals) is accepted
- [x] **ING-06**: Ingest from a stdio MCP server launched as a subprocess (`voke lint -- <cmd>`) — enables hermetic CI and the local dev loop for stdio-only servers; same canonicalized surface as live/offline modes; subprocess torn down deterministically

### Rules

- [x] **RULE-01**: Schema-correctness rules (S01–S08) implemented with positive + negative fixtures
- [x] **RULE-02**: Description-floor rules (D01–D03) implemented with fixtures
- [x] **RULE-03**: Naming rules (N01–N03) implemented with fixtures
- [x] **RULE-04**: Parameter-semantics rules (P01–P02) implemented with fixtures
- [x] **RULE-05**: Annotation rules (A01–A06, incl. cross-constraint) implemented with fixtures
- [x] **RULE-06**: Every rule emits a finding with rule ID, severity, location, and fix hint; network is blocked in rule unit tests

### Scoring & Output

- [x] **SCORE-01**: Findings aggregate deterministically into per-dimension → per-tool → server scores + A–F tier using published weights
- [x] **SCORE-02**: Linter declares which MTQS version it implements (`MTQS_VERSION` in `--version`)
- [x] **OUT-01**: Human-readable formatter prints per-rule findings + per-tool + server score + tier
- [x] **OUT-02**: JSON formatter emits the full `LintReport` (also usable as a saved snapshot)

### CLI & CI

- [x] **CLI-01**: `voke lint <server-url-or-file>` runs the full ruleset and prints findings + scores
- [x] **CLI-02**: `--min-score <threshold>` sets the exit code so a build fails below threshold
- [x] **CLI-03**: CLI supports `--header`, `--timeout`, and reading from a saved dump; bearer tokens are masked in output
- [x] **CI-01**: A GitHub Action wrapper + YAML config runs `voke lint` in CI and fails the build below threshold
- [x] **CI-02**: README doubles as the demo (copy-paste runnable)

### Publication & Launch

- [x] **PUB-01**: MTQS spec is published and versioned at voke.sh/spec in a public repo accepting PRs
- [x] **PUB-02**: CONTRIBUTING.md + a rule PR template exist before the repo goes public
- [ ] **PUB-03**: Launch blog post tells the "no open standard for MCP tool quality — here is one" story
- [ ] **PUB-04**: `voke lint https://mcp.apideck.dev/mcp` runs green and reproducibly against the 229-tool Apideck server + ≥1 other public server (the launch DoD)

## v2 Requirements

Deferred to post-launch. Tracked, not in current roadmap.

### Differentiator Rules

- **RULE-P2-01**: Verb-annotation consistency rules (A07–A09)
- **RULE-P2-02**: Description proxy heuristics (D04–D06)
- **RULE-P2-03**: Token-efficiency rules (O01–O04)
- **RULE-P2-04**: Namespace-quality rules (N04–N06)
- **RULE-P2-05**: Surface-coherence rules (C01–C03)

### Output

- **OUT-P2-01**: SARIF 2.1.0 formatter for GitHub Advanced Security PR annotations

## Out of Scope

Explicitly excluded (with reasoning) to prevent scope creep.

| Feature | Reason |
|---------|--------|
| L2 diff / breaking-change gate | Next layer; L1 data model leaves room (contentHash, snapshots) but it is not built now |
| L3 runtime health / scheduler / alert envelope | Preserved in PRD §8; creates on-call obligation; not this milestone |
| L4 eval (model-in-the-loop) | The moat; the one place a model belongs — kept out of L1 so the signal stays deterministic |
| L5 analytics / L6 governance | Stubs |
| Any LLM-as-judge in L1 | Non-determinism in a CI signal is a trust failure; it is the wedge vs Glama |
| Copying Glama's scoring | Hard owner rule; MTQS synthesized from primary sources only |
| Hosted infra / paging / on-call | Conflicts with solo part-time constraint |
| MCP gateway / proxy / unified-API / connector | Hard employer-conflict line; Voke is a user/observer only |
| Embedding `@stoplight/spectral-core` | 204KB + JSONPath/YAML-oriented runtime can't do server-level rules; clone the shape, not the engine |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SPEC-01 | Phase 1 | Complete |
| SPEC-02 | Phase 1 | Complete |
| SPEC-03 | Phase 1 | Complete |
| SPEC-04 | Phase 1 | Complete |
| SPEC-05 | Phase 1 | Complete |
| ENG-01 | Phase 2 | Complete |
| ENG-02 | Phase 2 | Complete |
| ENG-03 | Phase 2 | Complete |
| ENG-04 | Phase 2 | Complete |
| ING-01 | Phase 2 | Complete |
| ING-02 | Phase 2 | Complete |
| ING-03 | Phase 2 | Complete |
| ING-04 | Phase 2 | Complete |
| ING-05 | Phase 2 | Complete |
| ING-06 | Phase 5 | Complete |
| RULE-01 | Phase 3 | Complete |
| RULE-02 | Phase 3 | Complete |
| RULE-03 | Phase 3 | Complete |
| RULE-04 | Phase 3 | Complete |
| RULE-05 | Phase 3 | Complete |
| RULE-06 | Phase 3 | Complete |
| SCORE-01 | Phase 4 | Complete |
| SCORE-02 | Phase 4 | Complete |
| OUT-01 | Phase 4 | Complete |
| OUT-02 | Phase 4 | Complete |
| CLI-01 | Phase 4 | Complete |
| CLI-02 | Phase 4 | Complete |
| CLI-03 | Phase 4 | Complete |
| CI-01 | Phase 5 | Complete |
| CI-02 | Phase 5 | Complete |
| PUB-01 | Phase 5 | Complete |
| PUB-02 | Phase 5 | Complete |
| PUB-03 | Phase 6 | Pending |
| PUB-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 34 total (ING-06 stdio transport added to Phase 5)
- Mapped to phases: 34/34 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-12*
*Last updated: 2026-06-12 after roadmap creation*
