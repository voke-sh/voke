---
phase: 05-ci-publication
plan: "01"
subsystem: ingestion-cli
tags: [stdio, mcp, cli, determinism, ing-06, subprocess]
dependency_graph:
  requires: []
  provides: [ingestStdio, StdioLaunchError, StdioTeardownError, stdio-cli-passthrough]
  affects: [run-lint, program, cli-index, ingestion-pipeline]
tech_stack:
  added:
    - StdioClientTransport from @modelcontextprotocol/sdk/client/stdio.js
    - StdioServerParameters type from @modelcontextprotocol/sdk/client/stdio.js
    - McpServer + StdioServerTransport in test fixture (stdio-server.mjs)
  patterns:
    - pre-commander argv split at '--' for stdio passthrough
    - --env KEY=VAL parsed + masked via maskHeaders pattern
    - same fetchAllTools/toolContentHash/localeCompare pipeline as ingestLive
key_files:
  created:
    - packages/linter/src/ingestion/stdio-client.ts
    - tests/fixtures/stdio-server.mjs
    - tests/ingestion/stdio-client.test.ts
  modified:
    - packages/linter/src/cli/resolve-target.ts
    - packages/linter/src/errors.ts
    - packages/linter/src/cli/index.ts
    - packages/linter/src/cli/program.ts
    - packages/linter/src/cli/run-lint.ts
    - tests/cli/resolve-target.test.ts
    - tests/cli/program.test.ts
    - tests/cli/e2e-determinism.test.ts
decisions:
  - Pre-split process.argv at '--' before commander sees it (simpler than passThroughOptions; no scheme misdetection)
  - StdioClientTransport receives only opts.extraEnv (not process.env); SDK merges getDefaultEnvironment() automatically
  - StdioLaunchError message uses only command name, never extraEnv values (Pitfall 4 masking)
  - server.url=null for stdio ingestion (no URL available for subprocess transport)
  - --env diagnostic echo uses maskHeaders pattern from mcp-client.ts (D-09 consistency)
metrics:
  duration: "9 minutes"
  completed: "2026-06-13T18:36:57Z"
  tasks_completed: 3
  files_changed: 8
  files_created: 3
---

# Phase 05 Plan 01: Stdio MCP Transport Ingestion (ING-06) Summary

**One-liner:** StdioClientTransport subprocess ingestion with --env masking, exit codes 8/9, and byte-identical x3 determinism via the same canonicalization pipeline as ingestLive.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add stdio TransportKind + exit-code errors + fixture server | 5c5a1d9 | resolve-target.ts, errors.ts, stdio-server.mjs |
| 2 RED | Failing tests for ingestStdio (TDD RED) | 2b5267a | stdio-client.test.ts |
| 2 GREEN | Implement ingestStdio() (TDD GREEN) | 13d502f | stdio-client.ts |
| 3 RED | Failing CLI tests (TDD RED) | 3cb2dfe | program.test.ts, resolve-target.test.ts, e2e-determinism.test.ts |
| 3 GREEN | Wire -- passthrough + --env into CLI | 7b1c745 | index.ts, program.ts, run-lint.ts |

## What Was Built

### ING-06: ingestStdio()

`packages/linter/src/ingestion/stdio-client.ts` — exports `ingestStdio(opts: IngestStdioOptions): Promise<VokeSnapshot>`.

The implementation:
1. Creates `StdioClientTransport({ command, args, env: extraEnv })` — passes ONLY `extraEnv`, never `process.env` (SDK handles environment merging via `getDefaultEnvironment()`)
2. Connects via `client.connect(transport)` — wraps failure in `StdioLaunchError(8)`
3. Reads server identity via `client.getServerVersion()` — sets `server.url = null` (no URL for stdio)
4. Fetches tools via the same `fetchAllTools` do/while loop as `ingestLive`
5. Maps to `ToolSnapshot` using the EXACT same `schemaDepth` + `toolContentHash` + `localeCompare` pipeline
6. Tears down via `client.close()` — wraps failure in `StdioTeardownError(9)` (SDK handles 3-stage: stdin-end → SIGTERM → SIGKILL)

### Exit Codes 8 and 9

`packages/linter/src/errors.ts` adds `StdioLaunchError(8)` and `StdioTeardownError(9)` as `VokeError` subclasses, wired automatically through the existing exit-code map in `index.ts`.

### Deterministic Fixture Server

`tests/fixtures/stdio-server.mjs` registers exactly 2 tools (`alpha_tool`, `beta_tool`) with fixed names/descriptions/schemas — no timestamps or random values. Deterministic on every connection.

### CLI -- Passthrough + --env

- `index.ts`: splits `process.argv` at `--` before commander parses — `stdioArgs` passed to `buildProgram(stdioArgs)`
- `program.ts`: `buildProgram(stdioArgs?)` accepts pre-split args; `--env KEY=VAL` repeatable option (parsed, validated, masked); lint `[target]` is optional in stdio mode
- `run-lint.ts`: `RunLintOpts` gains `stdioArgs?` and `extraEnv?`; `runLint` branches to `ingestStdio` when `stdioArgs` is set, bypassing `resolveTarget`

## Determinism Proof

Three consecutive runs of `node dist/cli/index.js lint --ci -- node tests/fixtures/stdio-server.mjs` produce byte-identical stdout (proven by `e2e-determinism.test.ts` SC#2 stdio describe block).

## Masking Proof

`--env SECRET=topsecret`: the value `topsecret` never appears in stdout or stderr. `StdioLaunchError` message references only `opts.command`, never `opts.extraEnv` values (Pitfall 4 guard).

## Tests

- `tests/ingestion/stdio-client.test.ts`: 5 tests — real launch (2-tool sorted VokeSnapshot), determinism x2, StdioLaunchError exit 8, env masking
- `tests/cli/program.test.ts` extended: 5 new --env parse tests
- `tests/cli/resolve-target.test.ts` extended: TransportKind type test updated to include 'stdio'
- `tests/cli/e2e-determinism.test.ts` extended: 3 new stdio e2e tests (x3 determinism, no ANSI, SECRET masking)

**Total new tests: 13. All green.**

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All outputs are wired to real data from the subprocess MCP server.

## Self-Check: PASSED

All created files found on disk. All task commits present in git history.
