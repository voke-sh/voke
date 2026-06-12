---
phase: quick-260612-rm8
plan: "01"
subsystem: spec
tags: [spec, scoring, readability, structure]
dependency_graph:
  requires: []
  provides: [DOC-MTQS-S4]
  affects: [spec/MTQS-v0.1.md]
tech_stack:
  added: []
  patterns: []
key_files:
  modified:
    - spec/MTQS-v0.1.md
decisions:
  - "§4.0 placed immediately under ## 4 heading so the formula is the first thing a reader sees"
  - "§4.4 renamed from 'Integer-First Arithmetic' to 'Determinism Rules (Rounding and Evaluation Order)' to signal both concepts"
  - "#### subheads used (not #####) to stay within existing heading depth"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-12"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 260612-rm8: Restructure §4 Scoring Formula Section Summary

**One-liner:** Added §4.0 formula-first overview with pseudocode and variable table, plain-English leads to §4.3/§4.4, and split §4.4 into Rounding and Evaluation Order subheads — prose and structure only, no numbers changed.

## What Was Done

Applied four structural edits to `spec/MTQS-v0.1.md` §4 Scoring Formula, prose and structure only:

1. **§4.0 The Formula** — inserted immediately after `## 4. Scoring Formula`. Contains:
   - Pseudocode for `penalty(finding)`, `rawScore`, `toolScore`, and `serverScore`
   - Variable table mapping each formula term to its detail subsection (§4.1–§4.6)
   - "In plain terms" paragraph giving a natural-language walk-through

2. **§4.3 plain-English lead** — one sentence inserted before the existing technical paragraph: "Some flaws are fatal, not merely costly. A hard cap sets the highest grade a tool can earn regardless of its point total, because a tool that agents cannot call must never score as 'good.'"

3. **§4.4 renamed** — `### 4.4 Integer-First Arithmetic` became `### 4.4 Determinism Rules (Rounding and Evaluation Order)`, with a plain-English lead sentence before the existing technical paragraph.

4. **§4.4 subheads** — `#### Rounding` inserted before the existing numbered list (items 1–5) and "Why this matters" paragraph; `#### Evaluation Order` inserted before the existing "Fixed evaluation order" bold line and its numbered list.

## Verification Results

| Check | Result |
|-------|--------|
| Em dashes (`grep -c "—"`) | 0 |
| Rule ID count (`grep -oE 'MTQS-[A-Z][0-9]+'`) | 22 |
| Worked-example math (62, 38, 69, 100) | Unchanged (only heading removed in diff) |
| `npx vitest run tests/spec/doc-registry-sync.test.ts` | PASSED (2/2 tests) |

## Commits

| Commit | Description |
|--------|-------------|
| ff1f9a0 | docs(quick-260612-rm8): restructure §4 scoring formula for readability |

## Deviations from Plan

None. Plan executed exactly as written.

## Self-Check

- [x] `spec/MTQS-v0.1.md` modified and committed
- [x] Commit ff1f9a0 exists in git log
- [x] All four verification checks pass
- [x] §4.0 present with formula, variable table, and "In plain terms" paragraph
- [x] §4.3 opens with plain-English lead sentence
- [x] §4.4 renamed and opens with plain-English lead sentence
- [x] §4.4 contains `#### Rounding` and `#### Evaluation Order` subheads
- [x] Worked examples and §4.5, §4.6 byte-identical

## Self-Check: PASSED
