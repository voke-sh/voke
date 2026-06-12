# Phase 4: Scoring + Output + CLI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 04-scoring-output-cli
**Areas discussed:** Human output layout, CLI surface & flags, Exit code semantics, Token masking scope, Stdio/dev-workflow scope

---

## Human output layout

| Option | Description | Selected |
|--------|-------------|----------|
| Summary + failing table | Server banner + dimension breakdown + table of sub-A tools; per-finding behind --verbose | ✓ |
| Full per-finding always | Print every finding by default; --quiet for summary | |
| Summary only | Just score+tier+counts; all detail behind --verbose | |

**User's choice:** Summary + failing table.
**Notes:** chalk colors off under --ci/NO_COLOR; score line never colored (determinism).

## CLI surface & flags

| Option | Description | Selected |
|--------|-------------|----------|
| Autodetect by scheme | http(s)→live, else→file; flags --output/--header/--timeout/--min-score/--ci | ✓ |
| Explicit --file/--url | No autodetect; user states transport | |

**User's choice:** Autodetect by scheme (recommended).
**Notes:** Added `--save-snapshot` after the two-artifact model surfaced. Require scheme for
localhost (error+hint, no guess). Target resolver must be extensible for stdio later.

## Exit code semantics

| Option | Description | Selected |
|--------|-------------|----------|
| 0/1 gate, 3 usage, 70 internal | Keeps locked 2/4/6; adds 1=below-min-score, 3=bad-arg, 70=internal | ✓ |
| Collapse to 0/1/2 | Remaps all operational errors to 2 | |

**User's choice:** 0/1 gate, 3 usage, 70 internal (recommended).
**Notes:** No --min-score → always exit 0; findings alone never fail the build.

## Token masking scope

| Option | Description | Selected |
|--------|-------------|----------|
| [MASKED] everywhere echoed | Reuse maskHeaders; full-value mask in config echo + errors | ✓ |
| Partial reveal (last 4) | Show token tail for debuggability | |

**User's choice:** [MASKED] everywhere echoed (recommended).
**Notes:** JSON LintReport already omits header values (D-09). URL query-string tokens deferred.

## Stdio / dev-workflow scope

| Option | Description | Selected |
|--------|-------------|----------|
| Hold for Phase 5 | Phase 4 = HTTP(+localhost)+file+gate; stdio is Phase 2-class transport work | ✓ |
| Pull stdio into Phase 4 | Add StdioClientTransport now; bigger phase, delays demo | |
| Phase 4.1 insertion | Ship Phase 4, then decimal phase for stdio before Phase 5 | |

**User's choice:** Hold for Phase 5 (recommended).
**Notes:** Raised as the dev-workflow gap ("lint my feature branch / changes"). Decomposed into:
(1) HTTP localhost lint — already works in Phase 4; (2) stdio lint — Phase 5; (3) changed-tools-only
delta — L2. apideck/mcp confirmed to ship both hosted HTTP and stdio (`npx -y @apideck/mcp start`).

## Claude's Discretion

- Table column widths / toolId truncation / banner styling
- --verbose finding layout
- CLI internal module layout
- Whether --save-snapshot + --output json combine in one run

## Deferred Ideas

- stdio transport → Phase 5 (CI + stdio dev loop)
- --baseline <snapshot> score comparison → Phase 5 candidate
- scheduled freshness/drift job → Phase 5 (non-blocking, honors no-on-call)
- true changed-tools-only delta linting → L2
- URL query-string token masking → later hardening pass
