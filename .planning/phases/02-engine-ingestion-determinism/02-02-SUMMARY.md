---
phase: 02-engine-ingestion-determinism
plan: 02
subsystem: ingestion
tags: [mcp-sdk, ajv, zod, json-schema, schema-depth, external-ref, snapshot, determinism]

# Dependency graph
requires:
  - phase: 02-engine-ingestion-determinism/02-01
    provides: canonicalJson, sha256, toolContentHash, surfaceContentHash

provides:
  - ToolSnapshot/VokeSnapshot/ServerIdentity types (ARCHITECTURE.md verbatim, D-02 meta block)
  - isValidJsonSchema2020 (Ajv2020 strict:false, D-06)
  - schemaDepth with DEPTH_HARD_CAP=32 and composition-keyword depth-0 rule (D-04/D-05)
  - hasExternalRef without IO (D-07)
  - VokeError + ConnectError/AuthError/PartialPageError/DepthExceededError with exit codes
  - ingestLive: StreamableHTTP+SSE fallback, paginated listTools, fail-fast, sorted VokeSnapshot
  - maskHeaders: replaces all header values with [MASKED] (D-09)
  - readSnapshot: Zod-validated offline reader (no SDK, no network, ING-03)
  - writeSnapshot: canonicalJson serialization for byte-identical re-writes
  - ING-05 fixtures: external-ref-tool.json and deep-schema-tool.json

affects: [02-03-engine, 03-rules, 04-cli]

# Tech tracking
tech-stack:
  added:
    - "@modelcontextprotocol/sdk ~1.29.0 — StreamableHTTPClientTransport, SSEClientTransport, Client, listTools"
    - "ajv/dist/2020 (Ajv2020) — JSON Schema 2020-12 validateSchema"
    - "ajv-formats 3.0.1 — standard format validators"
    - "zod 4.4.3 — VokeSnapshot parse-on-read validation"
  patterns:
    - "TDD red-green for all 3 tasks (49 tests covering all acceptance criteria)"
    - "Module-level ajv singleton (strict:false, never loadSchema) per D-06"
    - "Type declaration shims (src/types/ajv.d.ts) for NodeNext module resolution of legacy packages"
    - "DEPTH_HARD_CAP=32 early-bail prevents OOM; composition keywords (oneOf/anyOf/allOf) add 0 depth"
    - "connectWithFallback: try/catch on client.connect(), fresh Client for SSE fallback, headers on both"
    - "fetchAllTools: do/while on cursor truthiness (Pitfall 3 guard)"
    - "All raw header values masked with [MASKED] before any serialization (D-09)"

key-files:
  created:
    - packages/linter/src/ingestion/types.ts
    - packages/linter/src/ingestion/schema-checks.ts
    - packages/linter/src/ingestion/mcp-client.ts
    - packages/linter/src/ingestion/snapshot-reader.ts
    - packages/linter/src/ingestion/snapshot-writer.ts
    - packages/linter/src/errors.ts
    - packages/linter/src/types/ajv.d.ts
    - tests/ingestion/schema-checks.test.ts
    - tests/ingestion/mcp-client.test.ts
    - tests/ingestion/snapshot-reader.test.ts
    - tests/fixtures/external-ref-tool.json
    - tests/fixtures/deep-schema-tool.json
  modified:
    - packages/linter/src/index.ts
    - packages/linter/tsconfig.json

key-decisions:
  - "schemaDepth composition rule: pass current (not nodeDepth) to composition branches so oneOf/allOf/anyOf wrapper adds 0 levels as per D-05"
  - "NodeNext module resolution shim: src/types/ajv.d.ts provides ambient module declarations for ajv/dist/2020 and ajv-formats (no exports field in those packages)"
  - "Zod v4 z.record requires two args (key type + value type); snapshot-reader uses z.record(z.string(), z.unknown())"
  - "protocolVersion extracted from transport duck-typed after connect; SSEClientTransport has no public protocolVersion getter so defaults to 'unknown'"
  - "vitest mock pattern: class-based vi.mock with shared currentMockClient state variable to enable per-test client configuration"

