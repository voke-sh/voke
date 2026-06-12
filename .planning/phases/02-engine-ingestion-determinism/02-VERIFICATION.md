---
phase: 02-engine-ingestion-determinism
verified: 2026-06-12T20:45:00Z
status: passed
score: 9/9 must-haves verified
---

# Phase 2: Engine + Ingestion + Determinism Verification Report

**Phase Goal:** A working, determinism-guaranteed runtime exists — the engine can run rules against a canonicalized tool surface from either a live MCP server or a saved snapshot, and the output is byte-identical across repeated runs on identical input

**Verified:** 2026-06-12T20:45:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Test Execution Results

- `npx tsc --build`: exits 0 (no output, clean)
- `npx vitest run`: 163 passed across 19 test files (0 failures, 0 skipped)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Engine runs 3x on Apideck fixture producing byte-identical JSON output | VERIFIED | `tests/engine/determinism.test.ts` Test A: `expect(r1).toBe(r2); expect(r2).toBe(r3)` — 6 tests pass |
| 2 | MCP client connects to streamable-HTTP with bearer/custom headers | VERIFIED | `mcp-client.ts` `StreamableHTTPClientTransport` + `SSEClientTransport` both receive `requestInit: { headers }` (lines 96-98, 105-107) |
| 3 | Offline snapshot reader requires zero network calls | VERIFIED | `snapshot-reader.ts` imports only `node:fs` + `zod`; no `@modelcontextprotocol/sdk` import; grep confirms no SDK dependency |
| 4 | Tools sorted by stable toolId; per-tool SHA-256 contentHash computed | VERIFIED | `mcp-client.ts` sorts via `localeCompare('en', {sensitivity:'variant'})`; `toolContentHash` in `hash.ts` |
| 5 | External `$ref` detected without outbound HTTP; depth cap rejects over-deep schemas | VERIFIED | `hasExternalRef` pure tree-walk (no fetch); `DEPTH_HARD_CAP = 32`; schema-checks tests stub fetch to throw and still pass; deep-schema fixture is 40 levels deep |
| 6 | Rules are pure `(ctx) => Finding[]` on a frozen context | VERIFIED | `Object.freeze` in `runner.ts` lines 66, 83; `frozen-ctx.test.ts` proves mutation throws RuleExecutionError |
| 7 | Registry seals; post-seal registration throws; `applyOverrides` returns NEW registry | VERIFIED | `registry.ts` line 27: `if (this.sealed) throw`; `applyOverrides` constructs `new RuleRegistry()` (line 66); registry tests cover all three behaviors |
| 8 | Rule throw aborts run with RuleExecutionError naming rule + tool | VERIFIED | `runner.ts` lines 74-77 and 91-93; `RuleExecutionError(rule.id, tool.toolId, err)` and `RuleExecutionError(rule.id, 'SERVER', err)` |
| 9 | `buildReport` reuses `@voke/core` scoring; no reimplemented arithmetic | VERIFIED | `builder.ts` line 1: `import { scoreTool, applyCaps, tierFor, serverScore as coreServerScore } from '@voke/core'`; no `Math.round`, no penalty/BASE/MULT in builder |

**Score:** 9/9 truths verified

---

## Required Artifacts

### Plan 02-01 (ING-04: Canonicalize + Fixture)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/linter/package.json` | VERIFIED | Has `@modelcontextprotocol/sdk: "~1.29.0"`, `ajv: "8.20.0"`, `ajv-formats: "3.0.1"`, `@voke/core: "*"` with exact/minor pins |
| `packages/linter/src/canonicalize/canonical-json.ts` | VERIFIED | Exports `canonicalJson`; sorts with `localeCompare('en', {sensitivity:'variant'})`; arrays never reordered; undefined keys omitted |
| `packages/linter/src/canonicalize/hash.ts` | VERIFIED | Exports `sha256`, `toolContentHash`, `surfaceContentHash`; uses `createHash('sha256')`; imports `canonicalJson` |
| `tests/fixtures/apideck-snapshot.json` | VERIFIED | 6 tools, sorted ascending by toolId, all 64-char contentHashes, no score/findings/tier fields, contains `#/$defs/` internal ref |

