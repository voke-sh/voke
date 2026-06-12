# Phase 2: Engine + Ingestion + Determinism - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 02-engine-ingestion-determinism
**Areas discussed:** Snapshot format & L2-readiness, Schema validation strictness (ING-05), Ingestion failure & auth UX, Determinism exit-criterion artifact

---

## Snapshot format & L2-readiness

| Option | Description | Selected |
|--------|-------------|----------|
| Scored LintReport only | One format; snapshot = full lint output | |
| Raw VokeSnapshot only | Snapshot = canonical surface, no scores | |
| Both, two flags | --save-snapshot (raw) + --output json (scored) distinct | ✓ |

**User's choice:** Both, two flags.

| Option | Description | Selected |
|--------|-------------|----------|
| Separate metadata, excluded from hash & test | capturedAt in meta block; determinism covers canonical body | ✓ |
| Omit timestamp entirely | No capturedAt anywhere | |
| Injectable clock | Pinned clock in tests | |

**User's choice:** Separate metadata, excluded (Recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| toolId=name, sorted, SHA-256 per tool + surface | Matches ING-04/ARCHITECTURE | ✓ |
| Namespace-aware composite id | Forward-proof for multi-server | |

**User's choice:** toolId=name, sorted, SHA-256 per tool + surface (Recommended).

---

## Schema validation strictness (ING-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Two bounds: hard safety + softer quality | Ingestion rejects on safety cap; lower quality threshold = finding | ✓ |
| One bound for both | Single limit, exceed = hard reject + quality violation | |

**User's choice:** Two bounds (Recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Max over branches; composition not a level | depth = 1 + max(children); oneOf/anyOf/allOf adds 0 | ✓ |
| Composition adds a level | each wrapper +1 | |
| Sum across allOf branches | accumulate | |

**User's choice:** Max over branches (Recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Full 2020-12, strict:false, no remote, validateSchema | Ajv2020 accepts unevaluated*/prefixItems/$dynamicRef | ✓ |
| Full 2020-12, strict:true | ajv strict rejects ambiguous keywords | |

**User's choice:** Full 2020-12, strict:false (Recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Leave internal $ref intact; ajv resolves at validate | No self-deref; only external $ref flagged | ✓ |
| Local-only resolver inlines $defs | Flatten before hash/rules | |

**User's choice:** Leave internal $ref intact (Recommended).

---

## Ingestion failure & auth UX

| Option | Description | Selected |
|--------|-------------|----------|
| Fail fast, non-zero exit, no retry | Distinct code + actionable message | ✓ |
| Bounded retry then fail | N retries with backoff | |

**User's choice:** Fail fast, no retry (Recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Repeatable --header 'K: V', token masked | curl-style, any scheme | ✓ |
| Dedicated --token + --header | shorthand bearer + headers | |
| Env var only | VOKE_MCP_TOKEN | |

**User's choice:** Repeatable --header, token masked (Recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Abort whole ingest, fail | partial surface = wrong score | ✓ |
| Score what was fetched, warn | best-effort on flaky servers | |

**User's choice:** Abort whole ingest (Recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Streamable-HTTP + SSE fallback | max reach over deployed SSE tail | ✓ |
| Streamable-HTTP only | one path, ship faster | |
| + stdio | local servers too | |

**User's choice:** Streamable-HTTP + SSE fallback (Recommended). User asked whether SSE still widely used; confirmed deprecated-in-spec but real deployed tail (servers from 2024–early-2025), SDK still ships SSEClientTransport — fallback chosen as cheap reach insurance for a connect-to-others'-servers tool.

---

## Determinism exit-criterion artifact

| Option | Description | Selected |
|--------|-------------|----------|
| Canonical JSON LintReport body, capturedAt excluded | serialize sorted-key, strip meta, assert 3x identical | ✓ |
| snapshotContentHash equality | hash-only, weaker | |
| Both: hash + full report body | strongest | |

**User's choice:** Canonical JSON LintReport body, capturedAt excluded (Recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Fail whole run, non-zero exit | throwing rule = bug; surface rule+tool | ✓ |
| Skip rule, emit warning | drop findings, warn | |

**User's choice:** Fail whole run (Recommended).

| Option | Description | Selected |
|--------|-------------|----------|
| Frozen RuleContext + network-blocked tests | Object.freeze ctx; IO throws in CI | ✓ |
| ESLint guard vs Date/Math.random/fetch | static author-time ban | |
| Runtime sandbox per rule | isolate globals | |

**User's choice:** Frozen RuleContext + network-blocked tests (Recommended).

## Claude's Discretion

- Exact depth numbers (hard safety ~32 / soft quality ~7) — pin in ING-05 spike against Apideck fixture.
- Distinct exit codes per failure class.
- Canonical-JSON key-sort serializer impl + locale-pinned name sort.
- SSE-fallback handshake-detection mechanism.
- RuleContext exact field shape.

## Deferred Ideas

- stdio transport; namespace-composite toolId; retry/backoff; score-on-partial-pagination; runtime sandbox / ESLint purity guard.
