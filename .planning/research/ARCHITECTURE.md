# Architecture Research

**Domain:** Deterministic MCP tool-quality linter with extensible rule engine (L1), designed to extend cleanly to L2 diff/breaking-change gate and custom/vendor rulesets
**Researched:** 2026-06-12
**Confidence:** HIGH (primary sources: MCP TS SDK docs, Spectral source, PRD, ESLint result model)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLI / GitHub Action                           │
│  voke lint <server>  ·  --min-score  ·  --config voke.yaml              │
│  exit 0 / exit 1 based on threshold                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                           Orchestrator                                   │
│  1. load config   2. ingest surface   3. run engine   4. format output  │
├───────────────────┬──────────────────────┬──────────────────────────────┤
│   Ingestion Layer │   Rule Engine        │   Scoring Engine             │
│                   │                      │                               │
│  MCP Client ──┐  │  RuleRegistry        │  pure scoreServer()           │
│  (live server) │  │  ┌──────────────┐   │  pure scoreTool()             │
│               ├──►  │ Rule[]        │   │  pure scoreDimension()        │
│  SnapshotReader│  │  │ id           │   │  published weights            │
│  (saved dump)  │  │  │ severity     │   │  stable sort                  │
│               ─┘  │  │ given        │   │  A–F tier table               │
│                   │  │ then/fn      │   │                               │
│                   │  └──────┬───────┘   │                               │
│                   │         │ run()     │                               │
│                   │         ▼           │                               │
│                   │  Finding[]          │                               │
│                   │  per tool           │                               │
└───────────────────┴──────────────────────┴──────────────────────────────┘
                               │                      │
                               ▼                      ▼
                        LintReport (serializable JSON, stable shape)
                        ┌─────────────────────────────────────────┐
                        │ mtqsVersion, serverIdentity,            │
                        │ capturedAt, contentHash,                │
                        │ tools[]: { id, findings[], dimensions,  │
                        │           toolScore, tier }             │
                        │ serverScore, serverTier                 │
                        └─────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| `cli/` | Parse args/config, wire up all other components, format output, set exit code | Thin; contains no linting logic |
| `ingestion/` | Acquire `ToolSurface` from MCP server or snapshot file; produce stable `ToolSnapshot` | Two strategies: `McpClient` and `SnapshotReader` |
| `engine/` | Register rules, evaluate each rule against each tool, collect `Finding[]` | Pure functions; no I/O |
| `rules/` | All MTQS rule implementations; one file per dimension | Depend only on `engine/` types |
| `scoring/` | Aggregate findings → dimension scores → tool score → server score → tier | Pure functions; published weights |
| `report/` | Serialize `LintReport` to JSON/text/SARIF; stable field ordering | No business logic |
| `config/` | Load and validate `voke.yaml`; merge severity overrides into registry | Zod schema; immutable after load |

---

## Recommended Project Structure

```
src/
├── cli/
│   ├── index.ts          # entry point, arg parsing (commander/yargs)
│   ├── lint.ts           # `lint` command: wires ingestion → engine → scoring → report
│   └── action.ts         # GitHub Action wrapper (reads env vars, calls lint)
│
├── ingestion/
│   ├── types.ts          # ToolSurface, ToolSnapshot, ServerIdentity
│   ├── mcp-client.ts     # live connection via @modelcontextprotocol/sdk Client
│   ├── snapshot-reader.ts# read .voke-snapshot.json from disk
│   └── snapshot-writer.ts# write snapshot (used by lint --save-snapshot)
│
├── engine/
│   ├── types.ts          # RuleDefinition, Finding, Severity, RuleContext
│   ├── registry.ts       # RuleRegistry: register, list, applyOverrides
│   └── runner.ts         # runRules(surface, registry) → Finding[] (pure)
│
├── rules/
│   ├── index.ts          # barrel: registers all MTQS rules into default registry
│   ├── description.ts    # MTQS-DESC-* rules
│   ├── parameters.ts     # MTQS-PARAM-* rules
│   ├── naming.ts         # MTQS-NAME-* rules
│   ├── annotations.ts    # MTQS-ANNO-* rules
│   ├── output.ts         # MTQS-OUT-* rules
│   ├── schema.ts         # MTQS-SCHEMA-* rules (JSON Schema 2020-12 checks)
│   └── surface.ts        # MTQS-SURF-* rules (server-level coherence)
│
├── scoring/
│   ├── types.ts          # DimensionScore, ToolScore, ServerScore, Tier
│   ├── weights.ts        # PUBLISHED_WEIGHTS (const, exported, part of spec)
│   ├── dimension.ts      # scoreDimension(findings, dimension) → DimensionScore
│   ├── tool.ts           # scoreTool(dimensionScores) → ToolScore
│   └── server.ts         # scoreServer(toolScores) → ServerScore + Tier
│
├── report/
│   ├── types.ts          # LintReport (the stable, serializable top-level type)
│   ├── builder.ts        # buildReport(surface, findings, scores) → LintReport
│   └── formatters/
│       ├── text.ts       # human-readable terminal output
│       ├── json.ts       # machine-readable JSON (same as LintReport)
│       └── sarif.ts      # SARIF 2.1.0 (optional; needed for GitHub Advanced Security)
│
├── config/
│   ├── types.ts          # VokeConfig (Zod schema)
│   └── loader.ts         # loadConfig(path?) → VokeConfig
│
└── spec/
    └── mtqs-version.ts   # MTQS_VERSION constant; linter declares which spec version it implements
```

