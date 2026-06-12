# Phase 4: Scoring + Output + CLI - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing pipeline (ingest → run 22 rules → score → report) into a working
`voke lint <url-or-file>` CLI. Deliver: human-readable output, JSON output, a raw-surface
snapshot writer, an exit-code gate (`--min-score`), a version string (voke + MTQS), and
bearer-token masking. First live run is the 229-tool Apideck hosted server.

Scoring math, the rule engine, ingestion (live HTTP + offline file), and the report
builder already exist from Phases 1–3. This phase is **wiring + the CLI/output surface**,
not new engine work.

Out of scope (placed in later layers): stdio transport, GitHub Action wrapper, true
changed-tools-only delta linting.

</domain>

<decisions>
## Implementation Decisions

### Human-readable output (OUT-01)
- **D-01:** Default view = **summary + failing-tool table**. Server score+tier banner,
  per-dimension weight breakdown, then a table of ONLY tools scoring below tier A
  (toolId, score, tier, finding-count), sorted by score ascending.
- **D-02:** Full per-finding detail (message, location, fixHint) is behind `--verbose`.
  Rationale: 229 tools makes "print every finding" a wall of text on first run.
- **D-03:** Severity colors via chalk; disabled under `--ci` or `NO_COLOR`. The score line
  itself is NEVER colored (Determinism Risk Register — ANSI codes must not pollute grep/diff).

### CLI surface & flags (CLI-01/02/03, SCORE-02)
- **D-04:** `voke lint <target>` **autodetects transport by scheme**: `/^https?:\/\//` → live
  ingest (`ingestLive`); anything else → offline file (`readSnapshot`).
- **D-05:** Target resolution must be **extensible scheme-dispatch**, NOT a hard two-way
  http/file fork. A third transport (stdio, Phase 5) must drop in without rewriting the
  resolver.
- **D-06:** Scheme is **required** for live targets. `voke lint localhost:3000/mcp` (no
  scheme) errors with a hint (`did you mean http://localhost:3000/mcp?`) rather than guessing.
- **D-07:** Flags: `--output human|json` (default `human`), `-H/--header "K: V"` (repeatable,
  mirrors `ingestLive` rawHeaders[]), `--timeout <ms>` (default 30000), `--min-score <n>`,
  `--ci` / `--no-color`, `--save-snapshot <path>`.
- **D-08:** Bare `voke --version` prints the voke version AND the MTQS version the linter
  implements (SCORE-02).
- **D-09:** CLI framework = commander v15 (locked in CLAUDE.md stack). Linter package gains
  a `bin` entrypoint + a tsup CLI build target.

### Two-artifact model (OUT-02, snapshot)
- **D-10:** `--output json` emits a **LintReport** (scored: per-tool/server score+tier+findings)
  via `buildReport`. This is consumption/diff output.
- **D-11:** `--save-snapshot <path>` writes a **VokeSnapshot** (raw tool surface) via
  `writeSnapshot`. This is the **offline re-lint input** that gets committed for CI.
- **D-12:** These are DIFFERENT files. `readSnapshot` reads a VokeSnapshot, NOT a LintReport.
  OUT-02's "usable as a saved snapshot" wording is loose — the LintReport is output, the
  VokeSnapshot is re-lint input. Document both explicitly so Phase 5 (README + Action) does
  not confuse them.

### Exit codes (CLI-02)
- **D-13:** Exit map (extends the ingestion codes already thrown in Phase 2):
  - `0` = pass, or no `--min-score` set (findings alone never non-zero the build)
  - `1` = score below `--min-score` threshold (the quality gate)
  - `2` = connection failed *(locked — ConnectError, ingestion)*
  - `3` = usage / bad argument
  - `4` = partial tools/list page *(locked — PartialPageError, ingestion)*
  - `6` = schema depth exceeded *(locked — DepthExceededError, ingestion)*
  - `70` = unexpected internal error
- **D-14:** Reject collapsing to 0/1/2 — keep the existing 4/6 granularity so CI can tell
  "low quality" (1) from "unreachable" (2) from "bad YAML" (3).

### Token masking (CLI-03, SC#5)
- **D-15:** Reuse existing `maskHeaders` → full-value `[MASKED]` (no partial reveal; no
  token-length leak; deterministic).
- **D-16:** Apply masking to any echoed config/header line AND all error messages. The JSON
  LintReport already omits header values (D-09 ingestion), so nothing to strip there.

### Claude's Discretion
- Exact table column widths, truncation of long toolIds, banner styling.
- `--verbose` finding layout (grouping under each tool).
- Internal module layout of the CLI (arg parse → resolve → ingest → run → format).
- Whether `--save-snapshot` and `--output json` can be combined in one invocation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scoring + tiers (SCORE-01)
- `spec/MTQS-v0.1.md` §4 — scoring formula (per-dimension weights, integer-first arithmetic,
  A–F tier cuts, hard tier caps). Already implemented in `@voke/core`; do not reimplement.
- `spec/mtqs-v0.1.yaml` — machine-readable rule registry (id, severity, dimension); source
  of truth for rule metadata in findings.

