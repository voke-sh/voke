---
phase: 06-launch
plan: "01"
subsystem: launch-determinism
tags: [determinism, fixtures, pub-04, launch]
dependency_graph:
  requires:
    - "05-ci-publication/05-04 (CLI --save-snapshot, serializeReportBody, buildReport)"
    - "02-engine-ingestion-determinism/02-03 (byte-identical determinism pattern)"
  provides:
    - "tests/fixtures/apideck-live-snapshot.json — live 4-tool Apideck fixture (reproducibility gate)"
    - "tests/fixtures/deepwiki-snapshot.json — live 3-tool DeepWiki fixture (second-server proof)"
    - "tests/launch/launch-determinism.test.ts — PUB-04 byte-identical x3 + shuffle-invariant gate"
  affects:
    - "06-02 (npm release) — these fixtures and scores feed the blog post D-08"
    - "06-03 (blog post) — Apideck 62/D and DeepWiki 92/A are the verbatim blog numbers"
tech_stack:
  added: []
  patterns:
    - "describe.each over two fixtures for shared test structure"
    - "committed snapshot = reproducibility gate (not live network)"
key_files:
  created:
    - tests/fixtures/apideck-live-snapshot.json
    - tests/fixtures/deepwiki-snapshot.json
    - tests/launch/launch-determinism.test.ts
  modified: []
decisions:
  - "Apideck live score 62/100 Tier D confirmed from captured fixture — matches D-08 blog number"
  - "DeepWiki live score 92/100 Tier A confirmed — strong second-server proof for PUB-04"
  - "Synthetic apideck-snapshot.json (85/B, 6 tools) left untouched — existing 628 tests all green"
  - "Protocol version 2025-11-25 negotiated by both servers (not 2025-03-26 as in RESEARCH — no assertions on protocolVersion per Pitfall 3)"
metrics:
  duration: "4 minutes"
  completed: "2026-06-14T16:55:00Z"
  tasks: 3
  files: 3
requirements: [PUB-04]
---

# Phase 6 Plan 01: Live Fixture Capture + Launch Determinism Test Summary

One-liner: Captured real 4-tool Apideck (62/D) + 3-tool DeepWiki (92/A) live snapshots and gated both with byte-identical x3 + shuffle-invariant determinism tests.

## Verbatim Scores (Blog D-08 — cite these exactly)

| Server | Score | Tier | Tools | Captured |
|--------|-------|------|-------|----------|
| Apideck (`https://mcp.apideck.dev/mcp`) | **62/100** | **D** | 4 (list_tools, describe_tool_input, execute_tool, list_scopes) | 2026-06-14T16:52:10Z |
| DeepWiki (`https://mcp.deepwiki.com/mcp`) | **92/100** | **A** | 3 (read_wiki_structure, read_wiki_contents, ask_question) | 2026-06-14T16:53:23Z |

Per-tool scores (Apideck):
- list_tools: 51/F (6 findings)
- execute_tool: 57/F (5 findings)
- describe_tool_input: 69/D (3 findings)
- list_scopes: 69/D (3 findings)

Per-tool scores (DeepWiki):
- ask_question: 88/B (3 findings — read_wiki_structure and read_wiki_contents scored too high for the below-A table)

## What Was Done

### Task 0: Pre-capture smoke test + build
- Built CLI: `npm --workspace @voke-sh/voke run build` — BUILD_OK
- Smoke-tested Apideck: 4 tools confirmed (list_tools, describe_tool_input, execute_tool, list_scopes)
- Smoke-tested DeepWiki: 3 tools confirmed (read_wiki_structure, read_wiki_contents, ask_question)
- No file writes in Task 0

### Task 1: Capture live snapshot fixtures
- Captured Apideck via `node packages/linter/dist/cli/index.js lint https://mcp.apideck.dev/mcp --save-snapshot tests/fixtures/apideck-live-snapshot.json --ci`
- Captured DeepWiki via same pattern with `--save-snapshot tests/fixtures/deepwiki-snapshot.json`
- Recorded real scores: Apideck 62/100 D, DeepWiki 92/100 A
- Commit: `969fd8a` — feat(06-01): capture live Apideck + DeepWiki snapshot fixtures

### Task 2: Write launch determinism test
- Created `tests/launch/launch-determinism.test.ts` (88 lines)
- Tests: byte-identical x3, shuffle-invariance, meta-exclusion (generatedAt, capturedAt) for both fixtures
- Plus: DeepWiki serverScore in 0-100 + valid tier proof (PUB-04 criterion 2)
- Full suite: 36 files / 628 tests (was 35/617) — +1 file, +11 tests, all green
- Commit: `71025ef` — test(06-01): add launch determinism test gating both live fixtures

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `969fd8a` | feat(06-01): capture live Apideck + DeepWiki snapshot fixtures |
| Task 2 | `71025ef` | test(06-01): add launch determinism test gating both live fixtures |

## Deviations from Plan

None — plan executed exactly as written.

Protocol version discovered to be `2025-11-25` rather than `2025-03-26` as noted in RESEARCH.md (both servers upgraded protocol). No assertions on protocolVersion in the test (Pitfall 3 guard), so this has zero impact.

## Known Stubs

None. All fixtures contain real captured data from live servers.

## Self-Check: PASSED

Files created:
- tests/fixtures/apideck-live-snapshot.json — FOUND
- tests/fixtures/deepwiki-snapshot.json — FOUND
- tests/launch/launch-determinism.test.ts — FOUND

Commits:
- 969fd8a — FOUND
- 71025ef — FOUND

Tests: 36 files / 628 tests passing.
Synthetic fixture: git diff shows no change to tests/fixtures/apideck-snapshot.json.
