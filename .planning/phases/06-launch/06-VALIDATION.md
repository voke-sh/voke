---
phase: 6
slug: launch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 |
| **Config file** | `vitest.config.ts` (include: `tests/**/*.test.ts`, environment: node) |
| **Quick run command** | `npx vitest run tests/launch/` |
| **Full suite command** | `npm test` (currently 35 files / 617 tests, all green) |
| **Estimated runtime** | ~quick <5s, full ~30s |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/launch/`
- **After every plan wave:** Run `npm test` (full 617-test suite must stay green — new fixtures must not break existing tests)
- **Before `/gsd:verify-work`:** Full suite green + manual npx verification + blog live
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-W0-01 | 01 | 0 | PUB-04 | unit | `npx vitest run tests/launch/launch-determinism.test.ts` | ❌ W0 | ⬜ pending |
| 6-01 | 01 | 1 | PUB-04 | unit (library) | `npx vitest run tests/launch/launch-determinism.test.ts` (Apideck fixture byte-identical x3) | ❌ W0 | ⬜ pending |
| 6-02 | 01 | 1 | PUB-04 | unit (library) | `npx vitest run tests/launch/launch-determinism.test.ts` (DeepWiki fixture byte-identical x3 + valid score) | ❌ W0 | ⬜ pending |
| 6-03 | 01 | 1 | PUB-04 | e2e (binary, optional) | clone `tests/cli/e2e-determinism.test.ts` for live fixtures | ❌ W0 (optional) | ⬜ pending |
| 6-04 | 02 | 2 | PUB-04 | manual-only | `npx -y @voke-sh/voke@0.1.0 lint https://mcp.apideck.dev/mcp --ci` (requires npm published) | manual | ⬜ pending |
| 6-05 | 03 | 3 | PUB-03 | manual-only | human review against D-05 narrative + `stop-slop` score ≥35/50 | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/launch/launch-determinism.test.ts` — covers PUB-04 (byte-identical x3 for both live fixtures); clone `tests/engine/determinism.test.ts`
- [ ] `tests/fixtures/apideck-live-snapshot.json` — captured via `--save-snapshot` from the live 4-tool surface
- [ ] `tests/fixtures/deepwiki-snapshot.json` — captured via `--save-snapshot` from the live 3-tool surface
- [ ] (optional) extend `tests/cli/e2e-determinism.test.ts` or add a sibling that runs the BUILT binary x3 on the live fixtures
- Framework install: none — vitest already configured and passing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npx @voke-sh/voke@0.1.0 lint <url>` runs green end-to-end | PUB-04 | npx-from-npm requires the package live on the public registry — cannot be a CI unit test without publishing first | Run `npx -y @voke-sh/voke@0.1.0 lint https://mcp.apideck.dev/mcp --ci`; confirm score + tier, exit 0 |
| Blog post published telling the MTQS story | PUB-03 | Blog quality is editorial | Human review against D-05 narrative; `stop-slop` score ≥35/50; live URL reachable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
