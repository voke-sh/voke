# Phase 5: CI + Publication - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Make voke usable and public: (1) ingest stdio MCP servers launched as a subprocess (`voke lint -- <cmd>`) for hermetic CI + local dev; (2) ship a GitHub Action wrapper with one-line YAML config that fails the build below a score threshold; (3) publish the MTQS spec as a versioned public docs site at voke.sh/spec accepting PRs; (4) make the repo ready for external contribution (LICENSE, CONTRIBUTING, rule PR template) before going public.

Requirements: ING-06, CI-01, CI-02, PUB-01, PUB-02.

NOT in this phase: the launch blog post + live demo run (Phase 6); L2 diff; hosted service.
</domain>

<decisions>
## Implementation Decisions

### stdio ingestion (ING-06)
- **D-01:** Invocation syntax is `voke lint -- <cmd args...>` — everything after `--` is the subprocess command and its args (e.g. `voke lint -- node server.js`). Matches the roadmap success criterion; standard CLI convention; avoids shell-quoting issues. NOT a `--stdio` flag, NOT a `stdio:` scheme.
- **D-02:** Env passing: subprocess **inherits the parent environment**, plus a repeatable `--env KEY=VAL` to add/override. `--env` values are **masked in all output** (logs, errors, report) — same masking treatment as `--header` (carries D-09 from Phase 2).
- **D-03:** stdio must produce the **same canonicalized tool surface** as live/offline modes and reuse the existing pipeline. Integration seam already exists: `resolve-target.ts` `SCHEME_HANDLERS` + `TransportKind` — add a `stdio` kind. Subprocess torn down **deterministically** (no orphan process), output byte-identical x3 (carries the determinism contract D-12).
- Carry-forward from Phase 2 (apply, do not re-ask): fail-fast no-retry (D-08), abort-on-partial-page (D-10), distinct exit codes per failure class, header/token masking (D-09).

