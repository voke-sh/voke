---
phase: "05-ci-publication"
plan: "03"
subsystem: "docs-site"
tags: ["vitepress", "github-pages", "spec-publication", "docs"]
dependency_graph:
  requires: []
  provides: ["docs-site-build", "github-pages-workflow", "spec-versioned-url"]
  affects: ["PUB-01"]
tech_stack:
  added: ["vitepress@1.6.4"]
  patterns: ["VitePress static site", "GitHub Pages Actions deploy", "project-page subpath base"]
key_files:
  created:
    - docs/.vitepress/config.ts
    - docs/index.md
    - docs/spec/index.md
    - .github/workflows/docs.yml
  modified:
    - package.json
    - package-lock.json
    - .gitignore
decisions:
  - "VitePress base set to '/voke/' (project-page subpath) — required because repo is voke-sh/voke and GitHub Pages serves at github.io/voke/, not a custom domain"
  - "CNAME removed entirely — no custom domain at Phase 5; shipping CNAME would override the project-page domain and break the site"
  - "Custom domain voke.sh deferred: future one-commit change is base:'/' + restore CNAME when DNS is ready"
  - "spec/ files copied into docs/spec/v0.1/ at build time in workflow; source-of-truth spec/ never deleted"
  - "docs/spec/v0.1/ added to .gitignore — build-time copies not committed"
  - "GitHub Pages deploy uses upload-pages-artifact@v3 + deploy-pages@v4 with pages:write + id-token:write"
metrics:
  duration: "5 minutes"
  completed_date: "2026-06-13"
  tasks_completed: 2
  tasks_total: 3
  files_created: 4
  files_modified: 3
---

# Phase 05 Plan 03: VitePress Spec Site + GitHub Pages Deploy Summary

## One-liner

VitePress site at `docs/` with versioned MTQS spec under `/voke/` project-page base, GitHub Pages deploy workflow — spec accessible at https://voke-sh.github.io/voke/spec/ immediately on deploy.

## What Was Built

### Task 1: VitePress site scaffold (commit e1d2d4f)

- Installed `vitepress@1.6.4` as root devDependency
- Added `docs:dev`, `docs:build`, `docs:preview` scripts to root `package.json`
- Created `docs/.vitepress/config.ts` with `defineConfig`, MTQS title, spec sidebar with v0.1 group
- Created `docs/index.md` home page: MTQS title, determinism/open/CI-ready feature cards, link to spec
- Created `docs/spec/index.md` versions landing page: permanent v0.1 link, immutability policy
- Updated `.gitignore` to exclude `docs/.vitepress/dist/` and `docs/spec/v0.1/`
- Verified: `npm run docs:build` exits 0; dist/ present; v0.1 spec HTML at `dist/spec/v0.1/MTQS-v0.1.html`

### Task 2: GitHub Pages deploy workflow (commit 2f07d8e)

- Created `.github/workflows/docs.yml`
- Triggers on `push: branches: [main], paths: ['spec/**', 'docs/**']` plus `workflow_dispatch`
- Permissions: `contents: read`, `pages: write`, `id-token: write`
- Concurrency: `group: pages`, `cancel-in-progress: false`
- Build job: checkout@v4 → setup-node@v4 (Node 22, npm cache) → `npm ci` → copy spec files into docs → `npm run docs:build` → `upload-pages-artifact@v3` (path: `docs/.vitepress/dist`)
- Deploy job: `needs: build`, environment `github-pages`, `deploy-pages@v4`

### Task 3: Serve at GitHub Pages project-page path (commit — this change)

User decision: serve at `https://voke-sh.github.io/voke/` (project-page path), not a custom domain.

Changes applied:
- `docs/.vitepress/config.ts`: `base: '/voke/'` (was `base: '/'`) — required for asset paths to resolve under the project subpath
- `docs/public/CNAME` removed (`git rm`) — no custom domain at Phase 5; CNAME would override the project-page domain and break all asset references
- Build re-verified: `npm run docs:build` exits 0, `dist/spec/v0.1/MTQS-v0.1.html` present, no CNAME in dist, assets use `/voke/` prefix

Remaining human step (ONLY):
1. Enable GitHub Pages: repo Settings → Pages → Build and deployment → Source: **GitHub Actions**
2. Trigger docs.yml: push to main touching `spec/` or `docs/`, or run via `workflow_dispatch`
3. Verify site at **https://voke-sh.github.io/voke/spec/** — this is the PUB-01 acceptance URL

Future custom domain (when DNS is ready — trivial one-commit change):
- Change `base: '/voke/'` → `base: '/'` in `docs/.vitepress/config.ts`
- Restore `docs/public/CNAME` containing `voke.sh`
- DNS is NOT a Phase 5 deliverable

## Deviations from Plan

### User Decision Applied

**Task 3 — Project-page path instead of custom domain**

- **Found during:** Task 3 checkpoint (human-action)
- **Decision:** User chose to serve at `https://voke-sh.github.io/voke/` (GitHub Pages project-page URL) rather than setting up voke.sh custom domain in Phase 5
- **Impact:** `base` changed from `'/'` to `'/voke/'`; CNAME removed
- **Files modified:** `docs/.vitepress/config.ts`, `docs/public/CNAME` (removed)
- **Custom domain voke.sh:** Deferred; future change is trivial (one commit)

## Known Stubs

None. All content is wired. The spec files are the source of truth; docs copies are build-time only.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e1d2d4f | feat(05-03): scaffold VitePress site for MTQS spec publication |
| 2 | 2f07d8e | feat(05-03): add GitHub Pages deploy workflow for VitePress spec site |
| 3 | (this commit) | fix(05-03): serve spec at github.io/voke project path (base /voke/, drop CNAME) per user decision |

## Checkpoint Status

Task 3 human step resolved by user decision. Remaining action: enable GitHub Pages (Settings → Pages → Source: GitHub Actions) after repo is pushed to GitHub. DNS/custom domain is deferred.

## Self-Check: PASSED

- [x] `docs/.vitepress/config.ts` contains `base: '/voke/'`
- [x] `docs/public/CNAME` does not exist (removed via git rm)
- [x] `npm run docs:build` exits 0
- [x] `docs/.vitepress/dist/spec/v0.1/MTQS-v0.1.html` present in build output
- [x] No CNAME file in `docs/.vitepress/dist/`
- [x] Built assets use `/voke/` prefix (grep confirmed: `/voke/assets/style.*`)
- [x] `spec/MTQS-v0.1.md` untouched (immutable source of truth)
- [x] Commit e1d2d4f exists
- [x] Commit 2f07d8e exists