### L1 scope boundary
- `spec/SCOPE.md` — confirms L1 boundary: no LLM-in-loop, no gateway/proxy, no L2 delta.
  Use to reject scope creep (stdio, delta linting, GH Action all belong elsewhere).

### Existing pipeline (read before wiring)
- `packages/core/src/scoring.ts` — `scoreTool`, `applyCaps`, `tierFor`, `serverScore`.
- `packages/linter/src/report/builder.ts` — `buildReport` (LintReport), `serializeReportBody`
  (the meta-stripped body the byte-identical x3 determinism test compares — output must keep
  passing this end-to-end, SC#2).
- `packages/linter/src/report/types.ts` — `LintReport`, `ToolReport`, `Tier` shapes.
- `packages/linter/src/ingestion/mcp-client.ts` — `ingestLive(opts)`, `maskHeaders`,
  `buildHeaders`; exit codes 2/4/6 are thrown here.
- `packages/linter/src/ingestion/snapshot-reader.ts` / `snapshot-writer.ts` — `readSnapshot`
  (VokeSnapshot in), `writeSnapshot` (VokeSnapshot out, for `--save-snapshot`).
- `packages/linter/src/engine/runner.ts` + `registry.ts` — `runRules`, `createDefaultRegistry`,
  `allRules`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **@voke/core scoring** — SCORE-01 is pure wiring; all math (`scoreTool/applyCaps/tierFor/serverScore`) is done and frozen.
- **buildReport + serializeReportBody** — OUT-02 ≈ `JSON.stringify(buildReport(...))`; the determinism body is already isolated from wall-clock.
- **ingestLive / readSnapshot / writeSnapshot** — both transports + the snapshot writer exist; CLI just dispatches to them.
- **maskHeaders / buildHeaders** — masking primitive ready; CLI wires it into config echo + errors.
- **runRules / createDefaultRegistry / allRules** — all 22 rules register; runner is pure.

### Established Patterns
- **Exit codes are thrown as typed errors from ingestion** (ConnectError=2, PartialPageError=4, DepthExceededError=6). The CLI top-level catch maps thrown errors → `process.exit(code)`; add 1/3/70 at the CLI layer.
- **Determinism**: tools sorted by toolId; `canonicalJson` for byte-stable serialization; `meta` (wall-clock) stripped from the compared body. End-to-end output must stay byte-identical x3 (SC#2) — the human formatter must not inject timestamps/colors into the determinism-relevant path.

### Integration Points
- **New `bin` entrypoint** in `packages/linter` (commander program) + a tsup CLI build target + `bin` field in package.json.
- **Pipeline wiring**: `resolveTarget(scheme-dispatch)` → `ingest(live|file)` → `runRules(createDefaultRegistry())` → `buildReport` → `format(human|json)` → exit-code map.
- **commander v15** must be added as a runtime dep (CLAUDE.md stack-approved).

</code_context>

<specifics>
## Specific Ideas

- Reference server for the live run: `https://mcp.apideck.dev/mcp` (229 tools). It ships both
  hosted HTTP and a stdio entrypoint (`npx -y @apideck/mcp start`) — confirms the stdio dev/CI
  case is real, just deferred.
- CI mental model the user cares about: cheapest = committed VokeSnapshot linted offline
  (no creds, no network, hermetic); best-DX-for-authors = lint the artifact you ship.
- README must double as the demo (`voke lint <url>` one-liner) — autodetect (D-04) protects this.

</specifics>

<deferred>
## Deferred Ideas

- **stdio transport** (`voke lint -- npx pkg start`) → **Phase 5**. Serves BOTH hermetic CI
  and the local dev loop for stdio-only servers (the majority). Confirmed real via apideck/mcp.
  Held out of Phase 4 to protect the first-demoable-artifact milestone and avoid scope blowup
  (the #1 abandonment risk). Phase 4's extensible target resolver (D-05) leaves the door open.
  **→ Add as explicit Phase 5 scope when the roadmap is next touched.**
- **`--baseline <snapshot>` score comparison** (branch-vs-main regression gate) → Phase 5
  candidate. Gives the dev-loop "did my change make quality worse?" using only L1 primitives
  (`--min-score` already covers the server-level regression gate).
- **Scheduled freshness/drift job** (re-ingest live, fail on snapshot diff) → Phase 5,
  scheduled + non-PR-blocking so it honors the "no on-call / nothing paging" constraint.
- **True changed-tools-only delta linting** → **L2** (out of L1 entirely). Data model is
  already L2-ready (per-tool `contentHash`), but per-tool delta gating is a later layer.
- **URL query-string token masking** → deferred. CLI-03 covers `--header` tokens; tokens
  embedded in the URL are not masked in v0.1 (note for a later hardening pass).

### Note on the dev-workflow gap (resolved, not deferred)
Linting an in-dev server **over HTTP localhost** (`voke lint http://localhost:3000/mcp`)
already works in Phase 4 via the autodetect path — no new code. The only dev-loop gap is
stdio-only servers (→ Phase 5) and changed-tools-only granularity (→ L2).

</deferred>

---

*Phase: 04-scoring-output-cli*
*Context gathered: 2026-06-12*
