---
phase: 1
slug: mtqs-specification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 1 is an authoring phase — deliverables are the spec document, the YAML rule
> registry, and SCOPE.md. Validation checks **consistency + defensibility**, not runtime behavior.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (registry parse + doc/registry consistency checks) + a YAML schema (Zod) validator |
| **Config file** | none — Wave 0 scaffolds `package.json`, `vitest.config.ts`, `tsconfig.json` |
| **Quick run command** | `npx vitest run spec/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run spec/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite green + manual spec read-through
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | infra | scaffold | `npx vitest run --reporter=basic` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | SPEC-04 | unit | `npx vitest run spec/registry.schema.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | SPEC-03 | unit | `npx vitest run spec/registry.rules.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | SPEC-01 | consistency | `npx vitest run spec/doc-registry-sync.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 1 | SPEC-02 | unit | `npx vitest run spec/scoring-example.test.ts` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | SPEC-05 | consistency | `npx vitest run spec/scope.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` + `vitest.config.ts` + `tsconfig.json` — minimal TS test harness (no linter code yet)
- [ ] `spec/helpers/loadRegistry.ts` — parse the YAML registry, expose typed entries
- [ ] `spec/helpers/parseSpecDoc.ts` — extract rule anchors/IDs from the spec markdown

---

## Validation Checks (what "correct" means for this phase)

| Check | Requirement | Automated Command | Asserts |
|-------|-------------|-------------------|---------|
| Registry parses against Zod schema | SPEC-04 | `vitest run spec/registry.schema.test.ts` | every entry has id, severity, dimension, scope, weight, description, fixHint, source, mtqsVersion |
| All 20 P1 rules present, IDs unique | SPEC-03 | `vitest run spec/registry.rules.test.ts` | 20 entries; IDs match `MTQS-[SDNPA]\d{2}`; severities valid |
| Every rule has a primary-source citation | SPEC-01 | `vitest run spec/registry.rules.test.ts` | `source` non-empty + non-Glama for all entries |
| Doc ↔ registry sync | SPEC-01 | `vitest run spec/doc-registry-sync.test.ts` | every registry ID has a `#MTQS-XXX` anchor in the doc and vice-versa; no orphans |
| Every rule has good/bad example in doc | SPEC-01 | `vitest run spec/doc-registry-sync.test.ts` | each rule section contains a good + bad example block |
| Worked scoring example arithmetic correct | SPEC-02 | `vitest run spec/scoring-example.test.ts` | recomputing the doc's worked example yields the stated score + tier; deterministic (integer-first) |
| SCOPE.md boundary statements present | SPEC-05 | `vitest run spec/scope.test.ts` | contains no-LLM-in-loop, no-gateway/proxy, no-L2+ assertions |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Spec reads as a defensible standard (rationale + citation legible) | SPEC-01 | Prose quality isn't grep-checkable | Read the spec doc end-to-end; confirm each rule's "why" + source is convincing and not Glama-derived |
| Calibration feels right (strict but not brutal) | SPEC-02 | Judgement call until Apideck fixture run (Phase 4) | Sanity-check the worked example tier matches intent; note for Phase 4 empirical re-tune |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (harness + helpers)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
