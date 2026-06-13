---
phase: 04-scoring-output-cli
plan: "02"
subsystem: cli-wiring
tags: [cli, commander, mcp-client, run-lint, tsup, exit-codes, masking, determinism]
dependency_graph:
  requires:
    - packages/linter/src/version.ts (versionString — 04-01)
    - packages/linter/src/cli/resolve-target.ts (resolveTarget, UsageError — 04-01)
    - packages/linter/src/cli/format-human.ts (formatHuman — 04-01)
    - packages/linter/src/cli/format-json.ts (formatJson — 04-01)
  provides:
    - packages/linter/src/cli/run-lint.ts (runLint, RunLintOpts, RunLintResult)
    - packages/linter/src/cli/program.ts (buildProgram, resolveLintOpts, maskHeaders, buildHeaders)
    - packages/linter/src/cli/index.ts (bin entrypoint with shebang + D-13 catch)
    - packages/linter/src/ingestion/mcp-client.ts (live tools/list via StreamableHTTP + SSE fallback)
    - dist/cli/index.js (built, self-contained voke binary)
  affects:
    - packages/linter/package.json (bin field, files, build script -> tsup config)
    - packages/linter/tsup.config.ts (dual-entry build, @voke/core bundled)
    - packages/linter/tsconfig.json + packages/core/tsconfig.json (composite outDir -> dist-types)
tech_stack:
  added:
    - commander@15.0.0 (CLI framework — wired in program.ts)
  patterns:
    - runLint orchestrator: resolveTarget -> ingest(live|file) -> runRules(createDefaultRegistry()) -> score -> format
    - D-13 exit-code map in single top-level catch (VokeError.exitCode | UsageError=3 | internal=70)
    - Header/token masking in echoed lines and errors (D-15/D-16)
    - tsup noExternal bundling for self-contained single-binary CLI
    - Separate tsc composite outDir (dist-types) from tsup bundle output (dist)
key_files:
  created:
    - packages/linter/src/cli/run-lint.ts
    - packages/linter/src/cli/program.ts
    - packages/linter/src/cli/index.ts
    - packages/linter/tsup.config.ts
    - tests/cli/run-lint.test.ts
    - tests/cli/program.test.ts
  modified:
    - packages/linter/src/ingestion/mcp-client.ts
    - packages/linter/src/index.ts
    - packages/linter/package.json
    - packages/linter/tsconfig.json
    - packages/core/tsconfig.json
    - .gitignore
    - tests/rules/registry-coverage.test.ts
decisions:
  - "Bundle @voke/core into the linter via tsup noExternal — core exports resolve to TS source (not runnable JS); a shipped single-binary CLI must be self-contained"
  - "Composite tsc outDir moved dist -> dist-types for both packages: tsc --build and tsup both owned dist and clobbered each other (broken binary or TS6305 depending on run order); separating outputs makes build/typecheck order-independent"
  - "registry-coverage.test.ts now imports loadRegistryFile from '@voke/core' (was a hardcoded packages/core/dist path) — removes a build-order coupling that broke source-based typecheck"
metrics:
  duration: "timed-out agent (tasks 1-2) + orchestrator completion (task 3 + fixes)"
  completed: "2026-06-13"
  tasks_completed: 3
  files_changed: 13
---

# Phase 04 Plan 02: CLI Wiring Summary

**One-liner:** Full `voke lint` CLI wired end-to-end — runLint orchestrator + commander program + live MCP client + shippable `dist/cli/index.js` binary — producing deterministic findings + scores from both live URLs and offline file dumps.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | runLint orchestrator (CLI-01/CLI-03/SCORE-01) | 1932a4f | run-lint.ts, mcp-client.ts, index.ts, run-lint.test.ts |
| 2 | commander program + resolveLintOpts + exit-code map + masking (CLI-01/02/03) | 319851d | program.ts, index.ts, program.test.ts |
| 3 | bin entrypoint + tsup CLI build + dist/tsc output separation (D-09/D-13) | 1668c68 | cli/index.ts, tsup.config.ts, package.json, tsconfig (x2), .gitignore, registry-coverage.test.ts |

## What Was Built

### run-lint.ts (CLI-01/CLI-03/SCORE-01)
- `runLint(opts: RunLintOpts): Promise<RunLintResult>` — orchestrates the full pipeline: `resolveTarget -> ingest(live|file) -> runRules(createDefaultRegistry()) -> score -> format`
- Returns formatted output + the LintReport + the resolved exit code