patterns-established:
  - "Ingestion tests: fetch always stubbed to throw; proves no network in schema checks and offline reader"
  - "SDK mock pattern: class-based vi.mock returns instances that delegate to currentMockClient test variable"
  - "Offline guarantee: snapshot-reader.ts has zero @modelcontextprotocol imports"

requirements-completed: [ING-01, ING-02, ING-03, ING-05]

# Metrics
duration: 14min
completed: 2026-06-12
---

# Phase 02 Plan 02: Ingestion Layer Summary

**Ingestion layer with Ajv2020 schema-safety checks (depth cap 32, external-$ref detection), live MCP client (StreamableHTTP+SSE fallback, paginated listTools, header masking), and Zod-validated offline snapshot reader — all with deterministic sorted VokeSnapshot output**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-12T19:08:08Z
- **Completed:** 2026-06-12T19:22:XX Z
- **Tasks:** 3
- **Files modified:** 14 (12 created, 2 modified)

## Accomplishments
- Schema-safety module: Ajv2020 strict:false singleton, schemaDepth with DEPTH_HARD_CAP=32 and composition-adds-0 rule (D-04/D-05), hasExternalRef pure tree walk without IO (D-07)
- Live MCP client: StreamableHTTP primary + SSE fallback (auth headers on both, Pitfall 6 guard), paginated listTools with abort-on-page-failure (D-10), header masking (D-09), tools sorted ascending by toolId (determinism #1/#5)
- Offline snapshot reader: synchronous node:fs + Zod validation, zero SDK/network import (ING-03)
- Canonical snapshot writer: canonicalJson serialization for byte-identical re-writes (D-12)
- All 49 ingestion tests green; full suite 100 tests pass; typecheck clean

## Task Commits

1. **Task 1: Ingestion types, schema-safety checks, typed errors** - `e4b6683` (feat)
2. **Task 2: Live MCP client, connect-fallback, pagination, masking** - `b73d74d` (feat)
3. **Task 3: Offline snapshot reader/writer, ING-05 fixtures, type shims** - `d39ded8` (feat)

## Files Created/Modified
- `packages/linter/src/ingestion/types.ts` - ToolSnapshot/VokeSnapshot/ServerIdentity interfaces
- `packages/linter/src/ingestion/schema-checks.ts` - isValidJsonSchema2020, schemaDepth, hasExternalRef, DEPTH_HARD_CAP
- `packages/linter/src/ingestion/mcp-client.ts` - buildHeaders, maskHeaders, connectWithFallback, fetchAllTools, ingestLive
- `packages/linter/src/ingestion/snapshot-reader.ts` - readSnapshot (Zod-validated, offline)
- `packages/linter/src/ingestion/snapshot-writer.ts` - writeSnapshot (canonicalJson)
- `packages/linter/src/errors.ts` - VokeError, ConnectError(2), AuthError(3), PartialPageError(4), DepthExceededError(6)
- `packages/linter/src/types/ajv.d.ts` - NodeNext module resolution shims
- `packages/linter/src/index.ts` - appended ingestion barrel exports
- `packages/linter/tsconfig.json` - added paths overrides and d.ts include
- `tests/ingestion/*.test.ts` - 3 test files (49 tests)
- `tests/fixtures/external-ref-tool.json` - ING-05 external $ref fixture
- `tests/fixtures/deep-schema-tool.json` - ING-05 deep schema (40 levels) fixture

## Decisions Made

- **Composition depth rule:** schemaDepth passes `current` (not `nodeDepth`) to composition branches, making oneOf/anyOf/allOf/if/then/else/not add 0 depth levels as per D-05. This ensures `{oneOf:[{type:object,properties:{a:{type:string}}}]}` = depth 2, not 3.
- **NodeNext module shims:** ajv v8 and ajv-formats v3 lack `package.json` exports; added `src/types/ajv.d.ts` with ambient module declarations rather than changing moduleResolution. Runtime unaffected (Node.js CJS resolver doesn't require exports).
- **Zod v4 z.record:** v4 requires two type arguments; snapshot schema uses `z.record(z.string(), z.unknown())`.
- **protocolVersion fallback:** SDK's `getServerVersion()` returns `Implementation` (name+version only); protocol version duck-typed from transport after connect or defaults to 'unknown'. Phase 4 wires the actual negotiated value.
- **vitest SDK mock:** class-based mock classes with `currentMockClient` module-level variable allows per-test client configuration without `vi.mocked()` constructor issues.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] schemaDepth: composition keywords were adding +1 level**
- **Found during:** Task 1 (GREEN phase — tests failing after initial implementation)
- **Issue:** Original implementation passed `nodeDepth` to composition branches, so `{oneOf:[{type:object,properties:{a:{type:string}}}]}` returned 3 instead of expected 2
- **Fix:** Changed composition branch recursion to pass `current` (pre-node depth) not `nodeDepth`, making oneOf/anyOf/allOf/if/then/else/not transparent to depth counting
- **Files modified:** packages/linter/src/ingestion/schema-checks.ts
- **Verification:** 23 schema-checks tests pass including all composition tests
- **Committed in:** e4b6683

**2. [Rule 3 - Blocking] NodeNext can't resolve ajv/dist/2020 or ajv-formats**
- **Found during:** Task 3 (typecheck phase after all tests passed)
- **Issue:** TypeScript `moduleResolution: NodeNext` requires `exports` field in package.json for subpath imports; ajv v8 and ajv-formats v3 predate this; tsc --build failed with TS2307/TS2349
- **Fix:** Added `src/types/ajv.d.ts` with ambient module declarations for both packages; updated tsconfig.json to include `src/**/*.d.ts`
- **Files modified:** packages/linter/src/types/ajv.d.ts, packages/linter/tsconfig.json
- **Verification:** `npm run typecheck` exits 0
- **Committed in:** d39ded8

**3. [Rule 1 - Bug] Zod v4 z.record() requires two arguments**
- **Found during:** Task 3 (typecheck phase)
- **Issue:** `z.record(z.unknown())` is a Zod v3 API; Zod v4 requires `z.record(z.string(), z.unknown())`
- **Fix:** Updated all three z.record() calls in snapshot-reader.ts
- **Files modified:** packages/linter/src/ingestion/snapshot-reader.ts
- **Verification:** typecheck passes
- **Committed in:** d39ded8

**4. [Rule 1 - Bug] SDK getServerVersion() returns Implementation without protocolVersion**
- **Found during:** Task 2 (typecheck phase)
- **Issue:** `serverInfo?.protocolVersion` doesn't exist on SDK `Implementation` type
- **Fix:** Duck-typed extraction from transport after connect; defaults to 'unknown' for SSE transport
- **Files modified:** packages/linter/src/ingestion/mcp-client.ts
- **Verification:** typecheck passes; mcp-client tests still green
- **Committed in:** d39ded8

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking issues)
**Impact on plan:** All fixes necessary for correctness and typecheck compliance. No scope creep.

## Issues Encountered
- vitest's `vi.mocked(Constructor).mockImplementation(() => obj)` doesn't work for `new Constructor()` calls (vi warns "not a function or class"). Resolved by using class-based vi.mock factories with a shared test-scoped variable.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ingestion layer complete: both live (ingestLive) and offline (readSnapshot) paths produce sorted, content-hashed VokeSnapshot
- Schema-safety checks (Ajv2020, depth bound, external-ref) ready for Phase 3 rule implementations
- All ING-01/02/03/05 requirements completed; ING-04 was covered by Plan 01 (toolContentHash)
- Engine skeleton (02-03) can consume VokeSnapshot.tools directly

## Self-Check: PASSED

All 8 key files exist. All 3 task commits verified in git history.
- e4b6683: types.ts, schema-checks.ts, errors.ts, schema-checks.test.ts
- b73d74d: mcp-client.ts, mcp-client.test.ts, index.ts (Task 2 barrel)
- d39ded8: snapshot-reader.ts, snapshot-writer.ts, types/ajv.d.ts, fixtures, test