### Structure Rationale

- **`engine/` has no dependency on `rules/`** — rules register themselves into the engine; engine never imports rules directly. This is the plugin boundary that lets custom/vendor rules load at runtime.
- **`scoring/` has no dependency on `engine/` internals** — it receives only `Finding[]` and uses published weights. Score formula is testable in isolation.
- **`report/types.ts` is the contract** — `LintReport` is the only type that crosses the CLI/output boundary and that L2 diff will read from snapshots.
- **`ingestion/types.ts` defines `ToolSnapshot`** — the stable serialized form both L1 (lint) and L2 (diff) operate on. Snapshot identity is established at ingestion time, not at lint time.

---

## Core Data Models (L2-Ready)

### 1. ToolSnapshot (ingestion output / snapshot file format)

```typescript
// ingestion/types.ts
interface ServerIdentity {
  url: string | null;        // null for file-mode ingestion
  name: string;              // from MCP server's initialize response
  version: string;           // from MCP server's initialize response
  protocolVersion: string;   // MCP protocol version negotiated
}

interface ToolSnapshot {
  // Stable identity — the key for L2 diff matching
  toolId: string;            // = tool.name (stable across server restarts)
  contentHash: string;       // SHA-256 of canonical JSON of {name, description, inputSchema, outputSchema, annotations}
                             // same interface → same hash regardless of capture time

  // Surface (verbatim from tools/list response)
  name: string;
  title?: string;
  description?: string;
  inputSchema: JSONSchemaObject;   // JSON Schema 2020-12
  outputSchema?: JSONSchemaObject;
  annotations?: ToolAnnotations;   // readOnlyHint, destructiveHint, idempotentHint, openWorldHint, + proposed
}

interface VokeSnapshot {
  snapshotVersion: '1';             // format version (not MTQS version)
  mtqsVersion: string;              // MTQS spec version this was linted under
  capturedAt: string;               // ISO-8601 UTC — informational only, NOT used in scoring
  server: ServerIdentity;
  tools: ToolSnapshot[];            // sorted by toolId ascending (determinism)
}
```

**Determinism enforcement point #1:** `tools` array is always sorted by `toolId` before hashing or scoring. `capturedAt` is recorded but never used in any score computation.

**L2 hook:** `contentHash` per tool enables O(1) change detection. `toolId = tool.name` is the stable identity key across snapshots. A diff compares two `VokeSnapshot` files by `toolId` join + `contentHash` comparison — no need to re-parse descriptions character by character on the hot path.

---

### 2. RuleDefinition (engine types)

```typescript
// engine/types.ts

type Severity = 'error' | 'warning' | 'info' | 'hint' | 'off';

type DimensionId =
  | 'description'    // MTQS-DESC
  | 'parameters'     // MTQS-PARAM
  | 'naming'         // MTQS-NAME
  | 'annotations'    // MTQS-ANNO
  | 'output'         // MTQS-OUT
  | 'schema'         // MTQS-SCHEMA
  | 'surface';       // MTQS-SURF (server-level)

// The target a rule evaluates against. 'tool' = per-tool; 'server' = whole surface.
type RuleTarget = 'tool' | 'server';

interface RuleContext {
  tool: ToolSnapshot;          // the tool being evaluated (null for server rules)
  surface: ToolSnapshot[];     // full server surface (all tools, sorted)
  config: VokeConfig;          // resolved config (severity overrides applied)
}

type RuleFunction = (ctx: RuleContext) => Finding[];

interface RuleDefinition {
  id: string;                  // e.g. "MTQS-DESC-001"
  description: string;         // human-readable, shown in output
  dimension: DimensionId;
  target: RuleTarget;
  defaultSeverity: Severity;
  fixHint: string;             // actionable; shown alongside findings
  mtqsVersion: string;         // which spec version introduced this rule
  fn: RuleFunction;            // pure function; no I/O allowed
}
```

