---
status: partial
phase: 05-ci-publication
source: [05-VERIFICATION.md]
started: "2026-06-13T19:54:50Z"
updated: "2026-06-13T19:54:50Z"
---

## Current Test

[awaiting human testing — requires repo pushed to github.com/voke-sh/voke first]

## Tests

### 1. npm org + NPM_TOKEN provisioning (CI-01)
expected: After pushing the repo, creating npm org `voke-sh`, generating a publish token scoped to `@voke-sh`, and adding it as repo secret `NPM_TOKEN`, the first GitHub Release triggers `publish.yml` and publishes `@voke-sh/voke` with provenance. Pre-publish check: `npm view @voke-sh/voke version` returns 404 (name unclaimed).
result: [pending]

### 2. GitHub Pages enable + spec site live (PUB-01)
expected: After pushing the repo and setting Settings → Pages → Source to "GitHub Actions", triggering `docs.yml` deploys the VitePress spec site. The MTQS v0.1 spec renders at https://voke-sh.github.io/voke/spec/ (base `/voke/`). Custom domain voke.sh deferred until DNS configured.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
