---
phase: 04-scoring-output-cli
plan: "03"
subsystem: e2e-tests
tags: [e2e, determinism, acceptance, cli, sc2, sc1, sc3, sc4, sc5, masking]
dependency_graph:
  requires:
    - packages/linter/dist/cli/index.js (built binary from 04-02)
    - tests/fixtures/apideck-snapshot.json (offline hermetic fixture)
  provides:
    - tests/cli/e2e-determinism.test.ts (SC#2 byte-identical x3 CLI proof)
    - tests/cli/e2e-acceptance.test.ts (SC#1/#3/#4/#5 acceptance assertions)
  affects:
    - Full Phase 4 success criteria: all SC#1-SC#5 now covered by automated tests
tech_stack:
  added: []
  patterns:
    - execFileSync child_process spawning for CLI e2e tests (NO_COLOR env enforced)
    - runCapture helper for non-zero exit assertions (err.status + err.stdout/err.stderr)
    - Meta-stripping pattern for JSON determinism (parse + delete .meta, then deepEqual)
    - beforeAll guard: fail fast with actionable message if dist/cli/index.js absent
key_files:
  created:
    - tests/cli/e2e-determinism.test.ts
    - tests/cli/e2e-acceptance.test.ts
  modified: []
decisions:
  - "Guard built binary with beforeAll existsSync check to give clear error if Plan 02 build not run"
  - "JSON determinism uses deepEqual on meta-stripped parsed objects (not string compare) — string compare would fail on generatedAt by design (D-10)"
  - "SC#4 gate threshold computed dynamically from live JSON run — keeps test robust against future fixture changes"
  - "Masking PRIMARY test uses schemeless host (localhost:3000/mcp) to trigger D-06 UsageError (exit 3) before network — exercises real header-in-scope code path; file target (SECONDARY) is weaker but kept as regression guard"
metrics:
  duration: "~3 minutes"
  completed: "2026-06-13"
  tasks_completed: 2
  files_changed: 2
---

# Phase 04 Plan 03: E2E Tests Summary

**One-liner:** E2E test suite for SC#1-SC#5 — byte-identical x3 CLI determinism proof + acceptance assertions for report shape, JSON LintReport, min-score gate, version string, and token masking, all against the offline Apideck fixture.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | End-to-end byte-identical x3 determinism test (SC#2) | e1affbb | tests/cli/e2e-determinism.test.ts |
| 2 | Acceptance test for SC#1/#3/#4/#5 (report shape, JSON, gate, version, masking) | 42d82bd | tests/cli/e2e-acceptance.test.ts |
| 3 | Live Apideck run verification (SC#1 live clause) | — | CHECKPOINT: awaiting human |

## What Was Built

### e2e-determinism.test.ts (SC#2 / D-02 / D-03)

5 tests proving the built CLI binary produces deterministic output end-to-end:

- **Human byte-identical x3**: 3 consecutive `lint <fixture> --ci` runs produce `out1 === out2 === out3`
- **No ANSI escapes**: human output verified free of `\x1b` bytes (NO_COLOR + --ci both enforced)
- **No ISO-8601 timestamp**: human path does not leak `generatedAt`/`capturedAt` (D-02 holds through CLI layer)
- **JSON deepEqual x3**: meta-stripped JSON bodies are deepEqual across 3 runs (only meta.generatedAt differs per D-10)
- **meta.generatedAt exists**: JSON output has the timestamp in the right place

### e2e-acceptance.test.ts (SC#1/#3/#4/#5)

17 tests covering all Phase 4 success criteria:

- **SC#5 version (2 tests)**: `--version` matches `/^voke \d+\.\d+\.\d+ \(MTQS v0\.1\)$/`; contains `MTQS v0.1`
- **SC#1 report shape (4 tests)**: server score banner, per-tool row, MTQS rule IDs in verbose, severity labels
- **SC#3 JSON shape (5 tests)**: valid JSON, serverScore+serverTier, 6 tools, mtqsVersion='0.1', per-tool fields
- **SC#4 gate (4 tests)**: exits 1 when score+1 above threshold (computed from live run), exits 0 at threshold, exits 0 at 0, exits 1 at 100
- **SC#5 masking PRIMARY (1 test)**: schemeless host triggers exit 3 (D-06 UsageError), combined output never contains `SUPERSECRETTOKEN`
- **SC#5 masking SECONDARY (1 test)**: file target with header exits 0, combined output never contains `SUPERSECRETTOKEN`

## Checkpoint Status

**Task 3 (human-verify)** requires a live network run against `https://mcp.apideck.dev/mcp`. See checkpoint details returned separately.

## Deviations from Plan

None. Plan executed exactly as written. The two auto tasks correspond precisely to the plan spec.

## Known Stubs

None.

## Verification Results

- `npx vitest run tests/cli/e2e-determinism.test.ts` — 5 tests, all green
- `npx vitest run tests/cli/e2e-acceptance.test.ts` — 17 tests, all green
- `npx vitest run` — 34 files, 604 tests, all green
- `npm run typecheck` — exit 0

## Self-Check: PASSED

- `tests/cli/e2e-determinism.test.ts` — FOUND (contains `dist/cli/index.js` and `execFileSync`)
- `tests/cli/e2e-acceptance.test.ts` — FOUND (contains `MTQS v0.1` and `SUPERSECRETTOKEN`)
- Commit e1affbb (Task 1) — FOUND
- Commit 42d82bd (Task 2) — FOUND