**Determinism enforcement point #2:** `RuleFunction` must be a pure function. No `Date.now()`, no `Math.random()`, no network calls, no filesystem access. The `engine/runner.ts` enforcer: rules receive only `RuleContext` (frozen object) and may return only `Finding[]`.

---

### 3. Finding (engine output)

```typescript
// engine/types.ts (continued)

interface FindingLocation {
  tool: string;                // toolId
  path: string[];              // JSON path within the tool definition, e.g. ["inputSchema", "properties", "user"]
}

interface Finding {
  ruleId: string;              // e.g. "MTQS-DESC-001"
  dimension: DimensionId;
  severity: Severity;          // resolved severity (may differ from defaultSeverity if overridden)
  message: string;             // specific, includes the value that failed
  location: FindingLocation;
  fixHint: string;             // copied from RuleDefinition
}
```

**Key design decision:** `Finding` carries `dimension` so scoring can aggregate without looking up the rule again. `severity` is the *resolved* severity (after config overrides), not the rule default — the scoring function uses the resolved value.

---

### 4. Score types (scoring output)

```typescript
// scoring/types.ts

type Tier = 'A' | 'B' | 'C' | 'D' | 'F';

interface DimensionScore {
  dimension: DimensionId;
  score: number;               // 0–100
  weight: number;              // from PUBLISHED_WEIGHTS; included for auditability
  findingCount: Record<Severity, number>;
}

interface ToolScore {
  toolId: string;
  score: number;               // 0–100, weighted average of dimension scores
  tier: Tier;
  dimensions: DimensionScore[];
  findingCount: Record<Severity, number>;  // totals across all dimensions
}

interface ServerScore {
  score: number;               // 0–100, mean of tool scores (simple mean; formula is published)
  tier: Tier;
  toolCount: number;
  scoredToolCount: number;     // tools with at least one finding evaluated
}
```

**Determinism enforcement point #3:** Score formula uses only `Finding[]` + `PUBLISHED_WEIGHTS` (static const). No wall-clock, no tool count that changes with server network ordering. `scoreServer()` sorts `ToolScore[]` by `toolId` before computing the mean.

---

### 5. LintReport (top-level serializable output)

```typescript
// report/types.ts

interface LintReport {
  // Metadata
  vokeVersion: string;         // semver of the voke CLI
  mtqsVersion: string;         // MTQS spec version used
  generatedAt: string;         // ISO-8601 UTC — informational only

  // Server identity (from ingestion)
  server: ServerIdentity;
  snapshotContentHash: string; // SHA-256 of canonical JSON of the sorted tools array
                               // = fingerprint of the entire surface; stable across re-runs

  // Per-tool results
  tools: Array<{
    toolId: string;
    contentHash: string;       // from ToolSnapshot — enables L2 delta detection
    findings: Finding[];       // sorted by ruleId then path (deterministic)
    dimensions: DimensionScore[];
    score: number;
    tier: Tier;
  }>;

  // Aggregate
  server: ServerScore;
}
```

**L2 hook:** The `LintReport` is also the snapshot format that `voke diff` will consume. Two `LintReport` files can be diffed by:
1. `snapshotContentHash` — did the surface change at all?
2. Per-tool `contentHash` join — which specific tools changed?
3. Per-tool `score` delta — did quality move?
4. `findings` set diff — which rules newly appeared or disappeared?

This means L2 does not need a separate snapshot format. `voke lint --save-snapshot` writes a `LintReport` to disk; `voke diff --base <file>` reads two of them.

---

## Architectural Patterns

### Pattern 1: Registry-First Rule Loading (the plugin boundary)

**What:** The `RuleRegistry` is a mutable map populated at startup, not at import time. Rules call `registry.register(def)` to add themselves. The CLI loads the default MTQS ruleset by calling `import './rules/index'` which triggers all registrations. Custom rulesets are loaded as additional `import()`s before the registry is sealed.

