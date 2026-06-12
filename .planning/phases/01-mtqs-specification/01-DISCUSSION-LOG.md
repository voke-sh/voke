# Phase 1: MTQS Specification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 1-mtqs-specification
**Areas discussed:** Scoring model, Tiers & strictness, Dimension weights, Spec doc shape + registry format

---

## Scoring model

| Option | Description | Selected |
|--------|-------------|----------|
| Weighted deduction | Start 100, subtract per finding by severity; every point traces to a rule | ✓ |
| Per-dimension normalized mean | Each dimension 0–100 by % rules passed, then weighted mean | |
| Pass-ratio weighted | Weighted % of applicable rules passed | |

| Option | Description | Selected |
|--------|-------------|----------|
| Report-only (info/hint) | info/hint never move the score | ✓ |
| Tiny deduction | info/hint deduct a small amount | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, hard caps | Critical errors cap the tier regardless of score | ✓ |
| No, pure score | Tier = number only | |

**User's choice:** Weighted deduction + report-only + hard caps (all recommended).
**Notes:** User requested all options carry a marked recommendation; chose the coherent recommended system.

---

## Tiers & strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Calibrated strict | Good→B/A, typical→C/D, broken→F | ✓ |
| Lenient | Most servers pass B+ | |
| Brutal | Almost nothing scores A | |

| Option | Description | Selected |
|--------|-------------|----------|
| Standard 90/80/70/60 | School-grade cuts | ✓ |
| Shifted strict | A≥95, B≥85… | |
| Decide after fixture run | Set boundaries empirically in Phase 4 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Mean + worst-offenders list | Server = mean of tools, surface lowest | ✓ |
| Weighted by surface | Larger tools weigh more | |
| Min (worst tool wins) | Server scored by worst tool | |

**User's choice:** Calibrated strict + standard 90/80/70/60 + mean & worst-offenders (all recommended).
**Notes:** Calibrate via weights/penalties under fixed cuts, not by moving cuts.

---

## Dimension weights

| Option | Description | Selected |
|--------|-------------|----------|
| Weighted by importance | Dimension multiplier on penalties | ✓ |
| Equal | Same penalty per severity across dimensions | |

| Option | Description | Selected |
|--------|-------------|----------|
| Correctness + Behavior first | T1 Schema + Annotation, T2 Description + Parameter, T3 Naming | ✓ |
| Agent-usability first | Lead with Description + Parameter | |
| Decide in spec drafting | Lock principle, pin multipliers while writing | |

**User's choice:** Weighted by importance + Correctness/Behavior first (all recommended).
**Notes:** Exact multipliers pinned during drafting with sources open.

---

## Spec doc shape + registry format

| Option | Description | Selected |
|--------|-------------|----------|
| YAML | Human-editable, PR-friendly, language-agnostic SoT | ✓ |
| JSON | Universal, noisier to edit | |
| TypeScript const | Type-safe, couples standard to one language | |

| Option | Description | Selected |
|--------|-------------|----------|
| Standard-style, per-rule anchors | Thesis→dimensions→per-rule rubric→formula→versioning | ✓ |
| Narrative guide | Reads like a long blog post | |
| Reference table only | Terse spec table | |

| Option | Description | Selected |
|--------|-------------|----------|
| Authoritative + rationale | RFC/WCAG authority + why + source + example per rule | ✓ |
| Pure normative | Terse MUST/SHOULD only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Semver, additive minors | v0.1; stable IDs; minor=add rules; major=change severities/weights | ✓ |
| Date-versioned | Like MCP spec (2026-07-28) | |

**User's choice:** YAML + standard-style per-rule anchors + authoritative-with-rationale + semver (all recommended).

## Claude's Discretion

- Exact penalty point values, dimension multipliers, hard-cap rules + levels, worked example, YAML field schema, doc section ordering — all pinned during drafting.

## Deferred Ideas

- 16 P2 rules (v0.2); Output + Surface-coherence dimensions carry zero v0.1 weight.
- SARIF formatter (v2).
- Empirical tier re-tuning after Apideck fixture run (possible Phase 4 follow-up).
