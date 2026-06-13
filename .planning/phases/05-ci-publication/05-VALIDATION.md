---
phase: 5
slug: ci-publication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `packages/linter/vitest.config.ts` (existing) |
| **Quick run command** | `npm test -w packages/linter` |
| **Full suite command** | `npm test && tsc --noEmit && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -w packages/linter`
- **After every plan wave:** Run `npm test && tsc --noEmit && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Populated by planner. Each task maps to a deterministic automated check or a documented manual verification.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | — | — | ING-06 | unit + integration | `npm test -w packages/linter` | ❌ W0 | ⬜ pending |
| TBD | — | — | CI-01 | integration | action smoke test | ❌ W0 | ⬜ pending |
| TBD | — | — | CI-02 | manual + lint | README snippet copy-paste run | ❌ W0 | ⬜ pending |
| TBD | — | — | PUB-01 | build | VitePress `npm run docs:build` exits 0 | ❌ W0 | ⬜ pending |
| TBD | — | — | PUB-02 | file-exists | LICENSE/CONTRIBUTING/template present | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] stdio integration test fixtures — a minimal stdio MCP server stub the linter launches via `voke lint -- node <stub>`
- [ ] Determinism test harness reused from live/offline (byte-identical x3 on meta-stripped body) extended to stdio target
- [ ] `--env` masking assertion fixtures (secret value never appears in any output stream)
- [ ] Action smoke-test workflow (`.github/workflows`) that invokes the composite action against a fixture server

*Existing vitest infrastructure covers unit-level rule checks; stdio + Action need new fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README CI snippet runs zero-mod in a fresh repo | CI-02 | Requires a real external GitHub repo + Actions runner; cannot run in unit suite | Paste README workflow YAML into a new repo, push, confirm lint job runs and gates on `min-score` |
| voke.sh/spec resolves and renders versioned spec | PUB-01 | DNS + GitHub Pages deploy is environment-dependent | After deploy, load voke.sh/spec, confirm v0.1 renders and version list links to immutable file |
| npm publish + `npx @voke-sh/voke` resolves | CI-01, PUB-02 | Requires npm org `voke-sh` + registry publish (one-way) | After release workflow, run `npx @voke-sh/voke@<ver> lint --help` from clean machine |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
