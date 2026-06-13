---
phase: 04-scoring-output-cli
verified: 2026-06-13T08:10:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 4: Scoring, Output, and CLI Verification Report

**Phase Goal:** `voke lint <server-or-file>` works end-to-end and produces a human-readable + machine-readable report with per-rule findings, per-tool scores, and a server-level score + A–F tier; the first live run against the Apideck server produces a meaningful, reproducible score.
**Verified:** 2026-06-13T08:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `voke lint <target> --ci` produces a human report with `Server score: N/100  Tier X` banner | VERIFIED | `dist/cli/index.js lint apideck-snapshot.json --ci` -> `Server score: 85/100  Tier B`; SC#1 e2e test passes |
| 2  | Human report shows per-dimension weight breakdown (schema 1.5x, annotations 1.5x, description 1.2x, parameters 1.2x, naming 1.0x) in fixed order | VERIFIED | `format-human.ts` uses `DIMENSION_ORDER` const + `MULT` from `@voke/core`; live output confirmed |
| 3  | Human report shows per-tool scores for below-A tools sorted ascending; tier-A tools omitted | VERIFIED | `format-human.ts` filters `t.tier !== 'A'` and sorts by score; live output shows only `search (38/F)` and `hris_list_employees (84/B)` |
| 4  | `--output json` emits a full parseable `LintReport` (SC#3) | VERIFIED | JSON output round-trips: `mtqsVersion=0.1`, `serverScore`, `serverTier`, `tools[6]`, each with `score+tier+findings` |
| 5  | `--min-score N` exits 1 when `serverScore < N`, exits 0 when `serverScore >= N` (SC#4) | VERIFIED | `--min-score 100` exits 1 on the 85-score fixture; `--min-score 0` exits 0; SC#4 tests pass |
| 6  | Output is byte-identical across repeated runs on the same target (SC#2 determinism) | VERIFIED | e2e-determinism test asserts 3x identical human strings, no `\x1b`, no ISO-8601 timestamp; meta-stripped JSON bodies `deepEqual` across 3 runs |
| 7  | `voke --version` prints `voke X.Y.Z (MTQS v0.1)`; bearer tokens masked in all output paths (SC#5) | VERIFIED | `--version` -> `voke 0.0.0 (MTQS v0.1)`; PRIMARY masking test: schemeless host path (exit 3) never leaks `SUPERSECRETTOKEN`; SECONDARY test: file target also clean |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `packages/linter/src/version.ts` | `VOKE_VERSION`, `MTQS_VERSION`, `versionString()` | VERIFIED | Contains both constants; `versionString()` returns `voke ${VOKE_VERSION} (MTQS v${MTQS_VERSION})` |
| `packages/linter/src/cli/resolve-target.ts` | `resolveTarget` scheme-dispatch + `UsageError` | VERIFIED | `SCHEME_HANDLERS` registry; schemeless host:port throws with "Did you mean http://...?"; `exitCode = 3` |
| `packages/linter/src/cli/format-human.ts` | `formatHuman(report, opts) -> string` | VERIFIED | Banner uncolored; `MULT` weights in fixed dimension order; below-A only table sorted ascending; verbose finding detail |
| `packages/linter/src/cli/format-json.ts` | `formatJson(report) -> string` | VERIFIED | `canonicalJson(report)` — full `LintReport` including `meta.generatedAt`; stable across repeated calls |
| `packages/linter/src/cli/run-lint.ts` | `runLint(opts)` orchestration pipeline | VERIFIED | `resolveTarget -> ingestLive\|readSnapshot -> runRules(createDefaultRegistry()) -> buildReport -> format -> {report,text,exitCode}` |
| `packages/linter/src/cli/program.ts` | Commander program + `resolveLintOpts` helper | VERIFIED | `program.command('lint')` with all D-07 flags; `--version` wired; `maskHeaders` imported; `resolveLintOpts` exported for unit testing |
| `packages/linter/src/cli/index.ts` | Bin entrypoint (shebang) + D-13 exit-code catch | VERIFIED | First line `#!/usr/bin/env node`; maps `VokeError.exitCode`, `UsageError -> 3`, else `70` |
| `packages/linter/tsup.config.ts` | tsup build with dual entry: library + `cli/index` | VERIFIED | `entry: { index, 'cli/index' }`; `noExternal: ['ajv', 'ajv-formats', '@voke/core']` for self-contained binary |
| `tests/cli/e2e-determinism.test.ts` | Byte-identical x3 e2e proof | VERIFIED | Spawns built CLI via `execFileSync`; 5 passing tests for SC#2 |
| `tests/cli/e2e-acceptance.test.ts` | SC#1/#3/#4/#5 acceptance | VERIFIED | Contains `MTQS v0.1` and `SUPERSECRETTOKEN` assertions; all tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `format-json.ts` | `canonical-json.ts` | `canonicalJson(report)` | WIRED | Direct import + call; no `serializeReportBody` (correct: full doc for D-10) |
| `format-human.ts` | `@voke/core` scoring weights | `import { MULT }` in fixed dimension loop | WIRED | `MULT` imported; `DIMENSION_ORDER` const ensures fixed key order |
| `run-lint.ts` | `engine/runner.ts + registry.ts` | `runRules(snapshot.tools, createDefaultRegistry(), {})` | WIRED | Both imports present; called at line 103-104 |
| `run-lint.ts` | `ingestion/mcp-client.ts + snapshot-reader.ts` | `kind === 'live' ? ingestLive(...) : readSnapshot(...)` | WIRED | Both imports; `timeoutMs: opts.timeout` threaded at line 88-93 |
| `program.ts` | `process.exitCode` | `process.exitCode = result.exitCode` (no hard exit on success) | WIRED | Line 145; `process.exit(code)` only in error catch in `cli/index.ts` |
| `program.ts` | `ingestion/mcp-client.ts maskHeaders` | Re-exported for diagnostic use; guards any header echoing | WIRED | `import { maskHeaders, buildHeaders }` + re-export at line 154 |
| `e2e-determinism.test.ts` | `dist/cli/index.js` | `execFileSync('node', [BIN, ...args])` | WIRED | `BIN` resolves to `../../packages/linter/dist/cli/index.js`; `beforeAll` guards on `existsSync(BIN)` |
| `e2e-acceptance.test.ts` | `tests/fixtures/apideck-snapshot.json` | Offline fixture as hermetic target | WIRED | `FIXTURE` constant used in all acceptance test invocations |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCORE-01 | 04-02, 04-03 | Findings aggregate deterministically into per-dimension → per-tool → server scores + A-F tier | SATISFIED | `runLint` calls `runRules(createDefaultRegistry()) -> buildReport`; determinism proven by e2e tests |
| SCORE-02 | 04-01, 04-03 | Linter declares MTQS version in `--version` | SATISFIED | `version.ts` exports `MTQS_VERSION = '0.1'`; `versionString()` used by `buildProgram().version()` |
| OUT-01 | 04-01, 04-03 | Human-readable formatter prints per-rule findings + per-tool + server score + tier | SATISFIED | `formatHuman` outputs banner, dimension table, per-tool rows; verbose adds per-finding lines |
| OUT-02 | 04-01, 04-03 | JSON formatter emits full `LintReport` | SATISFIED | `formatJson = canonicalJson(report)` — full report; `JSON.parse` confirmed round-trip in e2e |
| CLI-01 | 04-02, 04-03 | `voke lint <server-url-or-file>` runs full ruleset and prints findings + scores | SATISFIED | Full pipeline wired in `run-lint.ts`; built binary confirmed working |
| CLI-02 | 04-02, 04-03 | `--min-score <threshold>` sets exit code | SATISFIED | D-13 gate: `exitCode = minScore !== undefined && serverScore < minScore ? 1 : 0`; e2e SC#4 passes |
| CLI-03 | 04-02, 04-03 | CLI supports `--header`, `--timeout`, file reading; bearer tokens masked | SATISFIED | All flags present in `program.ts`; `timeoutMs` threaded; PRIMARY + SECONDARY masking tests pass |

### Anti-Patterns Found

No anti-patterns detected. All scan targets (`run-lint.ts`, `program.ts`, `format-human.ts`, `format-json.ts`, `version.ts`, `resolve-target.ts`, `cli/index.ts`) are clean:
- Zero TODO/FIXME/PLACEHOLDER comments
- No empty return patterns (`return null`, `return {}`, `return []`)
- No stub implementations — all functions have real logic wired to real dependencies
- Score line in `format-human.ts` is never passed through chalk (D-03 upheld)

### Human Verification Required

Live Apideck run (SC#1 live clause) has been confirmed per the orchestrator's verified evidence:
- `lint https://mcp.apideck.dev/mcp --ci` -> `Server score: 62/100  Tier D`
- Two consecutive runs are byte-identical (determinism holds live)
- JSON output confirms `mtqsVersion=0.1`, `serverScore`, `serverTier`, `tools[]`
- No token or secret leak observed

The Apideck live server exposes 4 meta-tools (not 229 as stated in planning-time docs). The linter correctly ingested all 4 via its `do/while` pagination loop. The "229 tools" figure in the roadmap is stale and is not a code defect.

### Gaps Summary

No gaps. All 7 observable truths are verified, all 10 artifacts pass levels 1-3 (exists, substantive, wired), all 8 key links are wired, all 7 requirements are satisfied, and the live Apideck run has been confirmed by the orchestrator.

---

_Verified: 2026-06-13T08:10:00Z_
_Verifier: Claude (gsd-verifier)_