**When to use:** Enables custom/vendor rules to slot in without modifying core, and enables `--no-default-rules` to replace MTQS rules entirely for private rulesets.

**Trade-offs:** The registry is mutable during startup but should be frozen before `runner.ts` executes (throw on any post-seal registration attempt). Simple to implement; no reflection required.

```typescript
// engine/registry.ts
export class RuleRegistry {
  private rules = new Map<string, RuleDefinition>();
  private sealed = false;

  register(def: RuleDefinition): void {
    if (this.sealed) throw new Error(`Registry is sealed; cannot register ${def.id}`);
    if (this.rules.has(def.id)) throw new Error(`Duplicate rule id: ${def.id}`);
    this.rules.set(def.id, def);
  }

  seal(): void { this.sealed = true; }

  list(): ReadonlyArray<RuleDefinition> {
    return [...this.rules.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  applyOverrides(overrides: Record<string, Severity>): RuleRegistry {
    // Returns a NEW registry with overridden severities — never mutates the sealed registry
    // Used to apply voke.yaml severity overrides
    ...
  }
}
```

**Determinism enforcement point #4:** `registry.list()` always returns rules sorted by `id`. Runner iterates this sorted list. Findings from each rule are sorted by `location.path` before being appended. Final `Finding[]` per tool is therefore fully ordered and reproducible regardless of registration order.

---

### Pattern 2: Pure Runner with Frozen Context

**What:** `runRules()` receives the surface and registry, constructs a frozen `RuleContext`, calls each `RuleDefinition.fn(ctx)`, and collects results. No side effects inside the loop.

**When to use:** Always. This is the core determinism guarantee.

```typescript
// engine/runner.ts
export const runRules = (
  surface: ReadonlyArray<ToolSnapshot>,
  registry: RuleRegistry,
  config: VokeConfig,
): Finding[] => {
  const rules = registry.list(); // sorted by id
  const sortedSurface = [...surface].sort((a, b) => a.toolId.localeCompare(b.toolId));
  const findings: Finding[] = [];

  for (const rule of rules) {
    if (rule.defaultSeverity === 'off') continue;
    const resolvedSeverity = config.severityOverrides[rule.id] ?? rule.defaultSeverity;
    if (resolvedSeverity === 'off') continue;

    if (rule.target === 'tool') {
      for (const tool of sortedSurface) {
        const ctx: RuleContext = Object.freeze({ tool, surface: sortedSurface, config });
        const raw = rule.fn(ctx);
        findings.push(...raw.map(f => ({ ...f, severity: resolvedSeverity })));
      }
    } else {
      // server-level rule
      const ctx: RuleContext = Object.freeze({ tool: null as never, surface: sortedSurface, config });
      const raw = rule.fn(ctx);
      findings.push(...raw.map(f => ({ ...f, severity: resolvedSeverity })));
    }
  }

  // Sort findings: toolId → ruleId → path (deterministic output regardless of rule execution order)
  return findings.sort((a, b) =>
    a.location.tool.localeCompare(b.location.tool) ||
    a.ruleId.localeCompare(b.ruleId) ||
    a.location.path.join('.').localeCompare(b.location.path.join('.'))
  );
};
```

---

### Pattern 3: Two-Strategy Ingestion with Unified Output Type

**What:** Both `McpIngestor` (live server) and `SnapshotReader` (file) produce the same `VokeSnapshot` output type. The orchestrator in `cli/lint.ts` calls either strategy and then hands the result to the engine — the engine never knows which strategy was used.

**When to use:** Always — enables `--snapshot-file` mode for offline scoring, reproducible CI runs on a saved dump, and L2 diff (which explicitly uses saved snapshots, not URL-vs-URL live comparison per PRD §7).

```typescript
// ingestion/types.ts
interface Ingestor {
  ingest(): Promise<VokeSnapshot>;
}

// Two implementations:
// McpIngestor: connects via MCP SDK Client, calls listTools() with pagination, constructs VokeSnapshot
// SnapshotReader: reads .voke-snapshot.json (or LintReport JSON) from disk
```

**Determinism enforcement point #5:** `McpIngestor` sorts the `tools` array by `toolId` before returning. Network response ordering from MCP servers is undefined; the sort is mandatory before any hashing or scoring.

---

### Pattern 4: Separation of Snapshot Format from LintReport

