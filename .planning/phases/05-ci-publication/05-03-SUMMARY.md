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
  patterns: ["VitePress static site", "GitHub Pages Actions deploy", "CNAME custom domain"]
key_files:
  created:
    - docs/.vitepress/config.ts
    - docs/index.md
    - docs/spec/index.md
    - docs/public/CNAME
    - .github/workflows/docs.yml
  modified:
    - package.json
    - package-lock.json
    - .gitignore
decisions:
  - "VitePress base set to '/' (not '/voke/') for custom domain deployment — Pitfall 7 avoided"
  - "CNAME placed in docs/public/CNAME so VitePress copies it verbatim to dist — Pitfall 8 avoided"
  - "spec/ files copied into docs/spec/v0.1/ at build time in workflow; source-of-truth spec/ never deleted"
  - "docs/spec/v0.1/ added to .gitignore — build-time copies not committed"
  - "GitHub Pages deploy uses upload-pages-artifact@v3 + deploy-pages@v4 with pages:write + id-token:write"
metrics:
  duration: "3 minutes"
  completed_date: "2026-06-13"
  tasks_completed: 2
  tasks_total: 3
  files_created: 5
  files_modified: 3
---

# Phase 05 Plan 03: VitePress Spec Site + GitHub Pages Deploy Summary

## One-liner

VitePress site at `docs/` with versioned MTQS spec, GitHub Pages deploy workflow, and CNAME for voke.sh — spec accessible at voke-sh.github.io/spec/ immediately on deploy.

## What Was Built

### Task 1: VitePress site scaffold (commit e1d2d4f)

- Installed `vitepress@1.6.4` as root devDependency
- Added `docs:dev`, `docs:build`, `docs:preview` scripts to root `package.json`
- Created `docs/.vitepress/config.ts` with `defineConfig`, `base: '/'`, MTQS title, spec sidebar with v0.1 group
- Created `docs/index.md` home page: MTQS title, determinism/open/CI-ready feature cards, link to spec
- Created `docs/spec/index.md` versions landing page: permanent v0.1 link, immutability policy
- Created `docs/public/CNAME` containing exactly `voke.sh`
- Updated `.gitignore` to exclude `docs/.vitepress/dist/` and `docs/spec/v0.1/`
- Verified: `npm run docs:build` exits 0; dist/ present; CNAME in dist; v0.1 spec HTML at `dist/spec/v0.1/MTQS-v0.1.html`

### Task 2: GitHub Pages deploy workflow (commit 2f07d8e)

- Created `.github/workflows/docs.yml`
- Triggers on `push: branches: [main], paths: ['spec/**', 'docs/**']` plus `workflow_dispatch`
- Permissions: `contents: read`, `pages: write`, `id-token: write`
- Concurrency: `group: pages`, `cancel-in-progress: false`
- Build job: checkout@v4 → setup-node@v4 (Node 22, npm cache) → `npm ci` → copy spec files into docs → `npm run docs:build` → `upload-pages-artifact@v3` (path: `docs/.vitepress/dist`)
- Deploy job: `needs: build`, environment `github-pages`, `deploy-pages@v4`

### Task 3: Enable GitHub Pages + DNS (checkpoint:human-action — PENDING)

Human must:
1. Enable GitHub Pages in repo Settings → Pages → Source: GitHub Actions
2. Trigger docs.yml (push to main touching spec/ or docs/, or workflow_dispatch)
3. Verify site at https://voke-sh.github.io/spec/
4. (When voke.sh DNS ready) Configure DNS: apex voke.sh → GitHub Pages A records

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All content is wired. The spec files are the source of truth; docs copies are build-time only.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e1d2d4f | feat(05-03): scaffold VitePress site for MTQS spec publication |
| 2 | 2f07d8e | feat(05-03): add GitHub Pages deploy workflow for VitePress spec site |

## Checkpoint Status

Stopped at Task 3 (checkpoint:human-action). The code and config deliverables are complete. Human must enable GitHub Pages in the repo settings and trigger the workflow to complete PUB-01.

## Self-Check: PASSED

- [x] `docs/.vitepress/config.ts` exists and contains `defineConfig` and `base: '/'`
- [x] `docs/public/CNAME` exists and contains `voke.sh`
- [x] `docs/spec/index.md` exists and contains `v0.1`
- [x] `.github/workflows/docs.yml` exists with all required content
- [x] `npm run docs:build` exits 0
- [x] `docs/.vitepress/dist/CNAME` present in build output
- [x] `docs/.vitepress/dist/spec/v0.1/MTQS-v0.1.html` present in build output
- [x] Commit e1d2d4f exists
- [x] Commit 2f07d8e exists
