# Phase 6: Launch - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Execute the L1 launch. Two deliverables: (1) a published launch blog post telling the
"no open standard for MCP tool quality — here is one" story, and (2) a validated, reproducible
`voke lint` run against the live Apideck MCP server (4-tool proxy surface) plus at least one
other public MCP server. Requirements: PUB-03, PUB-04.

No new rules, no L2/diff, no hosted infra, no new transports. Launch executes what Phases 1–5
already shipped.

</domain>

<decisions>
## Implementation Decisions

### Second server (proof point)
- **D-01:** Second public server is **DeepWiki MCP** (`https://mcp.deepwiki.com/mcp`) — public, no auth, stable small surface. Linted via live streamable-HTTP, same path as Apideck.
- **D-02:** Both Apideck and DeepWiki get a **committed snapshot fixture**. The live HTTP runs are for the blog (screenshots / real numbers); the committed snapshots are the reproducible gate. This decouples the DoD from launch-day server availability — a server being down or its surface changing cannot break byte-identical reproducibility.
- **D-03:** If a live server is unreachable or its surface shifts at launch time, the committed snapshot still satisfies the reproducibility claim; re-snapshot deliberately if the surface legitimately changed.

### Blog: venue + narrative
- **D-04:** Venue is **dev.to** (markdown-native, dev audience, canonical-URL control). NOT the Apideck engineering blog (keeps the OSS/personal project clear of the employer-conflict boundary). voke.sh/blog explicitly deferred — does not block this phase on DNS.
- **D-05:** Narrative shape: **Problem → why deterministic beats LLM-judge → MTQS in 22 rules → live proof (Apideck 62/D + DeepWiki) → try-it CTA (npx + Action snippet)**. The honest D-tier Apideck score is the hook.
- **D-06:** Run the **`stop-slop` skill** on the draft before publishing to remove AI writing tells.

### What the demo proves (reproducibility)
- **D-07:** Commit Apideck + DeepWiki snapshots and a **byte-identical x3 determinism test** that gates both surfaces (satisfies DoD criterion 1). Mirrors the existing `tests/engine/determinism.test.ts` pattern.
- **D-08:** Publish **real scores verbatim** in the post (Apideck 62/100 Tier D, DeepWiki actual). Honesty is the wedge vs Glama — neutrality, including the employer's own server scoring poorly, is the credibility argument.
- **D-09:** Show the **SHA-256 `contentHash` / canonical-JSON byte equality** in the post as the determinism receipt — makes the mechanism visible, not just asserted. Data already carries contentHash; this is a presentation choice, no new code.

### npm release mechanics
- **D-10:** First publish is **`@voke-sh/voke@0.1.0`** (matches MTQS v0.1), via the existing `publish.yml` (npm publish + OIDC provenance + move the `v0` moving tag).
- **D-11:** **Publish + verify, then blog.** Order: tag v0.1.0 → release → `publish.yml` runs → verify `npx -y @voke-sh/voke@0.1.0 lint ...` works end-to-end → only then publish the blog. A dead npx command in the launch-day CTA kills trust.

### Claude's Discretion
- Exact blog length, section headings, code-block formatting (within the D-05 shape).
- Snapshot capture mechanics (how/when fixtures are generated and committed).
- Whether to include the Action-snippet vs npx-snippet (or both) in the CTA.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

ROADMAP.md lists no per-phase `Canonical refs:` for Phase 6. The following are the
governing in-repo artifacts for launch.

### Launch requirements + DoD
- `.planning/ROADMAP.md` §"Phase 6: Launch" — goal, 3 success criteria (byte-identical x3 with committed fixture; second public server scores; blog live)
- `.planning/REQUIREMENTS.md` — PUB-03 (blog story), PUB-04 (live Apideck + ≥1 other, green + reproducible = launch DoD)

### Story / positioning source material
- `.planning/PROJECT.md` §Context — strategic bet (open spec, ESLint/WCAG model), competitor framing (Glama closed LLM-judge), rule sources, reputational ROI
- `spec/MTQS-v0.1.md` — the spec being launched; §4 scoring formula + §4.4 worked example for the "22 rules" narrative section
- `spec/SCOPE.md` — L1 boundary (no LLM-in-loop, no gateway/proxy) — keeps blog claims inside scope

### Demo + release mechanics (existing, reuse — do not rebuild)
- `README.md` — Action quickstart + npx usage; the CTA copy must match what actually ships
- `action.yml` — composite Action contract referenced in the CTA
- `tests/engine/determinism.test.ts` — pattern to mirror for the launch determinism test (D-07)
- `tests/fixtures/apideck-snapshot.json` — existing Apideck fixture; DeepWiki snapshot is the new sibling
- `.github/workflows/publish.yml` — npm publish + OIDC provenance + v0 tag move (D-10/D-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/engine/determinism.test.ts` — byte-identical x3 + shuffle-invariant proof; clone its shape for the launch fixtures (D-07).
- `tests/fixtures/apideck-snapshot.json` — committed Apideck surface; DeepWiki snapshot follows the same offline-snapshot format the ingestion layer already reads (ING-03).
- `publish.yml` / `ci.yml` / `action.yml` — release + CI + Action wrappers all shipped in Phase 5; launch reuses them, no new pipeline code.
- Self-contained `dist/cli/index.js` (tsup bundles @voke/core) — what `npx @voke-sh/voke` resolves to.

### Established Patterns
- Offline snapshot reader (ING-03) reaches the same engine state as a live connection on identical data — so a committed DeepWiki snapshot gates reproducibly without network.
- Live Apideck = 4-tool proxy surface, 62/100 Tier D, already reproducible (Phase 4). Any blog number must match the committed fixture's output.
- @voke-sh/voke is the published (scoped) package; `voke-sh/voke@v0` is the Action; `v0` is the moving major tag for 0.x.

### Integration Points
- Blog CTA must reference exactly the published package (`@voke-sh/voke@0.1.0` / `@v0`) and the live spec URL (`voke-sh.github.io/voke/spec/` interim, voke.sh/spec target).
- DeepWiki snapshot + determinism test slot into existing `tests/` structure.

</code_context>

<specifics>
## Specific Ideas

- The honest Apideck D-tier (62/100) is the deliberate hook — "we lint our own employer's server and it scores D" is the neutrality proof.
- The determinism receipt (matching SHA-256 contentHash across runs) is shown in-post so readers can verify the wedge, not take it on faith.
- Launch sequencing is strict: npm live + npx verified BEFORE the post goes out.

</specifics>

<deferred>
## Deferred Ideas

- **voke.sh/blog (own-domain blog)** — preferred long-term home; deferred until voke.sh DNS is live. dev.to is the launch venue; can cross-post with canonical tag later.
- **Launch distribution channels** (HN, Reddit r/mcp, X, API-Days/conference talk) — amplification beyond "blog is live"; out of this phase's DoD. Reputational-ROI play tracked in PROJECT.md.
- **Multi-server leaderboard / comparison table** — considered as the second-server format; deferred to post-launch content.
- **0.0.x pipeline smoke-test release** — considered; skipped in favor of going straight to 0.1.0.
- **SARIF formatter, P2 differentiator rules** — v2, already tracked in REQUIREMENTS.md.

</deferred>

---

*Phase: 06-launch*
*Context gathered: 2026-06-14*
