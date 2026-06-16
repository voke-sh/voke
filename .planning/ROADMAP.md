# Roadmap: Voke

## Milestones

- ✅ **v0.1 MTQS + Reference Linter** — Phases 1-6 (shipped 2026-06-15) → [archive](milestones/v0.1-ROADMAP.md)
- 🔄 **v0.2 Doctor Badge (L1.1)** — Phase 7 (in progress)

## Phases

<details>
<summary>✅ v0.1 MTQS + Reference Linter (Phases 1-6) — SHIPPED 2026-06-15</summary>

- [x] Phase 1: MTQS Specification (4/4 plans) — completed 2026-06-12
- [x] Phase 2: Engine + Ingestion + Determinism (4/4 plans) — completed 2026-06-12
- [x] Phase 3: Rule Implementations (5/5 plans) — completed 2026-06-13
- [x] Phase 4: Scoring + Output + CLI (3/3 plans) — completed 2026-06-13
- [x] Phase 5: CI + Publication (4/4 plans) — completed 2026-06-13
- [x] Phase 6: Launch (3/3 plans) — completed 2026-06-15 (PUB-03 blog publish deferred)

Full detail: [milestones/v0.1-ROADMAP.md](milestones/v0.1-ROADMAP.md) · Audit: [milestones/v0.1-MILESTONE-AUDIT.md](milestones/v0.1-MILESTONE-AUDIT.md)

</details>

### v0.2 Doctor Badge (L1.1)

- [x] **Phase 7: MTQS Score Badge** - Deterministic self-contained SVG badge via `voke lint --badge <path>` (completed 2026-06-16)

## Phase Details

### Phase 7: MTQS Score Badge
**Goal**: Users can generate a deterministic, self-contained MTQS score badge and embed it in any GitHub README with a single lint run
**Depends on**: Phase 6 (LintReport type, tierFor/scoreTool boundaries from @voke/core, existing --format/--output/--min-score CLI surface)
**Requirements**: BADGE-01, BADGE-02, BADGE-03, BADGE-04, BADGE-05, BADGE-06, BADGE-07, BADGE-08
**Success Criteria** (what must be TRUE):
  1. Running `voke lint <server> --badge badge.svg` writes a valid SVG file to disk — opening it in a browser or GitHub README renderer shows a colored badge with the MTQS grade and numeric score (e.g. `MTQS · A 92`)
  2. The written SVG contains no external URLs (no `href`, `src`, `url()`, CDN links, or font references) — it renders identically offline and passes GitHub's Camo image proxy sanitization
  3. Running `voke lint <server> --badge badge.svg` twice on the same snapshot produces byte-identical SVG files — `diff badge1.svg badge2.svg` exits 0
  4. The badge fill color visually matches the server tier (A = green, B = teal/light-green, C = yellow, D = orange, F = red) using thresholds sourced exclusively from the `tierFor` function in `@voke/core` — no second threshold table exists anywhere in the badge code
  5. After writing the badge, the CLI prints a markdown snippet (`![MTQS badge](badge.svg)`) to the console (stderr per D-06), while `--format`, `--min-score`, and exit codes behave identically to a run without `--badge`
**Plans**: 2 plans (2 waves)
- [x] 07-01-PLAN.md — Pure deterministic formatBadge SVG builder + unit test scaffold (BADGE-02,03,04,05,06) [wave 1]
- [x] 07-02-PLAN.md — Wire --badge side output: badge-writer + CLI threading + e2e test (BADGE-01,07,08) [wave 2]

**Research flag (resolved in plans):** GitHub's Camo proxy is a passthrough image proxy that does NOT sanitize SVG — use SVG presentation attributes (no `style=""`, no external refs). Confirmed in 07-RESEARCH.md.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. MTQS Specification | v0.1 | 4/4 | Complete | 2026-06-12 |
| 2. Engine + Ingestion + Determinism | v0.1 | 4/4 | Complete | 2026-06-12 |
| 3. Rule Implementations | v0.1 | 5/5 | Complete | 2026-06-13 |
| 4. Scoring + Output + CLI | v0.1 | 3/3 | Complete | 2026-06-13 |
| 5. CI + Publication | v0.1 | 4/4 | Complete | 2026-06-13 |
| 6. Launch | v0.1 | 3/3 | Complete | 2026-06-15 |
| 7. MTQS Score Badge | v0.2 | 2/2 | Complete   | 2026-06-16 |

---
*Last updated: 2026-06-16 — Phase 7 planned (2 plans, 2 waves)*
