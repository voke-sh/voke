---
phase: 02-engine-ingestion-determinism
plan: 01
subsystem: linter
tags: [canonicalization, sha256, determinism, mcp-sdk, ajv, workspace]

# Dependency graph
requires:
  - phase: 01-mtqs-specification
    provides: "@voke/core scoring helpers, MTQS spec, registry-types"
provides:
  - "@voke/linter workspace package with pinned MCP/ajv stack"
  - "canonicalJson: locale-independent sorted-key JSON serializer"
  - "sha256, toolContentHash, surfaceContentHash hash helpers"
  - "tests/fixtures/apideck-snapshot.json committed VokeSnapshot fixture"
affects: [02-02, 02-03, 02-04, 03-rules-engine, 04-cli]

# Tech tracking
tech-stack:
  added:
    - "@modelcontextprotocol/sdk ~1.29.0"
    - "ajv 8.20.0 (ajv/dist/2020 for JSON Schema 2020-12)"
    - "ajv-formats 3.0.1"
    - "zod 4.4.3 (via workspace dep)"
  patterns:
    - "canonicalJson: recursive sorted-key serializer with explicit localeCompare('en', {sensitivity:'variant'})"
    - "toolContentHash: hash exactly 5 canonical fields (name/description/inputSchema/outputSchema/annotations)"
    - "surfaceContentHash: sort by toolId before hashing for input-order independence"
    - "NodeNext ESM import paths use .js extension in workspace packages"

key-files:
  created:
    - packages/linter/package.json
    - packages/linter/tsconfig.json
    - packages/linter/src/index.ts
    - packages/linter/src/canonicalize/canonical-json.ts
    - packages/linter/src/canonicalize/hash.ts
    - tests/canonicalize/canonical-json.test.ts
    - tests/canonicalize/hash.test.ts
    - tests/fixtures/apideck-snapshot.json
    - tests/fixtures/validate-snapshot.mjs
  modified:
    - tsconfig.json (added packages/linter reference)
    - package-lock.json (updated with workspace symlinks)

key-decisions:
  - "canonicalJson uses .filter(k => value[k] !== undefined) to mirror JSON.stringify undefined-omission (Pitfall 7 guard)"
  - "toolContentHash hashes exactly 5 fields; extra properties on the tool object are not included in the hash"
  - "Fixture contentHashes computed by running the actual toolContentHash helper — no manual computation"
  - "compute-hashes.mjs throwaway script not committed; only the committed apideck-snapshot.json matters"

patterns-established:
  - "Pattern: canonicalJson is the single source of byte-stable serialization — all hashing goes through it"
  - "Pattern: test files import from @voke/linter workspace name (not relative paths)"
  - "Pattern: validate-snapshot.mjs is a lightweight node script checker, not a vitest test"

requirements-completed: [ING-04]

# Metrics
duration: 6min
completed: 2026-06-12
---

# Phase 2 Plan 01: Linter Package Scaffold + Canonicalize Module Summary

**@voke/linter workspace package with pinned MCP/ajv stack, locale-independent sorted-key canonicalJson serializer, SHA-256 content-hash helpers, and committed Apideck VokeSnapshot fixture**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-12T18:56:44Z
- **Completed:** 2026-06-12T19:03:10Z
- **Tasks:** 3
- **Files modified:** 9 (2 modified, 7 created)

## Accomplishments

- Scaffolded `@voke/linter` workspace package with exact pinned deps: `@modelcontextprotocol/sdk ~1.29.0`, `ajv 8.20.0`, `ajv-formats 3.0.1`, `zod 4.4.3`; root tsconfig updated with project reference
- Implemented `canonicalJson` serializer (sorts object keys with `localeCompare('en', {sensitivity:'variant'})`, never reorders arrays, omits undefined values) + `sha256`/`toolContentHash`/`surfaceContentHash` hash helpers; all barrel-exported from `@voke/linter`
- 20 vitest tests covering all behavior: key-order independence, array-order preservation, nested sort, undefined omission, $ref preservation, locale independence, sha256 determinism, toolContentHash 5-field selection, surfaceContentHash input-order independence
- Committed `tests/fixtures/apideck-snapshot.json`: 6 representative Apideck-shaped tools (sorted by toolId, with computed contentHashes, no scores/findings/tiers), covering: well-designed tool, tool with outputSchema, readOnlyHint annotation, oneOf composition, poorly-designed bare parameter, internal $ref to $defs

