# Requirements: Voke — v0.2 Doctor Badge (L1.1)

**Defined:** 2026-06-16
**Core Value:** `voke lint <server>` produces deterministic per-rule findings + a stable score against an explicit published ruleset — same input always yields same output.

> v0.1 (MTQS + Reference Linter) requirements are shipped/validated; tracked in `PROJECT.md` → Requirements → Validated, archived under `.planning/milestones/`.

## v0.2 Requirements

Static, self-contained MTQS score badge for GitHub READMEs — generated at lint time, zero Voke backend, zero on-call. Marketing artifact that lives in other people's repos and drives discovery, ahead of L2.

### Badge

- [x] **BADGE-01**: User can run `voke lint <server> --badge <path>` to write an SVG badge file from the lint run
- [x] **BADGE-02**: Badge SVG is fully self-contained — inline styles, no external font/CDN/script/network reference — so it renders offline and survives GitHub's Camo image proxy
- [x] **BADGE-03**: Badge shows MTQS grade + score (e.g. `MTQS · A 92`)
- [x] **BADGE-04**: Badge fill color reflects server tier across a fixed A→F ramp (A green → F red)
- [x] **BADGE-05**: Color thresholds derive from the existing scorer tier boundaries — single source of truth, no second threshold table
- [x] **BADGE-06**: Re-running on the same snapshot yields byte-identical SVG (L1 determinism wedge holds in the badge)
- [x] **BADGE-07**: After writing, the CLI prints a copy-paste markdown snippet (`![MTQS](badge.svg)`) to **stderr** (D-06 — keeps `--format` stdout clean and pipeable)
- [x] **BADGE-08**: `--badge` is a side output — does not alter `--format` stdout, the `--min-score` gate, or exit codes; only a clear usage error if the path cannot be written

## Future Requirements

Acknowledged, deferred — not in this milestone.

### Doctor Report

- **REPORT-01**: `voke lint <server> --report <path>.html` writes a self-contained static HTML diagnosis report (parked spec: `.planning/specs/2026-06-14-mcp-doctor-html-report-design.md`)

### Hosted / Online (later milestone, gated on relaxing the no-on-call constraint)

- **HOST-01**: Online "paste a URL and score it" experience
- **HOST-02**: Live/dynamic badge re-scored by Voke on a schedule

## Out of Scope

Explicitly excluded for v0.2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Hosted/online linting | Violates no-on-call constraint; SSRF surface; secrets-on-server liability |
| Interactive web app | Same; deferred to a later milestone if constraint is relaxed |
| Dynamic/live-rescored badge | Needs backend + scheduler running on its own clock = on-call obligation |
| shields.io endpoint JSON | Adds render-time third-party dependency + user must host JSON; self-contained SVG is deterministic and dependency-free |
| `--report` HTML in this milestone | Bigger surface with its own spec; shipped separately to keep L1.1 small |
| Light theme / multiple badge styles | YAGNI for v1 badge |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BADGE-01 | Phase 7 | Complete |
| BADGE-02 | Phase 7 | Complete |
| BADGE-03 | Phase 7 | Complete |
| BADGE-04 | Phase 7 | Complete |
| BADGE-05 | Phase 7 | Complete |
| BADGE-06 | Phase 7 | Complete |
| BADGE-07 | Phase 7 | Complete |
| BADGE-08 | Phase 7 | Complete |

**Coverage:**
- v0.2 requirements: 8 total
- Mapped to phases: 8 (Phase 7)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-16*
*Last updated: 2026-06-16 — traceability populated after roadmap creation*