**What:** `VokeSnapshot` is the raw tool surface (no findings, no scores). `LintReport` is the full output of a lint run. The snapshot can be saved independently (`voke snapshot <server>`) or as part of a lint run (`voke lint --save-snapshot`). `voke diff` reads two `LintReport` files (which embed the snapshot data).

**Why this matters for L2:** L2 diff needs:
- The tool surface at time T-1 (the baseline) → available from a saved `LintReport`
- The tool surface at time T (current) → produced by a fresh `voke lint`
- Score deltas and finding deltas → derived from comparing the two `LintReport` objects

This means L2 adds only a `diff/` module that takes two `LintReport` objects and computes a `DiffReport`. No new ingestion layer, no new snapshot format, no engine changes.

---

## Data Flow

### L1 Lint Flow

```
voke lint <server-url>
    │
    ▼
config/loader.ts: loadConfig('voke.yaml')
    │  → VokeConfig (severity overrides, thresholds, ruleset extensions)
    ▼
ingestion/mcp-client.ts: McpIngestor.ingest()
    │  → MCP SDK Client.connect() + Client.listTools() [paginated]
    │  → sort tools by toolId
    │  → compute contentHash per tool
    │  → VokeSnapshot
    ▼
engine/runner.ts: runRules(snapshot.tools, registry, config)
    │  → iterate registry.list() [sorted by rule id]
    │  → for each rule: call rule.fn(frozen RuleContext)
    │  → sort all findings [toolId → ruleId → path]
    │  → Finding[]
    ▼
scoring/: scoreServer(scoreTool(scoreDimension(findings)))
    │  → DimensionScore[] per tool
    │  → ToolScore[] (sorted by toolId)
    │  → ServerScore + Tier
    ▼
report/builder.ts: buildReport(snapshot, findings, toolScores, serverScore)
    │  → LintReport (stable JSON; snapshotContentHash computed here)
    ▼
report/formatters/: format(report, { format: 'text' | 'json' | 'sarif' })
    │  → stdout
    ▼
cli/lint.ts: exit 0 if serverScore.score >= config.minScore, else exit 1
```

### L2 Diff Flow (future, designed for)

```
voke diff --base <baseline-report.json>
    │
    ├─► load baseline: SnapshotReader(baselineReportPath) → LintReport (baseline)
    ├─► run fresh lint: full L1 flow above → LintReport (current)
    │
    ▼
diff/: diffReports(baseline, current)
    │  → join on toolId
    │  → for each tool: contentHash changed? → structural/semantic diff
    │  → score delta per tool
    │  → new findings (present in current, absent in baseline)
    │  → resolved findings (present in baseline, absent in current)
    │  → DiffReport
    ▼
exit 1 if any breaking structural change OR score dropped below threshold
```

**Key constraint satisfied (PRD §7):** diff is snapshot-vs-snapshot (two `LintReport` files), NOT URL-vs-URL. The baseline is a committed artifact, making it reproducible in CI.

---

## Determinism Enforcement Points (summary)

| Point | Where | What it enforces |
|-------|-------|-----------------|
| #1 | `ingestion/mcp-client.ts` | Sort `tools[]` by `toolId` before any hashing or scoring |
| #2 | `engine/runner.ts` | `RuleFunction` receives only frozen `RuleContext`; no I/O contracts |
| #3 | `scoring/server.ts` | Sort `ToolScore[]` by `toolId` before computing server mean |
| #4 | `engine/registry.ts` | `registry.list()` returns rules sorted by `id` |
| #5 | `ingestion/mcp-client.ts` | Network ordering from MCP server is discarded; sort on ingest |
| #6 | `report/builder.ts` | `snapshotContentHash` = SHA-256 of `JSON.stringify(tools.sort(by toolId))` |
| #7 | `scoring/weights.ts` | `PUBLISHED_WEIGHTS` is a `const` object; no runtime mutation |

---

## Build Order with Dependencies

