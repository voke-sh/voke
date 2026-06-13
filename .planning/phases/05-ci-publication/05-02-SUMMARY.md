---
phase: 05-ci-publication
plan: 02
subsystem: infra
tags: [npm, github-actions, ci, publish, composite-action, provenance]

# Dependency graph
requires:
  - phase: 04-scoring-output-cli
    provides: "dist/cli/index.js binary with --min-score exit-code gate"
provides:
  - "@voke-sh/voke publishable npm package (scoped, public, provenance)"
  - "action.yml composite GitHub Action (npx @voke-sh/voke lint + --min-score gate)"
  - ".github/workflows/publish.yml (npm publish on release + v0 major-tag move)"
  - ".github/workflows/ci.yml (test + typecheck + build gate on push/PR)"
affects: [phase-06-readme-launch, consumers using uses: voke-sh/voke@v0]

# Tech tracking
tech-stack:
  added: [github-actions composite-action, npm-provenance, OIDC-id-token]
  patterns:
    - "Composite action with shell:bash on every run step (composite requirement)"
    - "npm publish --workspace with --provenance + OIDC id-token:write"
    - "Force-push v0 major tag after publish requires contents:write"
    - "Scoped package @voke-sh/voke avoids npm name collision (voke v1.0.2 taken)"
    - "tsup noExternal bundles @voke/core — removed from runtime deps, moved to devDependencies"

key-files:
  created:
    - "action.yml — root composite action wrapping npx @voke-sh/voke lint"
    - ".github/workflows/publish.yml — npm publish on GitHub release with provenance + v0 tag"
    - ".github/workflows/ci.yml — test + typecheck + build CI gate"
  modified:
    - "packages/linter/package.json — renamed @voke-sh/voke, version 0.1.0, public, publishConfig"
    - "packages/linter/src/version.ts — VOKE_VERSION bumped to '0.1.0'"

key-decisions:
  - "Published as @voke-sh/voke (scoped) because unscoped 'voke' is taken on npm (v1.0.2 exists)"
  - "Moving major tag is v0 (not v1) — matches v0.x versioning; README uses: voke-sh/voke@v0"
  - "@voke/core removed from dependencies (runtime), moved to devDependencies — tsup bundles it via noExternal so the published dist is self-contained without workspace resolution"
  - "publish.yml uses contents:write (not contents:read) — the v0 force-push step requires write access"
  - "action.yml args input is intentionally unquoted to allow multi-token expansion (stdio mode: -- node server.js)"
  - "score output in action.yml is best-effort; build-fail gate is authoritative via --min-score exit code"

patterns-established:
  - "Composite action pattern: using:composite + shell:bash on every run step"
  - "Publish pattern: npm publish --workspace @voke-sh/voke --provenance --access public"

requirements-completed: [CI-01]

# Metrics
duration: 3min
completed: 2026-06-13
---

# Phase 05 Plan 02: @voke-sh/voke Publish + GitHub Action Summary

**@voke-sh/voke 0.1.0 publishable package + composite GitHub Action + npm publish-on-release workflow with OIDC provenance and v0 major-tag move; paused at human-action checkpoint for npm org + NPM_TOKEN provisioning**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-13T18:27:54Z
- **Completed (checkpoint):** 2026-06-13T18:30:50Z
- **Tasks completed:** 2 of 3 (Task 3 is human-action checkpoint)
- **Files modified:** 5

