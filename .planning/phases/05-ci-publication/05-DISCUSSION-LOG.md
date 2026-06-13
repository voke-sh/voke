# Phase 5: CI + Publication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 05-ci-publication
**Areas discussed:** stdio invocation UX, GitHub Action shape, Spec publication venue, README demo + repo readiness

---

## stdio invocation UX

| Option | Description | Selected |
|--------|-------------|----------|
| `voke lint -- <cmd>` | Everything after `--` is the subprocess cmd+args; matches roadmap criterion | ✓ |
| `--stdio "<cmd>"` | Flag taking a quoted command string; quoting friction | |
| `stdio:` scheme | Reuse scheme registry; unusual for launching processes | |

| Option | Description | Selected |
|--------|-------------|----------|
| Inherit + `--env KEY=VAL` | Inherit parent env, repeatable override, masked like headers | ✓ |
| Inherit parent env only | Simplest, no new flag | |
| Explicit env only | Hermetic, more friction | |

**User's choice:** `voke lint -- <cmd>` + inherit-plus-`--env` (masked).

---

## GitHub Action shape

| Option | Description | Selected |
|--------|-------------|----------|
| Composite action + npx | `action.yml` runs `npx voke` via setup-node | ✓ |
| JS action (bundled dist) | Pre-bundled JS committed to action repo | |
| Docker action | Containerized, slow cold start | |

| Option | Description | Selected |
|--------|-------------|----------|
| Major tag `@v1` | Moving major tag, auto patches/minors | ✓ |
| Full SHA pin | Max reproducible, ugly in quickstart | |
| Exact tag `@v0.1.0` | Pinned exact release, manual bumps | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same repo, root `action.yml` | One repo/release, `uses: voke-sh/voke@v1` | ✓ |
| Dedicated action repo | Cleaner split, two repos to coordinate | |

**User's choice:** composite + npx, `@v1` tag, same-repo root action.yml.
**Notes:** Surfaced new in-scope item — publish `voke` to npm (npx depends on it).

---

## Spec publication venue

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Pages from repo | Render spec markdown via Pages; zero new infra | |
| Dedicated docs site | SSG at voke.sh; nicer but new pipeline | ✓ |
| Repo markdown only (defer voke.sh) | Public repo spec/ canonical now | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same repo | Spec + linter version together | ✓ |
| Separate spec repo | Cleaner governance, drift risk | |

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned files, keep all | Old versions immutable + citable | ✓ |
| Single living doc + changelog | Simpler, weaker citability | |

**Follow-up — Docs SSG:**

| Option | Description | Selected |
|--------|-------------|----------|
| VitePress | Markdown-first, minimal config, TS-aligned | ✓ |
| Docusaurus | React, batteries-included, heavier | |
| Astro Starlight | Great output, third framework | |
| Let research decide | Defer SSG pick to researcher | |

**User's choice:** Dedicated VitePress docs site at voke.sh, same repo, versioned-keep-all.
**Notes:** User deviated from the recommended GitHub Pages toward a real docs site; accepts the added build pipeline.

---

## README demo + repo readiness

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Action YAML snippet | Lead with CI job; satisfies criterion #3 | ✓ |
| Local `npx voke lint` first | Lead with live one-liner | |
| stdio example first | Lead with hermetic local-dev loop | |

| Option | Description | Selected |
|--------|-------------|----------|
| Apache-2.0 | Patent + trademark; standard-governance signal | ✓ |
| MIT | Shortest, permissive, no patent terms | |
| Split Apache spec / MIT code | Dual-license complexity | |

| Option | Description | Selected |
|--------|-------------|----------|
| Rule-PR rigor: primary-source + determinism | Citation (no Glama), ±fixtures, determinism | ✓ |
| General OSS onboarding | Standard setup/test/PR etiquette | |
| Spec-change governance | Proposal/review/versioning process | |

**User's choice:** README leads with Action YAML snippet (+ npx one-liner below); Apache-2.0 (linter+spec); CONTRIBUTING emphasizes rule-PR rigor.

## Claude's Discretion

- stdio subprocess teardown mechanism; StdioClientTransport wiring.
- action.yml input/output schema beyond min-score.
- VitePress config (theme/nav/version dropdown/CNAME/deploy).
- Rule PR template fields; CONTRIBUTING structure; npm package metadata.
- Exit code for stdio launch/teardown failures.

## Deferred Ideas

- Launch blog + live demo (Phase 6); spec-change governance; split-licensing (rejected); second public server run (Phase 6).
