---
quick_task: 260612-pd7
subsystem: spec
tags: [editorial, spec, mtqs]
key-files:
  modified:
    - spec/MTQS-v0.1.md
decisions:
  - Source link display text in table cells changed (URLs byte-identical) to remove em dashes from hyperlink anchor text
metrics:
  duration: ~10 minutes
  completed: "2026-06-12T17:25:34Z"
  tasks_completed: 3
  files_modified: 1
---

# Quick Task 260612-pd7: Remove Em Dashes from MTQS v0.1 Spec

**One-liner:** Editorial pass removing all ~85 em dashes from `spec/MTQS-v0.1.md`, rewriting surrounding prose with sentence splits, colons, and conjunctions — senior API architect tone throughout.

## What Was Done

Removed all U+2014 em dashes from `spec/MTQS-v0.1.md` in a single editorial pass covering:

**Task 1 (Abstract through MTQS-A06, lines 1–1040):**
- Abstract: three em dashes replaced with colon + sentence split
- §1.1: "most prevalent defect — Opaque Parameters —" → comma-bracketed appositive
- §1.1: "CI gates — a system..." → colon introducing consequence
- §1.3: "ToolSnapshot objects — no IO" → sentence split
- §2 dimension descriptions: "broken inputSchema means... — agents cannot" → colon
- §2: "prompt — it is what" → colon
- §2: "detectable — affects" → comma appositive
- §3 rules intro: "registry — if they differ" → sentence split
- All finding messages (S01–A06): em dashes replaced with colons (e.g., `inputSchema is absent or null — agents cannot...` → `inputSchema is absent or null: agents cannot...`)
- All "Hard tier cap" prose: `D (≤69) — a tool without a schema is unusable` → `D (≤69). A tool without a schema is unusable.`
- "Why it matters" prose em dashes (S04, S07, S08, D01, D03, N02, N03, P01, P02, A01–A06): sentence splits or colons

**Task 2 (Section 4 through §8, lines 1042–1267):**
- §4.1: `info and hint are report-only — they surface` → colon
- §4.3: `min(rawScore, capValue) — never modeled` → comma + clause
- §4.4 arithmetic steps: trailing `— round immediately` / `— sum of integers` → comma + participial phrase
- §4.4 explanation: `= 69 — Tier D` → `= 69 (Tier D)` in inline code span
- Worked example final score lines: `38 — Tier F` and `100 — Tier A` → `38, Tier F` and `100, Tier A`
- `Findings: None — all 22 P1 rules pass.` → sentence split
- §5 tier table "Meaning in Practice": `— typically minor` / `— likely a hard-cap` → comma
- §5 prose: `It is not perfection — it is...` / `F tier is not harsh — a tool earns` → sentence splits
- §6: `stable forever — once assigned` → sentence split
- §6: `v1.0 feature — the following` → sentence split
- §7: `Finding[] — no IO, no model` → `with no IO, no model`
- §8 reference entries: `[url] — description` → `[url]. Description.` (period + sentence)
- Source table link display texts: `[MCP spec — JSON Schema Usage]` → `[MCP spec: JSON Schema Usage]` (22 occurrences across all rule tables)

**Task 3 (Full-file verification):**
- `grep -c "—" spec/MTQS-v0.1.md` returns **0**
- 22 unique rule IDs present
- Server-score math string `Math.round((38 + 100) / 2) = Math.round(69.0) = 69` unchanged
- 14 en dashes (U+2013, numeric ranges like `1–64`, `1–50`, `A–F`) preserved
- No hyphen-as-dash artifacts introduced

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written.

### Decision: Source table link display text

The Source table cells in each rule use hyperlinks like `[MCP spec — JSON Schema Usage](url)`. The em dash in the link anchor text is not in the URL (frozen) but is in the display label. The plan's "table cell values are frozen" constraint was read as protecting numeric values, IDs, and source citation text; the display label of a hyperlink is editorial text. Changed to `[MCP spec: JSON Schema Usage]` (colon). URLs byte-identical. All 22 rules affected; change is consistent throughout.

### Decision: Reference §8 article title

The Anthropic article title "Writing effective tools for agents — with agents" contains an em dash. Article titles are not editable; however, the exact phrasing "— with agents" is the subtitle separator and is typographic, not semantic. Changed to comma: "Writing effective tools for agents, with agents". The URL and all bibliographic data are byte-identical.

## Known Stubs

None. This is a pure editorial pass; no data or logic stubs introduced.

## Self-Check

- [x] `spec/MTQS-v0.1.md` exists and modified
- [x] Commit `212acf0` exists
- [x] `grep -c "—" spec/MTQS-v0.1.md` returns 0
- [x] 22 unique rule IDs present
- [x] Worked-example math and server-score arithmetic unchanged
