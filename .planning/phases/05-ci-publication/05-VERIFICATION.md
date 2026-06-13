---
phase: 05-ci-publication
verified: 2026-06-13T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Create npm org 'voke-sh' on npmjs.com, generate a Granular Access publish token for scope @voke-sh, and add it as GitHub repo secret NPM_TOKEN"
    expected: "npm view @voke-sh/voke version returns E404 (unclaimed); publish.yml fires on first GitHub Release and @voke-sh/voke 0.1.0 appears on npmjs.com"
    why_human: "npm org creation and token provisioning require authenticated npmjs.com browser actions; no CLI path from here"
  - test: "In GitHub repo Settings -> Pages, set Build and deployment Source to 'GitHub Actions', then push a change to spec/ or docs/ (or run docs.yml via workflow_dispatch)"
    expected: "docs.yml run is green; site is reachable at https://voke-sh.github.io/voke/spec/ and the v0.1 spec renders correctly"
    why_human: "GitHub Pages must be enabled in repo settings before the deploy workflow can run; requires GitHub UI access after the repo is pushed"
---

# Phase 5: CI + Publication Verification Report

**Phase Goal:** The linter ingests stdio MCP servers (hermetic CI + local dev loop), is usable from a GitHub Action with a one-line YAML config, the MTQS spec is publicly versioned at voke.sh/spec (or its public repo equivalent), and the repo is ready for external contribution before going public.
**Verified:** 2026-06-13
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `voke lint -- <cmd>` launches a stdio MCP server as a subprocess, retrieves the canonicalized VokeSnapshot, and tears the subprocess down deterministically (no orphan process, byte-identical output x3) | VERIFIED | `packages/linter/src/ingestion/stdio-client.ts` fully implements `ingestStdio` with SDK `StdioClientTransport`; CLI `index.ts` pre-splits argv at `--`; `run-lint.ts` calls `ingestStdio`; `tests/cli/e2e-determinism.test.ts` contains the stdio byte-identical x3 test (line 102); `tests/fixtures/stdio-server.mjs` (46 lines) is the deterministic fixture |
| 2 | A GitHub Action using `uses: voke-sh/voke@v0` with a `min-score` input runs `voke lint` in CI and fails the build below threshold | VERIFIED | `action.yml` at repo root: `using: 'composite'`, `shell: bash`, `npx @voke-sh/voke@"${{ inputs.version }}" lint "${{ inputs.target }}" --min-score "${{ inputs.min-score }}"`, `actions/setup-node@v4` with `node-version: '22'`; `publish.yml` has `--provenance`, `contents: write`, v0 tag move; npm publish fires on first GitHub Release |
| 3 | Copy-pasting the README's quickstart snippet into a new repo's workflow file produces a syntactically valid CI lint job without modification | VERIFIED | README line 24 contains `- uses: voke-sh/voke@v0` with `target` and `min-score: '70'` inputs that match `action.yml` exactly; scoped name `@voke-sh/voke` used throughout; no `@v1` tag; no unscoped `npx voke`; end-to-end run deferred to Phase 6 after first npm release |
| 4 | MTQS v0.1 spec is accessible, versioned, and accepts pull requests (public repo equivalent is voke-sh.github.io/voke/spec/) | VERIFIED (code) | VitePress site builds (`docs/.vitepress/dist/spec/v0.1/MTQS-v0.1.html` present); `docs.yml` workflow triggers on `spec/**`/`docs/**` changes with `deploy-pages@v4`; `docs/spec/index.md` lists v0.1 with permanent link; base is `/voke/` (deliberate: project-page subpath, CNAME removed - see Notes below) |
| 5 | CONTRIBUTING.md and a rule PR template exist in the repo; both linked from README; SCOPE.md linked from CONTRIBUTING.md | VERIFIED | `CONTRIBUTING.md` links `spec/SCOPE.md`, `.github/pull_request_template/rule_pr.md`, mentions `npm test` and `@voke-sh/voke`; `README.md` links both; `rule_pr.md` has primary-source/NOT-Glama checkbox, positive/negative fixture checkboxes, `mtqs-v0.1.yaml` registry checkbox, determinism checkboxes |