### program.ts (CLI-01/02/03, D-13/D-15/D-16)
- `buildProgram()` — commander `Command` with the `lint` subcommand and `--min-score`, `--output`, `--ci`, `--header`, `--timeout` flags; `--version` surfaces `versionString()`
- `resolveLintOpts()` — maps parsed CLI args to `RunLintOpts`
- `maskHeaders` / `buildHeaders` — token/secret masking in echoed lines and errors (D-15/D-16)

### mcp-client.ts (live ingestion)
- Live `tools/list` via `StreamableHTTPClientTransport` with SSE fallback

### cli/index.ts (D-09/D-13)
- `#!/usr/bin/env node` shebang bin entry
- Single top-level catch implementing the D-13 exit-code map: `VokeError.exitCode` | `UsageError`=3 | internal=70

### tsup.config.ts (D-09)
- Dual-entry build (`index`, `cli/index`), ESM-only, `@voke/core` + ajv bundled inline → self-contained `dist/cli/index.js`

## Deviations from Plan

The plan-02 executor agent timed out after committing tasks 1-2 and writing the
task-3 source on disk (uncommitted, no SUMMARY). The orchestrator completed task 3
and resolved three blocking issues the plan did not anticipate.

**1. [Rule 3 - Blocking] Built binary crashed at runtime — `@voke/core` unresolved**
- **Issue:** tsup left `@voke/core` external; its `exports` resolve to `src/index.ts` (TS source), whose `./loadRegistry.js` relative import has no runnable JS → `ERR_MODULE_NOT_FOUND` on every invocation.
- **Fix:** Added `@voke/core` to tsup `noExternal` — bundle it into the linter. Correct for a single-binary CLI (CLAUDE.md: ships as a single entrypoint).
- **Commit:** 1668c68

**2. [Rule 3 - Blocking] tsc --build and tsup fought over `dist/`**
- **Issue:** `tsc --build` (composite typecheck) emits unbundled JS to `dist`, overwriting tsup's bundled `dist/cli/index.js` (re-breaking the binary); conversely tsup `clean:true` wipes tsc's declaration outputs → TS6305. Outcome depended on run order — a determinism/CI hazard.
- **Fix:** Moved composite `outDir` `dist` → `dist-types` for both `@voke/core` and `@voke/linter`; tsup keeps `dist`. Build and typecheck are now order-independent. Added `dist-types/` to `.gitignore`.
- **Commit:** 1668c68

**3. [Rule 1 - Bug] Source-based typecheck coupled to a prior build artifact**
- **Issue:** `tests/rules/registry-coverage.test.ts` (phase 3) imported `../../packages/core/dist/index.js` directly, unlike every sibling test which imports `@voke/core`. Typecheck only passed if core had been tsup-built first.
- **Fix:** Changed the import to `@voke/core`, matching siblings; removes the build-order coupling.
- **Commit:** 1668c68

## Known Stubs

None. Live MCP ingestion and offline file ingestion both produce real reports.

## Verification Results

- `npm run typecheck` — exit 0 (tsc --build, NodeNext, strict)
- `npx vitest run` — 32 files, 582 tests, all green
- `npm --workspace @voke/linter run build` — builds `dist/cli/index.js`
- All 6 task-3 acceptance criteria pass:
  - `--version` → `voke 0.0.0 (MTQS v0.1)`
  - `lint <fixture> --ci` → `Server score: 85/100  Tier B`, exit 0
  - `lint <fixture> --min-score 100 --ci` → exit 1
  - `lint ./does-not-exist.json` → exit 70
  - `--output json` → valid parseable JSON
- **Determinism contract holds:** meta-stripped JSON body byte-identical across runs; only `generatedAt` varies (excluded by D-10, proven in 04-03 e2e).

## Self-Check: PASSED

- `packages/linter/src/cli/run-lint.ts` — FOUND
- `packages/linter/src/cli/program.ts` — FOUND
- `packages/linter/src/cli/index.ts` — FOUND
- `packages/linter/tsup.config.ts` — FOUND
- `dist/cli/index.js` — BUILT
- Commit 1932a4f (Task 1) — FOUND
- Commit 319851d (Task 2) — FOUND
- Commit 1668c68 (Task 3 + fixes) — FOUND