```
Step 1: TypeScript confirmation + project scaffolding
        BLOCKED BY: nothing
        UNBLOCKS: all subsequent steps
        NOTE: package.json, tsconfig, vitest, ESLint, tsup/esbuild

Step 2: Author MTQS v0.1 specification (writing task)
        BLOCKED BY: Step 1 (understand TS tooling before writing rules)
        UNBLOCKS: Steps 3, 5
        NOTE: per-dimension rubrics, scoring formula, rule IDs — this is the spec document;
              code must not precede a defensible written spec

Step 3: engine/types.ts + engine/registry.ts + engine/runner.ts
        BLOCKED BY: Step 2 (need rule format + dimension list from spec)
        UNBLOCKS: Steps 4, 5
        NOTE: pure functions; fully testable with zero MCP or network dependency;
              this is the highest-risk correctness surface — test thoroughly here

Step 4: ingestion/types.ts + ingestion/mcp-client.ts + ingestion/snapshot-reader.ts
        BLOCKED BY: Step 3 (needs ToolSnapshot type from engine/types)
        UNBLOCKS: Step 6 (CLI integration)
        NOTE: MCP SDK Client.listTools() with pagination; sort on ingest (determinism #1, #5)

Step 5: scoring/ + report/types.ts + report/builder.ts
        BLOCKED BY: Step 3 (needs Finding type and DimensionId from engine/types)
        UNBLOCKS: Step 6
        NOTE: PUBLISHED_WEIGHTS defined here; pure functions; testable in isolation

Step 6: rules/ — implement all MTQS rules
        BLOCKED BY: Steps 2, 3 (needs spec + RuleDefinition + RuleContext types)
        UNBLOCKS: Step 7
        NOTE: one file per dimension; each rule registers into the default registry;
              AJV (ajv/dist/2020) for JSON Schema 2020-12 validation in MTQS-SCHEMA-* rules

Step 7: cli/ + report/formatters/ + config/
        BLOCKED BY: Steps 4, 5, 6 (needs all core modules)
        UNBLOCKS: Step 8
        NOTE: thin wiring layer; --min-score exit code; text/JSON/SARIF formatters

Step 8: GitHub Action wrapper + voke.yaml config + README
        BLOCKED BY: Step 7 (needs working CLI)
        UNBLOCKS: Step 9

Step 9: Publish spec at voke.sh/spec + launch blog post
        BLOCKED BY: Steps 2, 8 (spec doc + working linter)
        NOTE: run live against Apideck 229-tool server; this is the definition of done
```

**First finishable unit (PRD §13):** Steps 1 + 3 + 4 + 5 + minimal Step 6 (2–3 rules) + Step 7 = `voke lint` against one real server with deterministic output. Can be reached before the full MTQS ruleset is complete.

---

## Scaling Considerations

Voke L1 is a CLI tool — "scaling" means "handles large tool surfaces without degrading." The Apideck server (229 tools) is the reference benchmark.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1–50 tools | No optimization needed; synchronous rule execution |
| 50–300 tools | `runRules()` stays synchronous; the hot path is JSON parsing + regex, not I/O. 229-tool surface completes in <500ms on a laptop. |
| 300–1000 tools | Consider parallelizing per-tool rules with `Promise.all` across tools; server-level rules stay sequential. The current architecture supports this: each tool's rules are independent. |
| 1000+ tools | L2's use case, not L1. Snapshot diff (contentHash join) is O(n) regardless of tool count. |

**First bottleneck:** JSON Schema 2020-12 validation via AJV. AJV compiles schemas on first use; cache compiled validators keyed by schema hash. Already fits in `engine/runner.ts` via `RuleContext`.

**Second bottleneck (L2 only):** Large snapshot files. Address with streaming JSON parse (not relevant for L1).

---

## Anti-Patterns

### Anti-Pattern 1: Scoring Inside Rule Functions

**What people do:** Have rules return a numeric score contribution instead of `Finding[]`.
**Why it's wrong:** Conflates finding emission with scoring. Makes it impossible to override severity (an `error` overridden to `warning` should affect the score differently), and makes the score formula opaque. Cannot serialize findings separately from scores.
**Do this instead:** Rules return only `Finding[]` with a `severity`. `scoring/` computes all numeric scores from findings using PUBLISHED_WEIGHTS. The formula is visible, testable, and auditable.

### Anti-Pattern 2: URL-vs-URL Diff

**What people do:** Implement L2 diff by connecting to two live server URLs and comparing their live `tools/list` responses.
**Why it's wrong:** Non-reproducible (server may change between the two calls), not CI-native (requires two running servers), and is explicitly mcpx's mistake per PRD §7.
**Do this instead:** L2 diff always compares two `LintReport` files (committed artifacts). The "current" side is produced by a fresh lint run that immediately saves a snapshot; the "baseline" is a committed file in the repo.

### Anti-Pattern 3: Wall-Clock or Network-Order Dependence in Scores

