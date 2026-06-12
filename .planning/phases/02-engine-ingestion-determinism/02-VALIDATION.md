---
phase: 2
slug: engine-ingestion-determinism
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 |
| **Config file** | `/Users/samir.amzani/Projects/voke/vitest.config.ts` (globs tests/**/*.test.ts) |
| **Quick run command** | `npm test -- tests/canonicalize/ tests/ingestion/ tests/engine/ tests/report/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5-15 seconds (no network; SDK mocked) |

---

## Sampling Rate

- **After every task commit:** Run the task's own `<automated>` command (scoped vitest run)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | ING-04 (scaffold) | smoke | `npm ls --workspace=@voke/linter @modelcontextprotocol/sdk ajv ajv-formats` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | ING-04 | unit | `npm test -- tests/canonicalize/` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 0 | ING-04 (fixture) | data | `node tests/fixtures/validate-snapshot.mjs` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | ING-05 | unit | `npm test -- tests/ingestion/schema-checks.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | ING-01, ING-02 | unit (mocked SDK) | `npm test -- tests/ingestion/mcp-client.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | ING-03, ING-05 | unit + fixture | `npm test -- tests/ingestion/snapshot-reader.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | ENG-01, ENG-02 | typecheck | `npm run typecheck` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 1 | ENG-03 | unit | `npm test -- tests/engine/registry.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 1 | ENG-01, ENG-02 (D-13, D-14) | unit | `npm test -- tests/engine/runner.test.ts tests/engine/frozen-ctx.test.ts tests/engine/network-block.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | ENG-04 | unit | `npm test -- tests/report/builder.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 2 | ENG-04 (D-12) | determinism | `npm test -- tests/engine/determinism.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Every task creates its own test in the same task (TDD RED-first), so all "File Exists" entries are W0 — the plan tasks generate the test scaffolds. No task depends on a pre-existing test file that does not get created within the phase.*

---

## Wave 0 Requirements

Wave 0 (Plan 02-01) establishes the package + canonicalize foundation and the committed fixture every later wave consumes. Plans 02/03 (Wave 1) and 04 (Wave 2) each create their own test files RED-first within their tasks.

- [ ] `packages/linter` workspace package created + pinned stack installed (Plan 01, Task 1) — unblocks all later tasks (no test framework install needed; vitest already at root)
- [ ] `tests/canonicalize/canonical-json.test.ts` + `tests/canonicalize/hash.test.ts` (Plan 01, Task 2) — ING-04
- [ ] `tests/fixtures/apideck-snapshot.json` + `tests/fixtures/validate-snapshot.mjs` (Plan 01, Task 3) — committed input for ENG-04 determinism test
- [ ] `tests/ingestion/schema-checks.test.ts` (Plan 02, Task 1) — ING-05
- [ ] `tests/ingestion/mcp-client.test.ts` (Plan 02, Task 2) — ING-01, ING-02 (SDK mocked)
- [ ] `tests/ingestion/snapshot-reader.test.ts` + `tests/fixtures/external-ref-tool.json` + `tests/fixtures/deep-schema-tool.json` (Plan 02, Task 3) — ING-03, ING-05
- [ ] `tests/engine/registry.test.ts` (Plan 03, Task 2) — ENG-03
- [ ] `tests/engine/runner.test.ts` + `tests/engine/frozen-ctx.test.ts` + `tests/engine/network-block.test.ts` (Plan 03, Task 3) — ENG-01, ENG-02, D-13, D-14
- [ ] `tests/report/builder.test.ts` (Plan 04, Task 1) — ENG-04 scaffolding
- [ ] `tests/engine/determinism.test.ts` (Plan 04, Task 2) — ENG-04, D-12 (the phase DoD artifact)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live connect to the real Apideck Streamable-HTTP server + SSE fallback against a real legacy server | ING-01, ING-02, D-11 | Requires a live network endpoint + a real legacy SSE server; Phase 2 proves the logic with a mocked SDK. Live validation is deferred to Phase 4 (`voke lint` against `https://mcp.apideck.dev/mcp`). | Phase 4: run `voke lint https://mcp.apideck.dev/mcp --header 'Authorization: Bearer <tok>'`; confirm tools fetched, token masked in output. |

*All Phase 2 unit behaviors have automated verification; only the genuine live-network path is deferred (mocked here, live-tested in Phase 4).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one)
- [x] Wave 0 covers all MISSING references (each test file is created within its own task, RED-first)
- [x] No watch-mode flags (all commands use `vitest run` via `npm test`)
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-12