### Plan 02-02 (ING-01/02/03/05: Ingestion Layer)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/linter/src/ingestion/types.ts` | VERIFIED | Exports `ToolSnapshot`, `VokeSnapshot`, `ServerIdentity` verbatim from ARCHITECTURE.md |
| `packages/linter/src/ingestion/schema-checks.ts` | VERIFIED | Exports `isValidJsonSchema2020`, `schemaDepth`, `hasExternalRef`, `DEPTH_HARD_CAP`; `Ajv2020({ strict: false })`; `loadSchema` never wired |
| `packages/linter/src/ingestion/mcp-client.ts` | VERIFIED | Exports `ingestLive`, `maskHeaders`; both transports pass `requestInit: { headers }`; pagination with `do/while` on cursor; `PartialPageError` on page failure; `DepthExceededError` on depth cap |
| `packages/linter/src/ingestion/snapshot-reader.ts` | VERIFIED | Exports `readSnapshot`; imports only `node:fs` and `zod`; no SDK import; Zod schema validates shape |
| `packages/linter/src/errors.ts` | VERIFIED | `ConnectError(exitCode=2)`, `AuthError(exitCode=3)`, `PartialPageError(exitCode=4)`, `DepthExceededError(exitCode=6)` |
| `tests/fixtures/external-ref-tool.json` | VERIFIED | Contains `"$ref": "https://malicious.example.com/schema.json"` |
| `tests/fixtures/deep-schema-tool.json` | VERIFIED | 40 levels of nesting (exceeds DEPTH_HARD_CAP=32) |

### Plan 02-03 (ENG-01/02/03: Rule Engine)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/linter/src/engine/types.ts` | VERIFIED | Exports `RuleContext`, `RuleFunction`, `RuleDefinition`, `Finding`, `FindingLocation`; imports `Severity`/`DimensionId` from `@voke/core` (not redefined) |
| `packages/linter/src/engine/registry.ts` | VERIFIED | `RuleRegistry` class with `register`/`seal`/`list`/`applyOverrides`; `createDefaultRegistry` factory; sealed, empty in Phase 2 |
| `packages/linter/src/engine/runner.ts` | VERIFIED | `runRules` + `RuleExecutionError`; `Object.freeze` on both tool and server context paths; three-key finding sort (`toolId → ruleId → path`); `'off'` skip |