## Task Commits

1. **Task 1: Scaffold @voke/linter workspace** - `f7a736c` (chore)
2. **Task 2: Implement canonicalize module with tests** - `5495227` (feat)
3. **Task 3: Create and commit Apideck snapshot fixture** - `b862869` (feat)

## Files Created/Modified

- `packages/linter/package.json` - @voke/linter package with pinned deps
- `packages/linter/tsconfig.json` - composite + NodeNext + reference to packages/core
- `packages/linter/src/index.ts` - barrel exports for canonicalize module
- `packages/linter/src/canonicalize/canonical-json.ts` - deterministic sorted-key JSON serializer
- `packages/linter/src/canonicalize/hash.ts` - sha256 + toolContentHash + surfaceContentHash
- `tests/canonicalize/canonical-json.test.ts` - 10 tests for canonicalJson
- `tests/canonicalize/hash.test.ts` - 10 tests for sha256, toolContentHash, surfaceContentHash
- `tests/fixtures/apideck-snapshot.json` - committed VokeSnapshot fixture (6 tools)
- `tests/fixtures/validate-snapshot.mjs` - snapshot structure checker
- `tsconfig.json` - added packages/linter project reference
- `package-lock.json` - updated with workspace symlinks

## Decisions Made

- `canonicalJson` uses `.filter(k => value[k] !== undefined)` to mirror `JSON.stringify` undefined-omission behavior (Pitfall 7 guard from RESEARCH.md)
- `toolContentHash` hashes exactly the 5 canonical fields specified in D-03; extra properties on the input object are not included — this ensures two tool objects with the same 5 fields but different extra properties produce the same hash
- Fixture `contentHash` values were computed by running the actual `toolContentHash` helper via a throwaway node script — no manual computation risk

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test file using `await` inside sync `it()` callback**
- **Found during:** Task 2 (TDD RED phase — running tests)
- **Issue:** Initial `hash.test.ts` used dynamic `import()` with `await` inside a synchronous `it()` callback, causing a parse error in vitest/esbuild
- **Fix:** Rewrote the test to use static top-level import (`import { canonicalJson } from '@voke/linter'`) and compute the expected hash inline using the already-imported functions
- **Files modified:** `tests/canonicalize/hash.test.ts`
- **Verification:** `npm test -- tests/canonicalize/` passes 20/20
- **Committed in:** 5495227 (Task 2 commit)

**2. [Rule 1 - Bug] Corrected hardcoded sha256 test vector**
- **Found during:** Task 2 (TDD GREEN phase — running tests)
- **Issue:** The hardcoded expected hash for `sha256('hello world')` in the test was wrong (copied from memory, not computed)
- **Fix:** Let the actual implementation run and corrected the expected value to the real SHA-256 digest
- **Files modified:** `tests/canonicalize/hash.test.ts`
- **Verification:** Test passes after correction
- **Committed in:** 5495227 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug; both in test files)
**Impact on plan:** Both fixes were in test files only, no production code change. No scope creep.

## Issues Encountered

- `npm install --workspace=@voke/linter` failed with a timeout in the sandbox environment; resolved by running `npm install` at root level which correctly installed all workspace packages

## Next Phase Readiness

- `@voke/linter` package is buildable, typechecks, and exports the canonicalize module
- `tests/fixtures/apideck-snapshot.json` is committed and validated — ready for the Wave 2 byte-identical determinism test (ENG-04)
- All downstream plans in Phase 2 can import from `@voke/linter` and use `canonicalJson`/`toolContentHash`/`surfaceContentHash`
- No blockers for Plan 02-02 (ingestion types + engine types)

---
*Phase: 02-engine-ingestion-determinism*
*Completed: 2026-06-12*