## Accomplishments
- Renamed `packages/linter` from `@voke/linter` to `@voke-sh/voke` (scoped, avoids npm collision), set version 0.1.0, `private:false`, `publishConfig` with `access:public` + `provenance:true`
- Removed `@voke/core` from runtime `dependencies` (bundled by tsup `noExternal`) and moved to `devDependencies` — published package is self-contained without workspace resolution
- Bumped `VOKE_VERSION` to `'0.1.0'` to match `package.json` — `--version` now reports `voke 0.1.0 (MTQS v0.1)`
- Created `.github/workflows/publish.yml`: npm publish on GitHub Release with `--provenance`, `id-token:write` for OIDC, `contents:write` for v0 tag force-push; `--workspace @voke-sh/voke` (no stale `@voke/linter`)
- Created `.github/workflows/ci.yml`: test + typecheck + build gate on push/PR with Node 22
- Created root `action.yml`: composite action, Node 22 setup, all run steps with `shell:bash`, inputs `target`/`min-score`/`format`/`args`/`version`, scoped `npx @voke-sh/voke@version`, `target`/`min-score`/`format`/`version` quoted, `args` unquoted for multi-token expansion, stdio mode documented
- Build verified: `npm --workspace @voke-sh/voke run build` exits 0, `dist/cli/index.js --version` prints `voke 0.1.0 (MTQS v0.1)`

## Task Commits

Each task was committed atomically:

1. **Task 1: Make @voke-sh/voke publishable + bump VOKE_VERSION + publish workflow** - `d6d7a48` (feat)
2. **Task 2: Root composite action.yml wrapping npx @voke-sh/voke lint** - `c2c5502` (feat)
3. **Task 3: Provision npm org voke-sh + NPM_TOKEN secret** - HUMAN-ACTION CHECKPOINT (awaiting)

## Files Created/Modified
- `packages/linter/package.json` — renamed to @voke-sh/voke, version 0.1.0, public, publishConfig, @voke/core moved to devDependencies
- `packages/linter/src/version.ts` — VOKE_VERSION bumped to '0.1.0'
- `.github/workflows/publish.yml` — npm publish on release with provenance, v0 tag move
- `.github/workflows/ci.yml` — CI test + typecheck + build gate
- `action.yml` — composite GitHub Action wrapping npx @voke-sh/voke lint

## Decisions Made
- Published as `@voke-sh/voke` (scoped) because unscoped `voke` is taken on npm
- Moving major tag is `v0` (not `v1`) matching v0.x versioning
- `@voke/core` moved from `dependencies` to `devDependencies` — tsup bundles it; leaving it as a runtime dep would 404 on `npm install @voke-sh/voke`
- `publish.yml` uses `contents: write` (not `contents: read`) for v0 tag force-push
- `args` input in action.yml is intentionally unquoted for multi-token expansion

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Build succeeded on first attempt after moving `@voke/core` from `dependencies` to `devDependencies`.

## User Setup Required

**Task 3 (checkpoint:human-action):** The npm org and publish token require manual provisioning:
1. Create npm org `voke-sh` at https://www.npmjs.com/org/create
2. Generate npm Automation/Granular token with publish scope for @voke-sh
3. Add as GitHub repo secret `NPM_TOKEN` in repo Settings → Secrets and variables → Actions

The actual `npm publish` runs automatically via `publish.yml` on the first GitHub Release. Do NOT publish manually.

## Next Phase Readiness
- All code artifacts are ready for publish (package.json, action.yml, workflows)
- Blocked on human-action: npm org `voke-sh` + `NPM_TOKEN` GitHub secret must be provisioned before the first GitHub Release can trigger `publish.yml`
- Once Task 3 is confirmed, Phase 6 (README + launch) can proceed

---
*Phase: 05-ci-publication*
*Completed: 2026-06-13 (Tasks 1-2 complete; Task 3 awaiting human action)*

## Self-Check: PASSED

Files exist:
- FOUND: action.yml
- FOUND: .github/workflows/publish.yml
- FOUND: .github/workflows/ci.yml
- FOUND: packages/linter/package.json (name: @voke-sh/voke)
- FOUND: packages/linter/src/version.ts (VOKE_VERSION: 0.1.0)

Commits exist:
- FOUND: d6d7a48 (Task 1 - package.json + version.ts + workflows)
- FOUND: c2c5502 (Task 2 - action.yml)
