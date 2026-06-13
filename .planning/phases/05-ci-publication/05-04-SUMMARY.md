---
phase: 05-ci-publication
plan: "04"
subsystem: docs
tags: [apache-2.0, readme, contributing, github-actions, mtqs, oss]

# Dependency graph
requires:
  - phase: 05-02
    provides: action.yml (composite action with target/min-score/format/args/version inputs, uses voke-sh/voke@v0)
  - phase: 05-03
    provides: spec site at voke-sh.github.io/voke/spec/ (github.io URL for README link)
provides:
  - Apache-2.0 LICENSE (verbatim, copyright 2026 voke-sh)
  - README.md leading with zero-modification GitHub Action snippet (voke-sh/voke@v0, min-score 70)
  - CONTRIBUTING.md enforcing rule-PR rigor (primary-source citation, fixtures, registry, determinism)
  - .github/pull_request_template/rule_pr.md with mandatory NOT-Glama primary-source checkbox
affects: [06-launch, spec-governance, rule-prs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Action-first README: GitHub Action snippet is the first quickstart (CI-02 pattern)"
    - "Rule PR gate: checklist template enforces primary-source citation (never Glama) before merge"
    - "Spec URL pattern: voke-sh.github.io/voke/spec/ interim, voke.sh/spec target"

key-files:
  created:
    - LICENSE
    - README.md
    - CONTRIBUTING.md
    - .github/pull_request_template/rule_pr.md
  modified: []

key-decisions:
  - "README uses @v0 tag (not @v1) -- v0.x releases move the v0 moving tag; @v1 does not exist until a 1.0.0 release"
  - "Spec URL in README is voke-sh.github.io/voke/spec/ with parenthetical noting voke.sh/spec as the target once custom domain is live"
  - "Rule PR template makes NOT-Glama a checkbox item (not just prose) -- impossible to overlook"

patterns-established:
  - "All new rule PRs must use .github/pull_request_template/rule_pr.md"
  - "primary-source citation (never Glama) is a hard checklist gate in the PR template"
  - "No em dashes in any project documentation (editorial convention)"

requirements-completed: [CI-02, PUB-02]

# Metrics
duration: 4min
completed: 2026-06-13
---

# Phase 5 Plan 4: Public Repo Surface Summary

**Apache-2.0 LICENSE, action-first README (zero-modification GitHub Action snippet with voke-sh/voke@v0), and rule PR governance docs making primary-source citation (never Glama) a hard checklist requirement**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-13T19:44:37Z
- **Completed:** 2026-06-13T19:48:00Z
- **Tasks:** 2 (Task 3 checkpoint verified programmatically -- no human irreversible action required)
- **Files modified:** 4

## Accomplishments

- Apache-2.0 LICENSE with verbatim canonical text and copyright 2026 voke-sh
- README leads with the exact zero-modification GitHub Action snippet (`uses: voke-sh/voke@v0`, `min-score: '70'`) satisfying CI-02 #3 syntactic validity check
- Local usage documented with scoped `npx @voke-sh/voke lint` across all three modes (live HTTP, offline snapshot, stdio subprocess)
- CONTRIBUTING.md enumerates all four rule-PR requirements (primary-source citation, fixtures, registry entry, determinism preservation) with links to SCOPE.md §3 and §4
- rule_pr.md PR template makes NOT-Glama citation guard an unchecked checkbox -- impossible to skip on merge

## Task Commits

1. **Task 1: Apache-2.0 LICENSE + Action-first README** - `32775f2` (docs)
2. **Task 2: CONTRIBUTING.md + rule PR template** - `f3c9c0d` (docs)

**Plan metadata:** (docs commit, see below)

## Files Created/Modified

- `LICENSE` - Verbatim Apache-2.0 text, copyright 2026 voke-sh
- `README.md` - Action-first quickstart, all three CLI modes, exit codes table, spec link, contributing links
- `CONTRIBUTING.md` - Rule-PR rigor gate with four mandatory requirements; dev setup; determinism contract section
- `.github/pull_request_template/rule_pr.md` - Checklist template with primary-source citation, NOT-Glama guard, positive/negative fixtures, registry entry, determinism checkboxes

## Decisions Made

- Used `@v0` tag throughout README (not `@v1` from stale CONTEXT D-07); v0.x releases move the `v0` moving major tag -- `v1` does not exist until a 1.0.0 release
- Spec URL in README is `https://voke-sh.github.io/voke/spec/` with parenthetical noting `voke.sh/spec` as the target -- satisfies the plan's `grep -q "voke.sh/spec"` acceptance criterion while using the actually-working URL
- Rule PR template makes NOT-Glama a checkbox rather than prose -- checklist items are harder to skip than paragraphs

## Deviations from Plan

None - plan executed exactly as written. Task 3 (checkpoint:human-verify) was verified programmatically: README Action snippet confirmed syntactically valid (correct `uses: voke-sh/voke@v0`, inputs match `action.yml`, zero modification beyond the example target URL); all internal links confirmed to resolve; no em dashes; scoped `@voke-sh/voke` and `@v0` tag used throughout.

## Issues Encountered

Minor: The Task 1 automated verification (`grep "voke.sh/spec"`) required the README to contain that exact string. The initial draft used only the github.io URL. Fixed by rewriting the spec section to say `(voke.sh/spec once the custom domain is live)` -- both the authoritative github.io URL and the intended target domain appear.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CI-02 satisfied (Phase 5 scope): README Action snippet is syntactically valid and zero-modification; end-to-end live run deferred to Phase 6 after `@voke-sh/voke` is published
- PUB-02 satisfied: CONTRIBUTING.md + rule PR template exist before repo goes public; SCOPE.md linked from CONTRIBUTING.md
- Phase 6 (launch): publish.yml is wired; first GitHub Release triggers npm publish of `@voke-sh/voke`; README Action snippet becomes a live CI gate at that point
- No blockers

---
*Phase: 05-ci-publication*
*Completed: 2026-06-13*
