# Phase 6: Launch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 06-launch
**Areas discussed:** Second server choice, Blog venue + narrative, What the demo proves, npm release mechanics

---

## Second server choice

| Option | Description | Selected |
|--------|-------------|----------|
| Official reference server (stdio) | npx stdio lint of a modelcontextprotocol/* server; zero auth, hermetic | |
| Well-known hosted HTTP server | Public streamable-HTTP server, mirrors Apideck live path | ✓ |
| Multiple servers (small batch) | 3–5 servers, comparison table / leaderboard | |

**User's choice:** Well-known hosted HTTP server.
**Follow-up — which host:**

| Option | Description | Selected |
|--------|-------------|----------|
| DeepWiki MCP | mcp.deepwiki.com/mcp — public, no auth, stable small surface | ✓ |
| Hugging Face MCP | huggingface.co/mcp — larger surface, less stable for a fixture | |
| Cloudflare docs MCP | docs.mcp.cloudflare.com — narrow doc-search surface | |
| Let me name it | User-specified | |

**User's choice:** DeepWiki MCP.
**Notes:** Commit snapshot fixtures for both Apideck + DeepWiki as the reproducible gate; live runs are blog screenshots only, so launch-day server availability can't break the DoD.

---

## Blog venue + narrative

| Option | Description | Selected |
|--------|-------------|----------|
| voke.sh/blog (own domain) | Self-hosted VitePress, owned canonical URL; blocks on DNS | |
| Apideck eng blog | Existing audience; employer-conflict tension | |
| dev.to / Medium | Neutral platform, built-in distribution | ✓ |
| Cross-post | Canonical voke.sh + mirror | |

**User's choice:** dev.to / Medium (captured as dev.to default).
**Follow-up — narrative shape:**

| Option | Description | Selected |
|--------|-------------|----------|
| Problem → spec → live proof | Gap → deterministic > LLM-judge → MTQS 22 rules → live Apideck/DeepWiki → CTA | ✓ |
| Tutorial-first | Lead with 60s CI gate, spec second | |
| Opinion/manifesto | Lead on why reproducible spec must exist | |

**User's choice:** Problem → spec → live proof.
**Notes:** Run stop-slop skill on draft before publishing.

---

## What the demo proves

(User asked for the recommended option rather than selecting from the menu.)

**Resolved decision:** Option 1 (committed fixtures + byte-identical x3 test, honest scores published verbatim) as the gate, with option 2 (show SHA-256 contentHash / canonical-JSON byte equality) folded into the blog as the determinism receipt.

**Rationale given:** DoD criterion 1 requires byte-identical x3 with committed fixture = option 1, non-negotiable. Honesty (publishing real 62/D Apideck score) is the wedge vs Glama. Hash detail already exists in the data model, so showing it is a presentation choice with no new code. Option 3 (proof in repo only) rejected as less self-contained.

---

## npm release mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| 0.1.0, publish before blog | Cut 0.1.0, publish.yml + provenance + v0 tag, verify npx, then blog | ✓ |
| 0.1.0, same-day coordinated | npm + blog together; propagation risk | |
| 0.0.x pre-release first | Smoke-test pipeline, then 0.1.0 | |

**User's choice:** 0.1.0, publish before blog.
**Notes:** Dead npx command in launch-day CTA would kill trust — strict ordering: publish + verify npx → then blog.

## Claude's Discretion

- Blog length, headings, code-block formatting (within the Problem→proof→CTA shape)
- Snapshot capture mechanics
- npx vs Action snippet (or both) in the CTA

## Deferred Ideas

- voke.sh/blog own-domain home (pending DNS)
- Launch distribution channels (HN/Reddit/X/API-Days)
- Multi-server leaderboard/comparison content
- 0.0.x pipeline smoke-test release
- SARIF formatter, P2 differentiator rules (v2)