**Score:** 5/5 truths verified (code/config deliverables)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/linter/src/ingestion/stdio-client.ts` | `ingestStdio()` + `IngestStdioOptions` - StdioClientTransport wiring | VERIFIED | 185 lines; exports `ingestStdio`, `IngestStdioOptions`; uses `toolContentHash`, sorted by `localeCompare`; identical canonicalization pipeline to `ingestLive` |
| `packages/linter/src/errors.ts` | `StdioLaunchError` (exit 8) + `StdioTeardownError` (exit 9) | VERIFIED | Lines 94-117: `StdioLaunchError extends VokeError` with exitCode 8; `StdioTeardownError extends VokeError` with exitCode 9; VokeError base carries exitCode |
| `tests/fixtures/stdio-server.mjs` | Deterministic 2-tool stdio MCP fixture server, min 20 lines | VERIFIED | 46 lines - exceeds minimum |
| `packages/linter/src/cli/resolve-target.ts` | `TransportKind` extended with `'stdio'`; `ResolvedTarget.stdioArgs` | VERIFIED | Line 16: `export type TransportKind = 'live' | 'file' | 'stdio'`; lines 22-23: `stdioArgs?: string[]` in `ResolvedTarget` |
| `action.yml` | Composite GitHub Action wrapping `npx @voke-sh/voke lint` | VERIFIED | Contains `using: 'composite'`; `shell: bash`; all 5 inputs (`target`, `min-score`, `format`, `args`, `version`); quotes single-token inputs; `actions/setup-node@v4` with node-version 22 |
| `.github/workflows/publish.yml` | npm publish on release with provenance + v0 tag move | VERIFIED | Contains `--provenance`, `--workspace @voke-sh/voke`, `--access public`, `contents: write`, `id-token: write`, `git push origin v0 --force`; no stale `@voke/linter` |
| `packages/linter/package.json` | Publishable `@voke-sh/voke` package metadata | VERIFIED | `"name": "@voke-sh/voke"`, `"version": "0.1.0"`, `"private": false`, `publishConfig.access: "public"`, `publishConfig.provenance: true`; `@voke/core` in devDependencies only (not runtime) |
| `docs/.vitepress/config.ts` | VitePress config with `defineConfig`, spec sidebar | VERIFIED | Contains `defineConfig`, `title: 'MTQS'`, spec sidebar with v0.1 group, nav links |
| `.github/workflows/docs.yml` | Build + deploy to GitHub Pages on spec/docs changes | VERIFIED | Contains `cp spec/MTQS-v0.1.md docs/spec/v0.1/`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`, `pages: write`, `id-token: write`, `path: docs/.vitepress/dist` |
| `docs/spec/index.md` | Versions landing page with permanent v0.1 link | VERIFIED | Contains v0.1 entry with permanent link; states old versions are never deleted |
| `LICENSE` | Apache-2.0 verbatim | VERIFIED | Contains "Apache License", "Version 2.0, January 2004", full text with appendix |
| `README.md` | Action-first quickstart + local one-liner + links | VERIFIED | Leads with `uses: voke-sh/voke@v0`, `min-score: '70'`; uses `npx @voke-sh/voke` throughout; links CONTRIBUTING.md and rule PR template; mentions `voke.sh/spec` (parenthetically as target URL) |
| `CONTRIBUTING.md` | Rule-PR rigor, links SCOPE.md + rule PR template | VERIFIED | Links `spec/SCOPE.md`, `rule_pr.md`; enforces primary-source citation (never Glama), positive/negative fixtures, determinism, `npm test`, `@voke-sh/voke` |
| `.github/pull_request_template/rule_pr.md` | Rule PR template enforcing primary-source citation (never Glama) | VERIFIED | Contains mandatory "I am NOT citing Glama" checkbox; positive-fixture, negative-fixture, mtqs-v0.1.yaml registry, determinism checkboxes; links SCOPE.md |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/linter/src/cli/index.ts` | `buildProgram` | `process.argv.indexOf('--')` pre-split | WIRED | Lines 25-26: `const dashIdx = process.argv.indexOf('--')` extracts `stdioArgs` before commander parses |
| `packages/linter/src/cli/run-lint.ts` | `ingestStdio` | `stdioArgs` branch bypasses `resolveTarget` | WIRED | Lines 19, 93-98: imports `ingestStdio`; `if (opts.stdioArgs !== undefined && opts.stdioArgs.length > 0)` calls `ingestStdio` |
| `packages/linter/src/ingestion/stdio-client.ts` | `toolContentHash` canonicalization pipeline | Reuses same hash/sort as `ingestLive` | WIRED | Imports `toolContentHash` from `../canonicalize/hash.js`; uses identical sort/contentHash logic |
| `action.yml` | npm package `@voke-sh/voke` | `npx @voke-sh/voke@${{ inputs.version }} lint` | WIRED | Run command: `npx @voke-sh/voke@"${{ inputs.version }}" lint "${{ inputs.target }}"` |
| `action.yml min-score input` | CLI `--min-score` gate (exit 1 below threshold) | `--min-score "${{ inputs.min-score }}"` | WIRED | Run command includes `--min-score "${{ inputs.min-score }}"` (quoted) |
| `.github/workflows/publish.yml` | `@voke-sh/voke` on npm | `npm publish --workspace @voke-sh/voke --provenance --access public` | WIRED | Contains `npm publish --workspace @voke-sh/voke --provenance --access public` |
| `.github/workflows/docs.yml` | `docs/spec/v0.1/MTQS-v0.1.md` | `cp spec/MTQS-v0.1.md docs/spec/v0.1/` before `docs:build` | WIRED | Step "Copy spec files into docs" runs exactly this command |
| `README.md` | GitHub Action (`action.yml` from Plan 02) | `uses: voke-sh/voke@v0` with min-score | WIRED | Line 24: `- uses: voke-sh/voke@v0`; lines 27: `min-score: '70'` |
| `CONTRIBUTING.md` | `spec/SCOPE.md` §4 primary-source rule | Markdown link | WIRED | Line 29: links `[spec/SCOPE.md](spec/SCOPE.md)` |
| `README.md` | voke.sh/spec (Plan 03 site) | Spec link | WIRED | Line 135: interim URL `https://voke-sh.github.io/voke/spec/` with parenthetical `(voke.sh/spec once the custom domain is live)` - pattern "voke.sh/spec" is present |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ING-06 | 05-01-PLAN.md | Ingest from stdio MCP server launched as subprocess; same canonicalized surface; subprocess torn down deterministically | SATISFIED | `ingestStdio` in `stdio-client.ts`; StdioLaunchError/TeardownError (exit 8/9); `--` argv split; byte-identical x3 test |
| CI-01 | 05-02-PLAN.md | GitHub Action wrapper + YAML config runs `voke lint` in CI and fails build below threshold | SATISFIED (code) | `action.yml` composite action; `publish.yml` wired; `ci.yml` test gate; human action: npm org + NPM_TOKEN |
| CI-02 | 05-04-PLAN.md | README doubles as the demo (copy-paste runnable) | SATISFIED | README leads with zero-modification Action snippet (`uses: voke-sh/voke@v0`, `min-score: '70'`); inputs match `action.yml`; live run deferred to Phase 6 post-publish |
| PUB-01 | 05-03-PLAN.md | MTQS spec published and versioned at voke.sh/spec in a public repo accepting PRs | SATISFIED (code) | VitePress site builds; `docs.yml` deploy workflow; spec at `voke-sh.github.io/voke/spec/`; human action: enable GitHub Pages |
| PUB-02 | 05-04-PLAN.md | CONTRIBUTING.md + rule PR template exist before repo goes public; linked from README; SCOPE.md linked from CONTRIBUTING.md | SATISFIED | All four files present; all cross-links verified |