**What people do:** Include `capturedAt` timestamp, network response ordering, or tool count that varies by server connection state in the score formula.
**Why it's wrong:** Breaks same-input-same-output. The entire value proposition vs. Glama is determinism.
**Do this instead:** `capturedAt` is recorded in `VokeSnapshot` for humans but never referenced in `runRules()` or any scoring function. All collections are sorted before use.

### Anti-Pattern 4: Global Mutable Registry

**What people do:** Implement `RuleRegistry` as a module-level singleton that is mutated after tests or concurrent runs.
**Why it's wrong:** Test isolation breaks; parallel test runners produce flaky results.
**Do this instead:** `RuleRegistry` is instantiated per lint run in the CLI. Tests construct their own registry. The "default MTQS registry" is a factory function `createDefaultRegistry()` that returns a fresh sealed instance.

### Anti-Pattern 5: Adopting Spectral's Engine Directly

**What people do:** Use Spectral as the runtime engine (not just as an inspiration) because it already has a rule runner.
**Why it's wrong:** Spectral's `given` selectors are JSONPath over a single document. Voke rules operate over structured `ToolSnapshot` objects, not a raw JSON document — "surface coherence" (server-level) rules need access to all tools simultaneously, which Spectral's per-document model does not support. Spectral also uses `@stoplight/json` under the hood and carries significant transitive dependencies for an OpenAPI/AsyncAPI linter.
**Do this instead:** Model the *rule format* (id, severity, given-target, then/fn) on Spectral — borrow the API shape that users recognize — but implement the runner from scratch in ~100 lines of TypeScript. Total engine code is simpler than adapting Spectral.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| MCP Server (live) | `@modelcontextprotocol/sdk` `Client` + `StreamableHTTPClientTransport` or `SSEClientTransport` | Use paginated `listTools()` (loop on `nextCursor`); MCP RC 2026-07-28 adds full JSON Schema 2020-12 support |
| MCP Server (stdio, local) | `StdioClientTransport` | For local server testing; same `Client.listTools()` API |
| AJV | `import Ajv2020 from 'ajv/dist/2020'` | JSON Schema 2020-12 validation for MTQS-SCHEMA-* rules; compile once and cache |
| GitHub Actions | `@actions/core` (setFailed, setOutput) | Thin wrapper in `cli/action.ts`; reads inputs from env vars; calls same lint logic |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `ingestion` → `engine` | `VokeSnapshot` (plain data, frozen) | Engine never calls ingestion; orchestrator passes the snapshot in |
| `engine` → `scoring` | `Finding[]` (plain array, immutable after sort) | Scoring never calls engine; orchestrator passes findings in |
| `engine` → `rules` | `RuleRegistry` registration at startup | Rules call `registry.register()`; engine calls `registry.list()` |
| `scoring` → `report` | `ToolScore[]` + `ServerScore` (plain data) | Report builder assembles the final `LintReport` from all outputs |
| `cli` → everything | Direct TypeScript imports; no message bus | CLI is the only component allowed to have side effects (stdout, exit codes, file I/O) |
| `config` → `engine` | `VokeConfig` passed into `runRules()` | Config is immutable after `loadConfig()` completes |

---

## Sources

- MCP TypeScript SDK docs — `Client.listTools()` with pagination, `StreamableHTTPClientTransport`: https://ts.sdk.modelcontextprotocol.io/v2
- Spectral rule format (id, severity, given, then, custom functions): https://docs.stoplight.io/docs/spectral/e5b9616d6d50c-rulesets
- Spectral anti-pattern evidence (why NOT to use Spectral runtime directly): https://github.com/stoplightio/spectral/blob/develop/docs/guides/4-custom-rulesets.md
- MCP contract snapshot pattern (contentHash, toolId-based identity): https://medium.com/@binarEx/your-mcp-servers-tool-descriptions-changed-last-night-nobody-noticed-e3ad93cf6bc7
- ESLint result model (LintMessage, per-file findings, aggregate): https://eslint.org/docs/latest/integrate/nodejs-api
- AJV JSON Schema 2020-12 TypeScript support (`ajv/dist/2020`): https://ajv.js.org/guide/getting-started.html
- PRD §7 (L2 diff requirements, snapshot-not-URL mandate): ./prd.md
- PRD §13 (canonical build order): ./prd.md

---
*Architecture research for: Voke — deterministic MCP tool-quality linter (L1), extensible to L2 diff + custom rulesets*
*Researched: 2026-06-12*
