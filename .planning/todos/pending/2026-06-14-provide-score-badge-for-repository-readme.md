---
created: 2026-06-14T14:49:18.795Z
title: Provide score badge for repository README
area: general
files: []
---

## Problem

Like Glama, Voke should let users embed a quality-score badge in their MCP
server's README (the shields.io-style chips shown in repo headers — e.g. npm
version, MCP Registry, Glama "A A B" grade, License MIT).

A badge gives `voke lint` a public, social presence: it markets the spec, gives
maintainers a reason to run the linter, and creates the same trust signal Glama
sells — except ours is deterministic and reproducible (the core wedge per
PROJECT.md). The badge surfaces the per-server MTQS score/grade as an
embeddable image.

Open questions to resolve when planning:
- **Static vs dynamic**: shields.io-style endpoint badge (requires a hosted
  endpoint — conflicts with "no on-call / no hosted service" constraint at L1)
  vs. a self-generated static SVG/markdown snippet `voke lint` emits locally
  (fits L1 determinism + no-infra constraint). Lean static for L1.
- **Badge content**: server score (0–100) and/or letter grade (A/B/C…). Match
  whatever the MTQS scoring model lands on.
- **Emission path**: a `voke badge` subcommand or a `--badge` flag on
  `voke lint` that writes an SVG and/or prints a markdown/HTML snippet to paste
  into a README.
- **Determinism**: badge must be byte-stable for the same input (same constraint
  as the score itself — no timestamps, no remote calls).

## Solution

TBD — likely deferred until MTQS scoring model + score output are finalized.
Most-constraint-compatible L1 approach: emit a static, self-contained SVG badge
locally (no hosted endpoint), plus a copy-paste markdown snippet. Revisit a
dynamic shields.io endpoint badge only if/when a hosted tier (L3) exists.