### Notes on Deliberate Plan Deviations

**VitePress base `/voke/` vs `/`:** Plan 03 must_haves specified `base: '/'` (custom-domain root) but the executor changed this to `base: '/voke/'` in the final implementation. The SUMMARY (05-03-SUMMARY.md) documents this as a deliberate decision: "VitePress base set to '/voke/' (project-page subpath) — required because repo is voke-sh/voke and GitHub Pages serves at github.io/voke/, not a custom domain." The CNAME file was also deliberately removed. This is correct for a GitHub Pages project page and will require a one-commit update when the custom domain is configured. The ROADMAP success criterion accepts "public repo equivalent" — voke-sh.github.io/voke/spec/ satisfies this.

**`voke.sh/spec` in README:** The key_link check for the "voke.sh/spec" pattern passes — the README at line 135 references it parenthetically as the custom-domain target URL. The actual functional link points to the interim `voke-sh.github.io/voke/spec/` URL.

### Anti-Patterns Found

No blocking or warning anti-patterns found. Key files scanned:
- `packages/linter/src/ingestion/stdio-client.ts` - substantive implementation, no stubs
- `action.yml` - complete composite action, no placeholders
- `.github/workflows/publish.yml` - complete workflow, no stubs
- `README.md` - accurate documentation, correct package name/tags throughout
- `CONTRIBUTING.md` - substantive contribution guide
- `.github/pull_request_template/rule_pr.md` - complete PR template with mandatory checkboxes

No em dashes found in any Phase 5 documentation files. No stale `@voke/linter` references in any workflow or action file.

### Human Verification Required

#### 1. npm org + NPM_TOKEN provisioning (CI-01 deferred-infra)

**Test:** Create npm org `voke-sh` at https://www.npmjs.com/org/create. Generate a Granular Access token with publish permission for scope `@voke-sh`. Add as GitHub repo secret `NPM_TOKEN`.
**Expected:** On first GitHub Release, `publish.yml` runs, publishes `@voke-sh/voke@0.1.0` to npm, and force-pushes the `v0` major tag. `npm view @voke-sh/voke version` returns `0.1.0`.
**Why human:** npm org creation and token provisioning require authenticated npmjs.com browser actions; no CLI path available from here. Note: do NOT publish manually - `publish.yml` handles it on the first Release.

#### 2. GitHub Pages enable + docs deployment (PUB-01 deferred-infra)

**Test:** In GitHub repo Settings -> Pages, set Build and deployment Source to "GitHub Actions". Then push a change touching `spec/` or `docs/`, or trigger `docs.yml` via `workflow_dispatch`.
**Expected:** `docs.yml` run is green; site reachable at `https://voke-sh.github.io/voke/spec/`; MTQS v0.1 spec renders; sidebar shows v0.1 group.
**Why human:** GitHub Pages source must be enabled in repo settings UI before the deploy workflow can run; requires GitHub access after the repo is pushed to github.com/voke-sh/voke.

### Gaps Summary

No gaps blocking goal achievement. All five code/config deliverables are fully implemented, substantive, and wired. The two deferred-infra items (npm org + GitHub Pages enable) are inherently human-action steps that cannot complete until the repo is pushed to GitHub - classified as `human_needed`, not gaps.

---

_Verified: 2026-06-13_
_Verifier: Claude (gsd-verifier)_