### GitHub Action (CI-01, CI-02)
- **D-04:** Packaging is a **composite `action.yml`** that runs `npx voke@<ver> lint ...` via `actions/setup-node` (Node 22). No Docker, no committed JS bundle. Fast cold start, transparent.
- **D-05:** **This requires publishing `voke` to npm** (the Action's `npx` and the README `npx voke lint` one-liner both depend on it). npm publish is in-scope for this phase.
- **D-06:** `action.yml` lives at the **root of the same `voke-sh/voke` repo** as the linter — `uses: voke-sh/voke@v1` resolves directly. One repo, one release.
- **D-07:** README/quickstart recommends **major-tag pinning** `uses: voke-sh/voke@v1` (moving tag, auto patches/minors). Mention full-SHA pinning as the security-conscious option. Action exposes a `min-score` input that drives the build-fail exit code (reuses CLI `--min-score` 0/1 gate).

### Spec publication (PUB-01)
- **D-08:** Publish as a **dedicated static docs site** built with **VitePress**, deployed to **voke.sh/spec**. (Chosen over plain GitHub Pages markdown — user wants a real docs site. Heavier than Pages: adds a static-site build pipeline; keep config minimal.)
- **D-09:** Spec lives in the **same repo** as the linter. The linter declares which MTQS version it implements; spec + reference linter version together; single PR surface. PRs to the spec are normal GitHub PRs against `spec/`.
- **D-10:** **Versioned files, keep all.** `spec/MTQS-v0.1.md` stays immutable/live; future `MTQS-v0.2.md` added alongside. voke.sh/spec lists versions; old versions remain independently citable (reproducibility/auditability ethos).

### README + repo readiness (CI-02, PUB-02)
- **D-11:** README quickstart **leads with the GitHub Action YAML snippet** (`.github/workflows` job using `voke-sh/voke@v1` + `min-score`) — this is exactly CI-02 success criterion #3 (paste into a new repo → working lint job, no modification). A local `npx voke lint <url>` one-liner follows below.
- **D-12:** **License: Apache-2.0** for both linter and spec (explicit patent + trademark terms — standard-governance signal for MTQS-as-open-standard; matches AsyncAPI/CNCF norms). Single license, not split.
- **D-13:** **CONTRIBUTING.md + rule PR template emphasize rule-PR rigor:** every new/changed rule requires a **primary-source citation (never Glama, per SCOPE.md §4)**, positive + negative fixtures, and must preserve determinism. CONTRIBUTING.md links SCOPE.md; README links CONTRIBUTING.md + the rule PR template.

### Claude's Discretion (pin during planning/research, no further user input)
- Exact subprocess teardown mechanism (signal, timeout, orphan-prevention) for deterministic stdio shutdown — must satisfy "no orphan process, byte-identical x3."
- stdio transport wiring via the MCP SDK's `StdioClientTransport`.
- Exact `action.yml` input/output schema beyond `min-score` (e.g. `target`, `format`, `args`).
- VitePress config specifics (theme, nav, version dropdown, voke.sh domain/CNAME + deploy target).
- Rule PR template field set; CONTRIBUTING.md section structure; npm package metadata (scope, bin, files, provenance).
- The exact distinct exit code assigned to stdio launch/teardown failures.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MTQS spec (subject of publication)
- `spec/MTQS-v0.1.md` — the human-readable spec to publish at voke.sh/spec; the doc the VitePress site renders and versions
- `spec/mtqs-v0.1.yaml` — machine-readable rule registry; linter declares which MTQS version it implements
- `spec/SCOPE.md` — §4 primary-source-citation rule (never Glama) that CONTRIBUTING.md must link and the rule PR template must enforce; the read-only-observer employer-conflict line

### Prior phase context (decisions to carry forward)
- `.planning/phases/02-engine-ingestion-determinism/02-CONTEXT.md` — ingestion decisions D-08 (fail-fast no-retry), D-09 (`--header` + masking), D-10 (abort-on-partial), D-11 (transport strategy; stdio explicitly deferred to here), D-12 (byte-identical x3 determinism contract)
- `.planning/phases/04-scoring-output-cli/04-02-SUMMARY.md` — CLI surface, exit-code map (D-13), tsup build, self-contained binary; `resolve-target.ts` SCHEME_HANDLERS extension seam for stdio

### Code integration points
- `packages/linter/src/cli/resolve-target.ts` — `SCHEME_HANDLERS` + `TransportKind`; documented seam for adding the stdio kind
- `packages/linter/src/ingestion/mcp-client.ts` — transport setup (StreamableHTTP + SSE); stdio transport added alongside
- `packages/linter/src/cli/program.ts` — commander program; `--` passthrough + `--env` flag wired here
- `packages/linter/package.json` + `tsup.config.ts` — npm publish metadata + bin (`voke`) for `npx voke`

No external project specs beyond the above — requirements fully captured in decisions.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolve-target.ts` `SCHEME_HANDLERS` registry + `TransportKind` union — stdio is a documented one-entry extension (`kind: 'stdio'`).
- `mcp-client.ts` paginated `fetchAllTools` + canonicalization — reused verbatim for stdio; only the transport differs.
- CLI `--min-score` 0/1 exit gate (Phase 4) — the Action's `min-score` input maps straight onto it.
- `@voke/core` canonicalization + scoring — unchanged; stdio feeds the same pipeline.
- Self-contained `dist/cli/index.js` binary (tsup bundles `@voke/core`) — the npm-published artifact.

### Established Patterns
- Header/secret masking (D-09) — extend the same masking to `--env` values.
- Fail-fast, distinct exit codes, no retry (D-08) — apply to stdio launch/teardown failures.
- Determinism contract: byte-identical x3 on meta-stripped body (D-12) — the stdio acceptance test mirrors the live/offline determinism tests.
- Composite tsc output (`dist-types`) vs tsup bundle (`dist`) separation — preserve when adding npm publish config.

### Integration Points
- New stdio transport in `mcp-client.ts`; new `stdio` kind in `resolve-target.ts`; `--` + `--env` parsing in `program.ts`.
- Root `action.yml` (new) wrapping the published npm CLI.
- `npm publish` config in `packages/linter/package.json` (bin already declared).
- New repo-surface files: `LICENSE` (Apache-2.0), `README.md`, `CONTRIBUTING.md`, rule PR template under `.github/`, VitePress docs site (new dir).
</code_context>

<specifics>
## Specific Ideas

- README's CI snippet must be **copy-paste runnable with zero modification** into a new repo (CI-02 criterion #3) — treat it as a tested artifact, not prose.
- Spec versions must be **independently citable** forever — a v0.1 link never breaks when v0.2 ships.
- Rule contributions are gated on **primary-source citations, never Glama** — this guards the determinism/originality wedge; the PR template should make it impossible to skip.
</specifics>

<deferred>
## Deferred Ideas

- Launch blog post + live Apideck demo run — **Phase 6** (already roadmapped).
- Spec-change governance process (proposal/review/versioning workflow for MTQS evolution) — beyond v0.1 launch; revisit when v0.2 is on the horizon.
- Split-licensing (Apache spec / MIT code) — considered, rejected for single Apache-2.0 simplicity.
- Second public MCP server run — Phase 6 DoD.

None of these block Phase 5.
</deferred>

---

*Phase: 05-ci-publication*
*Context gathered: 2026-06-13*