### Plan 02-04 (ENG-04: Report + Determinism Test)

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/linter/src/report/builder.ts` | VERIFIED | Exports `buildReport`, `serializeReportBody`; delegates scoring to `@voke/core`; `serializeReportBody` destructures `meta` out before `canonicalJson` |
| `tests/engine/determinism.test.ts` | VERIFIED | Contains byte-identical x3 test (r1===r2===r3); shuffled/reversed input invariance; meta exclusion assertions for `generatedAt` and `capturedAt`; all 6 tests pass |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `hash.ts` | `canonical-json.ts` | `import canonicalJson` | WIRED | Direct import, used in both `toolContentHash` and `surfaceContentHash` |
| `root tsconfig.json` | `packages/linter` | project reference | WIRED | `{ "path": "./packages/linter" }` in references array |
| `mcp-client.ts` | `hash.ts` | `toolContentHash` on each tool | WIRED | `toolContentHash(...)` called in `ingestLive` for every mapped tool |
| `schema-checks.ts` | `ajv/dist/2020` | `new Ajv2020({ strict: false })` | WIRED | Module-level instantiation; `addFormats(ajv)` wired |
| `runner.ts` | `registry.ts` | `registry.list()` iterated | WIRED | `const rules = registry.list()` at top of `runRules` |
| `runner.ts` | `types.ts` | `Object.freeze` on `RuleContext` | WIRED | Lines 66 and 83 |
| `builder.ts` | `@voke/core` | `scoreTool/applyCaps/tierFor/serverScore` | WIRED | Import line 1; called for every tool in `buildReport` |
| `determinism.test.ts` | `builder.ts` | `serializeReportBody` called 3x | WIRED | `runAndSerialize` helper calls `buildReport` then `serializeReportBody`; r1/r2/r3 compared |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ENG-01 | 02-03 | Rules typed as pure `(context) => Finding[]`, no IO | SATISFIED | `RuleFunction = (ctx: RuleContext) => Finding[]`; context is frozen; network-block test infra proven |
| ENG-02 | 02-03 | Per-tool and server-aggregate rules supported | SATISFIED | `target: 'tool' | 'server'` routing in `runRules`; per-tool loops surface, server passes `tool: null` |
| ENG-03 | 02-03 | Registry seals; custom rules register before seal; overrides produce new registry | SATISFIED | `seal()` rejects post-seal `register()`; `applyOverrides` constructs `new RuleRegistry()` — original unchanged |
| ENG-04 | 02-04 | Byte-identical output x3 on identical input | SATISFIED | `determinism.test.ts` Test A passes; 3 consecutive runs on Apideck fixture produce identical serialized body |
| ING-01 | 02-02 | Live streamable-HTTP connection with paginated `tools/list` | SATISFIED | `connectWithFallback` + `fetchAllTools` with `do/while` pagination; mocked in `mcp-client.test.ts` (49 tests pass) |
| ING-02 | 02-02 | Auth via static bearer token / custom header | SATISFIED | `buildHeaders` parses raw header strings; both `StreamableHTTPClientTransport` and `SSEClientTransport` receive `requestInit: { headers }` |
| ING-03 | 02-02 | Offline snapshot reader with zero network | SATISFIED | `snapshot-reader.ts` uses only `node:fs` + `zod`; no SDK import; `readSnapshot` tested with fetch stubbed to throw |
| ING-04 | 02-01 | Tools sorted by stable `toolId`; per-tool SHA-256 `contentHash`; L2-diff-ready | SATISFIED | `localeCompare('en', {sensitivity:'variant'})` sort in `mcp-client.ts` and `buildReport`; `toolContentHash` on every tool; `ToolSnapshot` interface has `toolId` + `contentHash` |
| ING-05 | 02-02 | No auto-deref of external `$ref`; depth bounded; full JSON Schema 2020-12 accepted | SATISFIED | `hasExternalRef` pure tree-walk; `DEPTH_HARD_CAP = 32`; `Ajv2020({ strict: false })` accepts `oneOf/anyOf/allOf`; `loadSchema` explicitly excluded via type declaration and comment guards |

**All 9 phase requirements: SATISFIED**

---

## Anti-Patterns Found

No blocking anti-patterns found.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `mcp-client.ts:240` | `new Date().toISOString()` — wall clock | INFO | Intentional; `capturedAt` lives in `meta` block, excluded from content hash and determinism test body (D-02 by design) |
| `report/builder.ts:84` | `new Date().toISOString()` — wall clock | INFO | Intentional; `generatedAt` lives in `meta` block, stripped by `serializeReportBody` before comparison (D-02 by design) |
| `schema-checks.ts` | `loadSchema` mentions in comments | INFO | Only in negative-case guards (comments and type declaration ban); `loadSchema` is never wired — confirmed by `grep -r loadSchema packages/linter/src/` returning only comment/type hits |
| `canonicalize/canonical-json.ts` | `localeCompare` with `en` locale | INFO | Required for locale-independent determinism; uses explicit locale `'en'` with `{sensitivity:'variant'}` per plan spec — correct, not a bug |

---

## Human Verification Required

None. All phase-2 behaviors are deterministic and fully verifiable programmatically. The live MCP connection path (`ingestLive`) is not exercised (live server not required for Phase 2 DoD — mocked in tests per plan design).

---

## Determinism Points Verification (7 Points from ARCHITECTURE.md)

| Point | Mechanism | Location | Verified |
|-------|-----------|----------|---------|
| #1 Sort tools on ingest | `localeCompare('en', {sensitivity:'variant'})` | `mcp-client.ts` `ingestLive` | YES |
| #2 Frozen RuleContext | `Object.freeze(ctx)` | `runner.ts` lines 66, 83 | YES |
| #3 Sort ToolReports by toolId | `sortedTools` in `buildReport` | `report/builder.ts` line 44 | YES |
| #4 Sort rules by id | `registry.list()` with `localeCompare` | `registry.ts` line 51 | YES |
| #5 Sort surface before rule iteration | `sortedSurface` in `runRules` | `runner.ts` line 51 | YES |
| #6 SHA-256 contentHash per tool | `toolContentHash` → `sha256(canonicalJson(...))` | `hash.ts` | YES |
| #7 Published scoring weights | `@voke/core` `scoreTool`/`applyCaps`/`tierFor` | `report/builder.ts` | YES |

---

## Gaps Summary

No gaps. All 9 requirements are satisfied. All 163 tests pass. TypeScript build is clean. The phase exit criterion (byte-identical x3 determinism test on the committed Apideck fixture) passes with 6 test cases covering: identical x3, reversed input, mid-rotation, generatedAt exclusion, capturedAt exclusion, and fixture size validation.

---

_Verified: 2026-06-12T20:45:00Z_
_Verifier: Claude (gsd-verifier)_
