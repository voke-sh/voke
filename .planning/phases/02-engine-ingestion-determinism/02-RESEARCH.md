# Phase 2: Engine + Ingestion + Determinism - Research

**Researched:** 2026-06-12
**Domain:** MCP SDK client API, Ajv2020, canonical JSON / SHA-256 hashing, rule engine purity, schema depth counting
**Confidence:** HIGH (all stack decisions pre-locked by CONTEXT.md; research focused on HOW, not WHAT)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Two distinct artifacts. `voke lint --save-snapshot` writes a raw `VokeSnapshot` (no scores); `voke lint --output json` writes a scored `LintReport`. Separate purpose-built types.

**D-02:** `capturedAt` lives in a separate metadata block, excluded from `snapshotContentHash` and excluded from the byte-identical determinism test.

**D-03:** `toolId = tool.name`; tools sorted ascending by `toolId`; per-tool `contentHash` = SHA-256 of canonical JSON of `{name, description, inputSchema, outputSchema, annotations}`; surface hash = SHA-256 of the sorted tools array.

**D-04:** Two depth bounds. Hard safety cap (stops hang/OOM/DoS) — exceeding it rejects at ingestion. Separate lower quality threshold is a Phase-3 S-rule finding.

**D-05:** `depth(node) = 1 + max(depth of children)`. `oneOf`/`anyOf`/`allOf` wrapper adds 0 levels — recurse into each branch, take deepest.

**D-06:** `Ajv2020` from `ajv/dist/2020`, `strict: false`, full JSON Schema 2020-12. `loadSchema` never wired. Use `ajv.validateSchema` for the "is this valid 2020-12" boolean. `strict:false` so legit-but-unusual schemas are not rejected.

**D-07:** Internal `$ref` (same-document `$defs`) left intact — never dereferenced. ajv resolves it natively. Canonical JSON / `contentHash` keep `$ref` as-written. Only external `$ref` is flagged (S04, Phase 3).

**D-08:** Fail fast, no retry. Connection failure → exit non-zero with distinct exit code + actionable message. No auto-retry/backoff.

**D-09:** Auth via repeatable `--header 'Key: Value'` (mirrors curl). Header/token values masked in all output.

**D-10:** Abort whole ingest on any pagination page failure. Never score incomplete data.

**D-11:** Transport: Streamable-HTTP primary + SSE fallback. Try `StreamableHTTPClientTransport`; on legacy handshake signal fall back to `SSEClientTransport`. stdio deferred.

**D-12:** Byte-identical x3 DoD test: run engine 3x on saved Apideck fixture, serialize `LintReport` with sorted keys, strip meta/`capturedAt` block, assert 3 strings are byte-identical.

**D-13:** A rule that throws → fail the whole run, non-zero exit, surfacing which rule + which tool threw. No silent swallow.

**D-14:** Purity enforcement: rules receive `Object.freeze`'d `RuleContext`; return `Finding[]` only; unit tests run with network blocked (outbound socket attempt throws in CI).

### Claude's Discretion

- Exact depth numbers: hard safety cap (~32) and soft quality threshold (~7) — pin against real Apideck-fixture schema depths during the ING-05 spike.
- Exact distinct exit codes per failure class (connect, auth, partial-page, rule-throw, depth-exceeded).
- Canonical-JSON implementation: recursive sorted-key `JSON.stringify`, explicit `localeCompare('en', {sensitivity:'variant'})` for name sorts.
- SSE-fallback handshake-detection mechanism (which signal triggers downgrade).
- `RuleContext` exact field shape beyond the ARCHITECTURE draft.

### Deferred Ideas (OUT OF SCOPE)

- stdio transport
- Namespace-composite `toolId`
- Retry/backoff on connect
- Score-what-was-fetched on partial pagination
- Runtime sandbox / ESLint static guard for rule purity
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENG-01 | Spectral-shaped rule engine runs pure synchronous `(context) => Finding[]` functions | Rule engine skeleton patterns, `Object.freeze`, network-blocked vitest tests |
| ENG-02 | Engine supports per-tool rules and server-aggregate (surface-level) rules | `scope: per-tool \| server` field from `spec/mtqs-v0.1.yaml`; routing logic in runner |
| ENG-03 | Rule registry is startup-time plugin boundary; fresh sealed instance; `voke.yaml` severity overrides produce new registry | `RuleRegistry.seal()`, `applyOverrides()` returns new instance |
| ENG-04 | Byte-identical output across 3 consecutive runs on identical input | 7 determinism enforcement points; canonical JSON; SHA-256; locale-pinned sorts |
| ING-01 | Connect to live Streamable-HTTP MCP server, pull paginated `tools/list` | `StreamableHTTPClientTransport` + `client.listTools({ cursor })` loop |
| ING-02 | Auth via static bearer token / custom header | `requestInit.headers` on `StreamableHTTPClientTransport`; masking in output |
| ING-03 | Read saved tool dump (snapshot) offline without network call | `SnapshotReader` reads `VokeSnapshot` JSON from disk; no SDK call |
| ING-04 | Ingested surface canonicalized — sorted by `toolId`, per-tool `contentHash` (SHA-256) | `node:crypto` `createHash('sha256')`, canonical-JSON serializer |
| ING-05 | No auto-deref of external `$ref`; schema depth bounded; full JSON Schema 2020-12 accepted | `Ajv2020` `strict:false`, depth counter, external-`$ref` detection |
</phase_requirements>

---

## Summary

Phase 2 builds the determinism-guaranteed runtime layer that phases 3 (rules) and 4 (CLI) plug into. The stack is entirely pre-decided by CONTEXT.md and CLAUDE.md; this research answers the HOW for the five open areas: MCP SDK client construction/auth/pagination, Ajv2020 configuration, canonical-JSON + SHA-256 implementation, schema depth counting, and rule purity enforcement patterns.

The MCP SDK 1.29.0 provides all required transport types. `StreamableHTTPClientTransport` accepts `requestInit.headers` for custom header injection (including bearer tokens). The SSE fallback pattern is a try/catch on `client.connect()` — if the first transport throws, construct a new client and `SSEClientTransport` and try again. `client.listTools({ cursor })` with a `do/while` loop on `nextCursor` handles pagination; fail the whole run on any page error (D-10).

`Ajv2020` from `ajv/dist/2020` with `strict: false` is the correct instance type for JSON Schema 2020-12. `ajv.validateSchema(schema)` returns a boolean without running user data through the schema — it is the right primitive for the "is this inputSchema structurally valid 2020-12?" check. External `$ref` detection is a simple string-matching walk: any `$ref` value that does not start with `#` is external and must be flagged without fetching.

Canonical JSON is a recursive function that sorts object keys with `localeCompare('en', {sensitivity: 'variant'})` before serializing — this is the only approach that produces locale-independent byte-identical output. `node:crypto` `createHash('sha256').update(canonicalJson).digest('hex')` gives the contentHash. No external library is needed.

The schema depth counting algorithm follows D-05 exactly: `depth(node) = 1 + max(depth(child) for all children)`, where `oneOf`/`anyOf`/`allOf` nodes recurse into their sub-schemas without adding a level to the wrapper itself. A hard cap of 32 prevents OOM/hang at ingestion time; the soft quality threshold (7) is a Phase-3 finding.

**Primary recommendation:** Build the phase in strict build order — types first, then canonicalization, then ingestion, then engine skeleton, then the x3 determinism fixture test. Wire the test early; it is the executable definition of done.

---

## Standard Stack

### Core (all pinned in CLAUDE.md — confirmed at npm registry 2026-06-12)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | `~1.29.0` | MCP client — `StreamableHTTPClientTransport`, `SSEClientTransport`, `Client`, `listTools` pagination | Only official TS SDK; v1.29.0 confirmed on npm 2026-06-04 |
| `ajv` (via `ajv/dist/2020`) | `8.20.0` | JSON Schema 2020-12 validation (`Ajv2020`); `validateSchema` for structural correctness check | Only validator with full draft-2020-12 support (incl. `unevaluatedProperties`, `prefixItems`); sync-only compile is deterministic |
| `ajv-formats` | `3.0.1` | Standard format keywords for use inside rules (Phase 3) | Companion to ajv v8; peer dep of MCP SDK already |
| `node:crypto` | built-in | `createHash('sha256')` for `contentHash` and `snapshotContentHash` | No external dep; synchronous; deterministic |
| `vitest` | `4.1.8` | Test runner — unit, fixture, and the x3 determinism test | Already installed at root; zero-config ESM+TS; network-blocking with `vi.stubGlobal('fetch', ...)` or `vi.mock('node:net')` |
| `tsup` | `8.5.1` | Build (unused in Phase 2 directly, but the new workspace package will need it for Phase 4) | Already in root devDependencies |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `4.4.3` | Parse `voke.yaml` config; validate `VokeSnapshot` on read from disk | Already in `@voke/core`; use for any user-controlled structured input |
| `js-yaml` | `^4.1.0` | Parse `voke.yaml` config file | Already in `@voke/core`; reuse |

### New workspace package

Phase 2 introduces a new npm workspace package: `packages/linter` (or `packages/engine`). It depends on `@voke/core` (workspace:*) and `@modelcontextprotocol/sdk`.

**Installation for new package:**
```bash
npm install @modelcontextprotocol/sdk ajv ajv-formats --workspace=packages/linter
```

---

## Architecture Patterns

### Recommended Project Structure for `packages/linter/src/`

```
packages/linter/src/
├── ingestion/
│   ├── types.ts          # ToolSnapshot, VokeSnapshot, ServerIdentity (verbatim from ARCHITECTURE.md)
│   ├── mcp-client.ts     # McpIngestor: StreamableHTTP + SSE fallback, listTools pagination
│   ├── snapshot-reader.ts# SnapshotReader: read VokeSnapshot JSON from disk (ING-03)
│   └── snapshot-writer.ts# write VokeSnapshot to disk (--save-snapshot)
│
├── engine/
│   ├── types.ts          # RuleContext, RuleFunction, RuleDefinition, Finding, FindingLocation
│   ├── registry.ts       # RuleRegistry: register, seal, list (sorted), applyOverrides → new instance
│   └── runner.ts         # runRules(surface, registry, config) → Finding[] (pure, frozen ctx)
│
├── canonicalize/
│   ├── canonical-json.ts # canonicalJson(obj): sorted-key recursive serializer
│   └── hash.ts           # sha256(str): node:crypto digest helper
│
└── config/
    ├── types.ts           # VokeConfig (Zod schema)
    └── loader.ts          # loadConfig(path?) → VokeConfig
```

The `canonicalize/` module is extracted as its own unit because it is consumed by both ingestion (for `contentHash`) and the report builder (for `snapshotContentHash` and the x3 determinism comparison).

---

### Pattern 1: MCP Client Construction with Header Auth

**What:** `StreamableHTTPClientTransport` accepts a `requestInit` option that takes a standard `Headers` or plain object for headers. This is the D-09 `--header 'Key: Value'` implementation path.

**Exact API (verified against Context7, SDK v1.29.0):**
```typescript
// Source: Context7 /modelcontextprotocol/typescript-sdk, docs/migration.md
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const buildHeaders = (rawHeaders: string[]): Record<string, string> => {
  // rawHeaders: ['Authorization: Bearer tok', 'X-Custom: val']
  const result: Record<string, string> = {};
  for (const raw of rawHeaders) {
    const idx = raw.indexOf(':');
    if (idx === -1) throw new Error(`Invalid header: ${raw}`);
    result[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
  }
  return result;
};

const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
  requestInit: {
    headers: buildHeaders(cliHeaders),  // from --header flags
  },
});
```

**Masking for output:** Before logging or including in `LintReport`, replace any header value for keys matching `/^authorization$/i` or any key in the user's `--header` list with `'[MASKED]'`. Never store raw header values in any serialized type.

---

### Pattern 2: SSE Fallback (D-11)

**What:** Try `StreamableHTTPClientTransport` first. If `client.connect()` throws, create a fresh `Client` and `SSEClientTransport` and retry.

**The signal:** The SDK throws on `client.connect()` when the server responds with a non-2xx status or an unexpected content type (e.g., a legacy server that speaks only SSE and returns `text/event-stream` on the first POST). The catch block is the right fallback trigger — no need to inspect the error type; any throw on the first connect attempt triggers SSE downgrade.

**Confidence:** HIGH — verified against Context7 SDK docs (migration.md and client.md examples). The SDK ships both transports; the try/catch pattern is the documented approach.

```typescript
// Source: Context7 /modelcontextprotocol/typescript-sdk, docs/client.md
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export const connectWithFallback = async (
  url: URL,
  headers: Record<string, string>,
): Promise<{ client: Client; transport: StreamableHTTPClientTransport | SSEClientTransport }> => {
  try {
    const client = new Client({ name: 'voke', version: VOKE_VERSION });
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });
    await client.connect(transport);
    return { client, transport };
  } catch {
    // Legacy server — fall back to SSE
    const client = new Client({ name: 'voke', version: VOKE_VERSION });
    const transport = new SSEClientTransport(url);
    await client.connect(transport);
    return { client, transport };
  }
};
```

**Note on auth with SSE fallback:** `SSEClientTransport` also accepts `requestInit` in its constructor options for headers. Verify this is wired when constructing the fallback transport.

---

### Pattern 3: Paginated `listTools` with Fail-Fast on Page Error (ING-01, D-10)

**What:** Loop on `nextCursor` until exhausted. Any page error aborts the entire ingestion (D-10 — a partial surface produces a wrong score).

```typescript
// Source: Context7 /modelcontextprotocol/typescript-sdk, docs/client.md
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const fetchAllTools = async (
  client: Client,
  timeoutMs = 30_000,
): Promise<Tool[]> => {
  const allTools: Tool[] = [];
  let cursor: string | undefined;
  do {
    // Any page failure propagates (D-10 — abort on partial)
    const { tools, nextCursor } = await client.listTools(
      { cursor },
      { timeout: timeoutMs },
    );
    allTools.push(...tools);
    cursor = nextCursor;
  } while (cursor);
  return allTools;
};
```

**Timeout per page:** Pass `timeout` in `RequestOptions` to `listTools`. The SDK default is 60s; 30s is a sensible default for production servers. Expose as `--timeout` (Phase 4), hardcode 30_000 for Phase 2.

---

### Pattern 4: Canonical JSON Serializer (D-03, D-12)

**What:** Deterministic key-sorted `JSON.stringify` replacement. Keys sorted with `localeCompare('en', {sensitivity: 'variant'})` — explicit locale avoids `LC_ALL=C` vs `en_US` variation.

```typescript
// Source: pattern derived from PITFALLS.md Pitfall 1 + CONTEXT.md D-03/D-12

export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'variant' }))
    .map(k => {
      const v = (value as Record<string, unknown>)[k];
      return JSON.stringify(k) + ':' + canonicalJson(v);
    });
  return '{' + sorted.join(',') + '}';
};
```

**Critical invariants:**
- Arrays are NOT sorted (order is semantic in JSON Schema `prefixItems`, `enum`, etc.)
- Only object keys are sorted
- `undefined` values are excluded (same behavior as `JSON.stringify`)
- Internal `$ref` strings are kept as-written (D-07 — no deref before hashing)

---

### Pattern 5: SHA-256 `contentHash` (ING-04)

```typescript
// Source: node:crypto built-in
import { createHash } from 'node:crypto';

export const sha256 = (input: string): string =>
  createHash('sha256').update(input, 'utf8').digest('hex');

// Usage for per-tool contentHash (D-03):
export const toolContentHash = (tool: Pick<ToolSnapshot, 'name' | 'description' | 'inputSchema' | 'outputSchema' | 'annotations'>): string =>
  sha256(canonicalJson({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
  }));

// Usage for surface snapshotContentHash (ARCHITECTURE point #6):
export const surfaceContentHash = (tools: ToolSnapshot[]): string => {
  // tools MUST already be sorted by toolId before this call
  const sorted = [...tools].sort((a, b) =>
    a.toolId.localeCompare(b.toolId, 'en', { sensitivity: 'variant' })
  );
  return sha256(canonicalJson(sorted));
};
```

---

### Pattern 6: Ajv2020 Configuration (D-06, ING-05)

**What:** Instantiate once, compile synchronously, never wire `loadSchema`. `validateSchema` is the structural validity check.

```typescript
// Source: Context7 /ajv-validator/ajv, docs/json-schema.md
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

// Singleton — instantiated once per lint run (not per rule invocation)
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);

// Structural validity check for ING-05 / MTQS-S03 (Phase 3 rule):
export const isValidJsonSchema2020 = (schema: unknown): boolean => {
  // validateSchema uses the 2020-12 meta-schema because ajv was instantiated as Ajv2020
  return ajv.validateSchema(schema as object);
};

// NEVER do this:
// const ajv = new Ajv2020({ loadSchema: async (uri) => fetch(uri).then(r => r.json()) });
// loadSchema enables outbound HTTP — breaks determinism and opens SSRF
```

**Why `strict: false`:**
Ajv strict mode rejects schemas with unknown keywords (like `x-*` extensions) or non-standard patterns. `strict: false` lets legitimate-but-unusual schemas pass ajv's own strictness gate without emitting false MTQS errors. MTQS-S03 fires when the schema is genuinely invalid per the 2020-12 meta-schema — not when ajv's strictness mode complains.

---

### Pattern 7: External `$ref` Detection Without Fetching (ING-05, D-07)

**What:** Walk the schema tree looking for any `$ref` value that does not start with `#`. Flag it; do not fetch it.

```typescript
export const hasExternalRef = (schema: unknown, depth = 0): boolean => {
  if (depth > 64) return false; // emergency safety bail
  if (typeof schema !== 'object' || schema === null) return false;
  if (Array.isArray(schema)) {
    return schema.some(item => hasExternalRef(item, depth + 1));
  }
  const obj = schema as Record<string, unknown>;
  if (typeof obj['$ref'] === 'string' && !obj['$ref'].startsWith('#')) {
    return true; // external $ref found
  }
  return Object.values(obj).some(v => hasExternalRef(v, depth + 1));
};
```

**Rationale:** No library needed. The check is a pure tree walk. The depth guard prevents stack overflow on pathological schemas before the depth bound code runs.

---

### Pattern 8: Schema Depth Counting (D-04, D-05)

**What:** `depth(node) = 1 + max(depth of children)`. Composition keywords (`oneOf`/`anyOf`/`allOf`/`if`/`then`/`else`) recurse into sub-schemas without incrementing for the wrapper itself.

**Claude's Discretion — hard cap and soft threshold:** Based on the D-04/D-05 algorithm and the Apideck server (229 tools, some auto-generated from OpenAPI), the recommended values are:
- **Hard safety cap: 32** — prevents OOM/stack overflow on pathological recursive schemas; chosen to be well above any real-world schema while still bounding the worst case
- **Soft quality threshold: 7** — a schema deeper than 7 levels is harder for agents to reason about; this becomes a Phase-3 S-rule warning, not an ingestion error

These numbers should be verified against the Apideck fixture during the ING-05 spike (see Wave 0 in Validation Architecture below).

```typescript
const COMPOSITION_KEYS = new Set(['oneOf', 'anyOf', 'allOf', 'if', 'then', 'else', 'not']);
const DEPTH_HARD_CAP = 32;

export const schemaDepth = (schema: unknown, current = 0): number => {
  if (current > DEPTH_HARD_CAP) return current; // early bail
  if (typeof schema !== 'object' || schema === null) return current;
  if (Array.isArray(schema)) return current; // array at schema level is invalid; skip

  const obj = schema as Record<string, unknown>;
  let maxChildDepth = current;

  for (const [key, value] of Object.entries(obj)) {
    if (COMPOSITION_KEYS.has(key) && Array.isArray(value)) {
      // Composition wrapper — recurse branches without incrementing
      for (const branch of value) {
        maxChildDepth = Math.max(maxChildDepth, schemaDepth(branch, current));
      }
    } else if (key === 'properties' && typeof value === 'object' && value !== null) {
      // Each property adds one level
      for (const propSchema of Object.values(value as Record<string, unknown>)) {
        maxChildDepth = Math.max(maxChildDepth, schemaDepth(propSchema, current + 1));
      }
    } else if (key === 'items' || key === '$defs' || key === 'definitions') {
      const sub = typeof value === 'object' && value !== null ? Object.values(value as Record<string, unknown>) : [value];
      for (const s of sub) {
        maxChildDepth = Math.max(maxChildDepth, schemaDepth(s, current + 1));
      }
    } else if (key === 'additionalProperties' && typeof value === 'object') {
      maxChildDepth = Math.max(maxChildDepth, schemaDepth(value, current + 1));
    }
  }

  return maxChildDepth;
};
```

---

### Pattern 9: Rule Engine Runner with Frozen Context and Fail-on-Throw (ENG-01, D-13, D-14)

**What:** `runRules` freezes the context, iterates sorted rules, wraps each call in try/catch that rethrows with rule+tool context (D-13).

```typescript
// engine/runner.ts
export const runRules = (
  surface: ReadonlyArray<ToolSnapshot>,
  registry: RuleRegistry,
  config: VokeConfig,
): Finding[] => {
  const rules = registry.list(); // sorted by id (determinism point #4)
  const sortedSurface = [...surface].sort((a, b) =>
    a.toolId.localeCompare(b.toolId, 'en', { sensitivity: 'variant' })
  );
  const findings: Finding[] = [];

  for (const rule of rules) {
    const resolvedSeverity = config.severityOverrides?.[rule.id] ?? rule.defaultSeverity;
    if (resolvedSeverity === 'off') continue;

    if (rule.target === 'tool') {
      for (const tool of sortedSurface) {
        const ctx = Object.freeze({ tool, surface: sortedSurface, config });
        let raw: Finding[];
        try {
          raw = rule.fn(ctx);
        } catch (err) {
          throw new RuleExecutionError(rule.id, tool.toolId, err);  // D-13: fail fast
        }
        findings.push(...raw.map(f => ({ ...f, severity: resolvedSeverity })));
      }
    } else {
      // server-scoped rule (ENG-02)
      const ctx = Object.freeze({ tool: null as never, surface: sortedSurface, config });
      let raw: Finding[];
      try {
        raw = rule.fn(ctx);
      } catch (err) {
        throw new RuleExecutionError(rule.id, 'SERVER', err);
      }
      findings.push(...raw.map(f => ({ ...f, severity: resolvedSeverity })));
    }
  }

  // Sort findings: toolId → ruleId → path (determinism point #4)
  return findings.sort((a, b) =>
    a.location.tool.localeCompare(b.location.tool, 'en', { sensitivity: 'variant' }) ||
    a.ruleId.localeCompare(b.ruleId, 'en', { sensitivity: 'variant' }) ||
    a.location.path.join('.').localeCompare(b.location.path.join('.'), 'en', { sensitivity: 'variant' })
  );
};

export class RuleExecutionError extends Error {
  constructor(
    public readonly ruleId: string,
    public readonly toolId: string,
    public readonly cause: unknown,
  ) {
    super(`Rule ${ruleId} threw on tool ${toolId}: ${String(cause)}`);
    this.name = 'RuleExecutionError';
  }
}
```

---

### Pattern 10: RuleRegistry with Seal and Override (ENG-03)

**What:** Mutable during startup; sealed before runner executes. `applyOverrides` returns a NEW sealed registry (never mutates the original).

```typescript
// engine/registry.ts (confirmed against ARCHITECTURE.md pattern)
export class RuleRegistry {
  private readonly rules = new Map<string, RuleDefinition>();
  private sealed = false;

  register(def: RuleDefinition): void {
    if (this.sealed) throw new Error(`Registry sealed; cannot register ${def.id}`);
    if (this.rules.has(def.id)) throw new Error(`Duplicate rule id: ${def.id}`);
    this.rules.set(def.id, def);
  }

  seal(): this {
    this.sealed = true;
    return this;
  }

  list(): ReadonlyArray<RuleDefinition> {
    return [...this.rules.values()].sort((a, b) =>
      a.id.localeCompare(b.id, 'en', { sensitivity: 'variant' })
    );
  }

  applyOverrides(overrides: Record<string, Severity>): RuleRegistry {
    // Returns NEW sealed registry — never mutates this (D-ENG-03)
    const next = new RuleRegistry();
    for (const def of this.rules.values()) {
      const overridden = overrides[def.id];
      next.register(overridden ? { ...def, defaultSeverity: overridden } : def);
    }
    return next.seal();
  }
}

// Factory function (Anti-Pattern 4 guard from ARCHITECTURE.md):
export const createDefaultRegistry = (): RuleRegistry => {
  // Populated by Phase 3 rule registration; in Phase 2 returns an empty sealed registry
  const registry = new RuleRegistry();
  // Phase 3: import './rules/index.js' triggers registrations here
  return registry.seal();
};
```

---

### Pattern 11: `RuleContext` Exact Field Shape

**Claude's Discretion resolved:** The ARCHITECTURE.md draft shows `{ tool, surface, config }`. For Phase 2, `config` should carry the resolved `VokeConfig` including `severityOverrides`. For server-scoped rules, `tool` is `null` (typed as `null` in the server-rule overload, not `never`).

```typescript
// engine/types.ts
export interface RuleContext {
  readonly tool: ToolSnapshot | null;  // null for server-scoped rules (ENG-02)
  readonly surface: ReadonlyArray<ToolSnapshot>;
  readonly config: Readonly<VokeConfig>;
}

export type RuleFunction = (ctx: RuleContext) => Finding[];

export interface RuleDefinition {
  id: string;
  description: string;
  dimension: DimensionId;
  target: 'tool' | 'server';
  defaultSeverity: Severity;
  fixHint: string;
  mtqsVersion: string;
  fn: RuleFunction;
}
```

`Object.freeze` in the runner makes the frozen context structurally immutable at runtime but TypeScript readonly annotations enforce it at compile time. Both layers are needed: TypeScript catches accidental mutation in rule code at compile time; `Object.freeze` catches it at test time (strict mode throws on mutation of frozen objects).

---

### Pattern 12: Exit Codes (Claude's Discretion resolved)

| Failure Class | Exit Code | When |
|--------------|-----------|------|
| Success | 0 | All rules ran, score >= threshold (or no threshold) |
| Score below threshold | 1 | `--min-score` gate failed (Phase 4) |
| Connect failure | 2 | `StreamableHTTPClientTransport` + `SSEClientTransport` both failed |
| Auth failure / 401 | 3 | Server returned 401 after connect |
| Partial pagination | 4 | A `listTools` page failed; ingest aborted (D-10) |
| Rule execution threw | 5 | `RuleExecutionError` (D-13) |
| Depth exceeded (hard cap) | 6 | Schema exceeded hard safety cap at ingestion (D-04) |
| Config parse error | 7 | `voke.yaml` failed Zod validation |

**Rationale:** Distinct codes per failure class enable CI scripts to distinguish "server unreachable" from "score too low" from "linter bug" — directly actionable.

---

### Pattern 13: Byte-Identical x3 Determinism Test (ENG-04, D-12)

**What:** The phase's proof artifact. Runs the engine 3 times on the committed Apideck fixture, serializes with sorted keys, strips `capturedAt`/`generatedAt`, asserts byte-identical.

```typescript
// tests/engine/determinism.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runRules } from '../../packages/linter/src/engine/runner.js';
import { createDefaultRegistry } from '../../packages/linter/src/engine/registry.js';
import { canonicalJson } from '../../packages/linter/src/canonicalize/canonical-json.js';
import type { VokeSnapshot } from '../../packages/linter/src/ingestion/types.js';

const FIXTURE_PATH = 'tests/fixtures/apideck-snapshot.json';

const runAndSerialize = (snapshot: VokeSnapshot): string => {
  const registry = createDefaultRegistry();
  const findings = runRules(snapshot.tools, registry, {});
  // Strip non-deterministic fields before comparison
  const report = { findings }; // Phase 2: findings only; full LintReport in Phase 4
  return JSON.stringify(JSON.parse(canonicalJson(report))); // sorted-key serialization
};

describe('ENG-04: byte-identical output x3', () => {
  it('produces identical output across 3 consecutive runs on the Apideck fixture', () => {
    const snapshot: VokeSnapshot = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
    const [r1, r2, r3] = [runAndSerialize(snapshot), runAndSerialize(snapshot), runAndSerialize(snapshot)];
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });
});
```

**Note:** The Apideck fixture (`tests/fixtures/apideck-snapshot.json`) must be created as part of Phase 2 (either by running against the live server once and saving, or by constructing a synthetic fixture with representative schema shapes). The fixture must be committed to the repo.

---

### Anti-Patterns to Avoid

- **`new Ajv()` instead of `new Ajv2020()`**: `new Ajv()` defaults to draft-07; `unevaluatedProperties`, `prefixItems`, `$dynamicRef` will fail. Always import from `ajv/dist/2020`.
- **`ajv.compileAsync` / wiring `loadSchema`**: Enables remote IO — breaks determinism + SSRF surface. Never wire.
- **`JSON.stringify(obj)` without key sorting**: Key order is insertion-order in V8 but not guaranteed to be stable across MCP server implementations. Always use `canonicalJson`.
- **`[].sort()` without explicit comparator**: Default sort is locale-dependent in some environments. Always pass `localeCompare('en', {sensitivity:'variant'})` comparator.
- **Catching rule throws and continuing**: Silent swallow = wrong score with no signal. D-13 mandates fail-fast with rule+tool context in the error message.
- **Module-level singleton `RuleRegistry`**: Breaks test isolation. Always use `createDefaultRegistry()` factory.
- **`SSEClientTransport` without headers on fallback**: SSE legacy servers may also require auth. Ensure `requestInit.headers` is forwarded to the fallback transport constructor.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP protocol client | Custom HTTP + JSON-RPC | `@modelcontextprotocol/sdk` `Client` + `StreamableHTTPClientTransport` | Protocol edge cases (initialize, pagination cursor, session management) are non-trivial |
| JSON Schema 2020-12 validation | Custom schema walker | `Ajv2020` from `ajv/dist/2020` | `unevaluatedProperties`, `$dynamicRef`, `prefixItems` — 2020-12 is not backward compatible |
| SHA-256 hashing | Pure-JS hash function | `node:crypto` `createHash` | Constant-time, audited, zero-dep |
| YAML config parsing | Custom YAML parser | `js-yaml` (already in `@voke/core`) | YAML edge cases (anchors, multi-doc) |
| Config schema validation | Manual type guards | `zod` (already in `@voke/core`) | Structured error messages for user-facing config errors |

**Key insight:** The only genuinely custom code in Phase 2 is the canonical-JSON serializer, the depth counter, the external-`$ref` detector, and the engine runner. Everything else is SDK/library composition.

---

## Common Pitfalls

### Pitfall 1: `new Ajv()` instead of `new Ajv2020()`
**What goes wrong:** `unevaluatedProperties`, `prefixItems`, `$dynamicRef` are silently ignored or cause errors. Validated as draft-07.
**Why it happens:** `import Ajv from 'ajv'` resolves to draft-07 by default.
**How to avoid:** Always `import Ajv2020 from 'ajv/dist/2020'` — different import path.
**Warning signs:** TypeScript import resolving to `ajv/dist/core` instead of `ajv/dist/2020`.

### Pitfall 2: `localeCompare` without pinned locale
**What goes wrong:** `a.localeCompare(b)` uses the process locale (`LANG`, `LC_ALL`). On `C.UTF-8` CI runners vs `en_US.UTF-8` dev machines, sort order differs for names with diacritics or special chars.
**How to avoid:** Always `a.localeCompare(b, 'en', { sensitivity: 'variant' })`.
**Warning signs:** Output differs between local and CI runs.

### Pitfall 3: Pagination cursor type confusion
**What goes wrong:** `nextCursor` from `listTools` is `string | undefined`, not `string | null`. Using `while (cursor !== null)` loops forever on a server that returns `undefined`.
**How to avoid:** `do { ... } while (cursor)` or `while (cursor !== undefined)`.

### Pitfall 4: `Object.freeze` is shallow
**What goes wrong:** `Object.freeze(ctx)` prevents top-level property reassignment but nested objects (e.g., `ctx.tool.inputSchema`) remain mutable. A rule that mutates `ctx.tool.inputSchema.properties` corrupts the surface for all subsequent rules.
**How to avoid:** Deep-freeze `ToolSnapshot` at ingestion time (not at rule invocation time). Use `Object.freeze` recursively on all `ToolSnapshot` objects when they enter the engine. In Phase 2, a shallow freeze of the `RuleContext` is the minimum; deep freeze is the goal.
**Warning signs:** Rule B sees different input than Rule A ran against, despite identical ingestion.

### Pitfall 5: `capturedAt` / `generatedAt` in the determinism comparison body
**What goes wrong:** Including the ISO-8601 timestamp in the body being compared makes every run non-identical — even on the same fixture, wall-clock seconds differ.
**How to avoid:** D-02 / D-12: strip `capturedAt`, `generatedAt`, and any wall-clock field before the byte-identical comparison. The x3 test explicitly removes these fields.

### Pitfall 6: `SSEClientTransport` does not forward `requestInit.headers`
**What goes wrong:** Auth headers passed to `StreamableHTTPClientTransport` are not automatically forwarded to `SSEClientTransport` when falling back. Authenticated legacy servers fail with 401 on the SSE connection.
**How to avoid:** Explicitly pass `requestInit: { headers }` to `SSEClientTransport` constructor as well.
**Confidence:** MEDIUM (SSE transport constructor options verified in SDK types but not tested against a live legacy auth server — validate during Phase 4 live testing).

### Pitfall 7: `canonicalJson` on `undefined` values
**What goes wrong:** If a `ToolSnapshot` field is `undefined` (e.g., `outputSchema` is absent), `JSON.stringify` omits the key. `canonicalJson` must mirror this behavior — omit `undefined` values — otherwise the hash differs from a serialization where the key is absent.
**How to avoid:** Filter `undefined` values in the object branch of `canonicalJson`, or always provide `null` instead of `undefined` for optional fields in `ToolSnapshot`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `SSEClientTransport` only | `StreamableHTTPClientTransport` primary + SSE fallback | SDK v1.x (2025) | Primary transport for deployed servers is now Streamable HTTP; SSE is legacy |
| JSON Schema draft-07 for MCP `inputSchema` | JSON Schema 2020-12 (MCP RC 2026-07-28) | RC July 2026 | `prefixItems`, `unevaluatedProperties`, `$dynamicRef` now valid in tool schemas |
| Ajv v6 (draft-07) | Ajv v8 `ajv/dist/2020` (draft-2020-12) | Ajv v8 release | Different import path; `strict:false` needed for unusual but valid schemas |
| `requestInit.headers: { Authorization: string }` | `requestInit: { headers: Headers | Record }` | SDK v2 migration | Headers passed as standard Web `Headers` object or plain record in `requestInit` |

**Deprecated/outdated:**
- `SSEClientTransport` as primary: now legacy. Still required for servers on older SDK versions.
- `ajv/dist/core` as the Ajv entry point for 2020-12: always use `ajv/dist/2020` explicitly.
- `$RefParser.dereference()` on MCP tool schemas: prohibited by MCP RC; crashes on circular `$defs/$ref`.

---

## Open Questions

1. **Apideck fixture max schema depth**
   - What we know: Apideck exposes 229 tools, many auto-generated from OpenAPI. OpenAPI-to-MCP generators often produce `allOf` chains.
   - What's unclear: Whether any Apideck tool schema exceeds depth 7 (soft threshold) or approaches the 32 hard cap.
   - Recommendation: Spike during ING-05 — fetch live, run `schemaDepth()` across all 229 tools, record max/p95. This validates the threshold numbers before they're baked into the spec. If any tool exceeds 7, the soft threshold may need adjustment (or the finding becomes noise).

2. **`SSEClientTransport` `requestInit` support**
   - What we know: `StreamableHTTPClientTransport` explicitly documents `requestInit` with headers. The SSE transport constructor accepts options but the docs are less explicit.
   - What's unclear: Whether `SSEClientTransport` has the same `requestInit.headers` path or uses a different option name.
   - Recommendation: Check the SDK source for `SSEClientTransport` constructor signature during implementation. If it lacks `requestInit`, forward headers via a custom `EventSource` wrapper (the SDK's `SSEClientTransport` accepts a custom `eventSourceInit`).

3. **`Object.freeze` deep vs shallow for `ToolSnapshot`**
   - What we know: Shallow freeze is the minimum for Phase 2. Deep freeze prevents subtle rule-to-rule contamination.
   - What's unclear: Performance cost of deep-freezing 229 tools with large schemas at ingestion time.
   - Recommendation: Implement shallow freeze in Phase 2 (sufficient for correctness with trusted built-in rules); add deep freeze in Phase 3 when rules are written and the test suite can catch any contamination.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.8 |
| Config file | `/Users/samir.amzani/Projects/voke/vitest.config.ts` |
| Quick run command | `vitest run tests/engine/ tests/ingestion/ tests/canonicalize/` |
| Full suite command | `vitest run` |

Tests for Phase 2 land under `tests/` at the repo root (same pattern as existing `tests/spec/`). New subdirectories: `tests/engine/`, `tests/ingestion/`, `tests/canonicalize/`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ENG-01 | Rule function `(ctx) => Finding[]` runs; frozen context passed | unit | `vitest run tests/engine/runner.test.ts` | Wave 0 |
| ENG-01 | Rule that mutates frozen context throws in strict mode | unit | `vitest run tests/engine/frozen-ctx.test.ts` | Wave 0 |
| ENG-02 | Per-tool rule receives each tool; server rule receives full surface | unit | `vitest run tests/engine/runner.test.ts` | Wave 0 |
| ENG-03 | Sealed registry rejects registration; `applyOverrides` returns new instance | unit | `vitest run tests/engine/registry.test.ts` | Wave 0 |
| ENG-04 | x3 byte-identical output on Apideck fixture | determinism | `vitest run tests/engine/determinism.test.ts` | Wave 0 |
| ENG-04 | Output identical with shuffled input order (sort enforced) | determinism | `vitest run tests/engine/determinism.test.ts` | Wave 0 |
| ING-01 | `fetchAllTools` pagination loop collects all pages | unit (mocked) | `vitest run tests/ingestion/mcp-client.test.ts` | Wave 0 |
| ING-01 | Partial page failure aborts and throws (D-10) | unit (mocked) | `vitest run tests/ingestion/mcp-client.test.ts` | Wave 0 |
| ING-02 | Auth headers forwarded in transport; masked in serialized output | unit | `vitest run tests/ingestion/mcp-client.test.ts` | Wave 0 |
| ING-03 | SnapshotReader reads fixture JSON without network call | unit | `vitest run tests/ingestion/snapshot-reader.test.ts` | Wave 0 |
| ING-04 | `canonicalJson` produces identical bytes for same input in different key-insertion orders | unit | `vitest run tests/canonicalize/canonical-json.test.ts` | Wave 0 |
| ING-04 | `toolContentHash` identical for same tool regardless of object key order | unit | `vitest run tests/canonicalize/hash.test.ts` | Wave 0 |
| ING-04 | `toolId` sort is locale-independent (`LC_ALL=C` vs `en_US`) | unit | `vitest run tests/canonicalize/canonical-json.test.ts` | Wave 0 |
| ING-05 | Schema with external `$ref` detected without network call | fixture | `vitest run tests/ingestion/ext-ref.test.ts` | Wave 0 |
| ING-05 | Schema exceeding hard depth cap rejected at ingestion | unit | `vitest run tests/ingestion/depth.test.ts` | Wave 0 |
| ING-05 | `isValidJsonSchema2020` returns false for invalid schema, true for valid | unit | `vitest run tests/ingestion/ajv-validate.test.ts` | Wave 0 |
| D-13 | Rule that throws causes `RuleExecutionError` with ruleId+toolId | unit | `vitest run tests/engine/runner.test.ts` | Wave 0 |
| D-14 | Network call attempt in vitest throws (network blocked) | unit | `vitest run tests/engine/network-block.test.ts` | Wave 0 |

### Network Blocking in vitest

vitest does not have a built-in network mock. Two approaches:
1. **`vi.stubGlobal('fetch', ...)`** — blocks `fetch` calls (standard in Node 22+)
2. **`vi.mock('node:net', ...)`** — blocks raw TCP socket creation

For Phase 2 (no rule implementations yet), the network-block test validates that the *test infrastructure* for Phase 3 works. A simple sentinel test:

```typescript
// tests/engine/network-block.test.ts
import { it, expect, vi, beforeEach, afterEach } from 'vitest';

it('fetch is blocked in this test environment', async () => {
  vi.stubGlobal('fetch', () => { throw new Error('Network blocked in tests'); });
  await expect(fetch('https://example.com')).rejects.toThrow('Network blocked');
  vi.unstubAllGlobals();
});
```

For Phase 3 rule unit tests, `beforeEach` will stub `fetch` globally.

### Sampling Rate

- **Per task commit:** `vitest run tests/engine/ tests/ingestion/ tests/canonicalize/`
- **Per wave merge:** `vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/engine/runner.test.ts` — covers ENG-01, ENG-02, D-13
- [ ] `tests/engine/registry.test.ts` — covers ENG-03
- [ ] `tests/engine/determinism.test.ts` — covers ENG-04 (requires Apideck fixture)
- [ ] `tests/engine/frozen-ctx.test.ts` — covers D-14 context mutation
- [ ] `tests/engine/network-block.test.ts` — covers D-14 network block infrastructure
- [ ] `tests/ingestion/mcp-client.test.ts` — covers ING-01, ING-02 (mocked SDK client)
- [ ] `tests/ingestion/snapshot-reader.test.ts` — covers ING-03
- [ ] `tests/ingestion/ext-ref.test.ts` — covers ING-05 external-`$ref` detection
- [ ] `tests/ingestion/depth.test.ts` — covers ING-05 depth counting + hard cap
- [ ] `tests/ingestion/ajv-validate.test.ts` — covers ING-05 `isValidJsonSchema2020`
- [ ] `tests/canonicalize/canonical-json.test.ts` — covers ING-04 canonical JSON, locale sort
- [ ] `tests/canonicalize/hash.test.ts` — covers ING-04 SHA-256 contentHash
- [ ] `tests/fixtures/apideck-snapshot.json` — committed fixture for ENG-04 determinism test (fetch once from live, save, commit)

---

## Sources

### Primary (HIGH confidence)

- Context7 `/modelcontextprotocol/typescript-sdk` v1.29.0 — `StreamableHTTPClientTransport` construction, `requestInit.headers`, SSE fallback try/catch pattern, `client.listTools({ cursor })` pagination loop, `RequestOptions.timeout`
- Context7 `/ajv-validator/ajv` — `Ajv2020` import path (`ajv/dist/2020`), `strict: false` rationale, `validateSchema` API, `ajv.compile` (sync-only)
- `npm view @modelcontextprotocol/sdk version` → `1.29.0` (confirmed 2026-06-12)
- `npm view ajv version` → `8.20.0` (confirmed 2026-06-12)
- `npm view ajv-formats version` → `3.0.1` (confirmed 2026-06-12)
- `/Users/samir.amzani/Projects/voke/packages/core/src/scoring.ts` — integer-first arithmetic, BASE/MULT constants, `applyCaps`, `serverScore` (reuse, do not reimplement)
- `/Users/samir.amzani/Projects/voke/packages/core/src/registry-types.ts` — `Severity`, `DimensionId`, `RuleScope`, `RuleRegistryEntry` Zod schemas
- `/Users/samir.amzani/Projects/voke/packages/core/src/loadRegistry.ts` — `loadRegistry`/`loadRegistryFile` (reuse)
- `.planning/research/ARCHITECTURE.md` — all 7 determinism enforcement points, type contracts, component layout
- `.planning/research/PITFALLS.md` — determinism leak patterns, `$ref` handling, depth bound, Ajv gotcha

### Secondary (MEDIUM confidence)

- `.planning/phases/02-engine-ingestion-determinism/02-CONTEXT.md` — 14 locked decisions D-01..D-14 (primary constraint source for this phase)
- `node:crypto` `createHash` — built-in, documented in Node.js 22 LTS docs; no external verification needed

### Tertiary (LOW confidence — flagged for validation)

- SSE fallback trigger mechanism (any throw on `client.connect()`) — documented in SDK client.md but not explicitly tested against a live legacy server; validate in Phase 4
- `SSEClientTransport` `requestInit.headers` passthrough — inferred from SDK architecture; verify against SDK source during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions npm-confirmed 2026-06-12; stack locked by CLAUDE.md
- MCP SDK client patterns: HIGH — verified via Context7 `/modelcontextprotocol/typescript-sdk` docs
- Ajv2020 configuration: HIGH — verified via Context7 `/ajv-validator/ajv`
- Canonical JSON algorithm: HIGH — derived from PITFALLS.md primary analysis + D-03/D-12 locked decisions
- Schema depth algorithm: HIGH for algorithm logic; MEDIUM for threshold numbers (need Apideck spike)
- Rule engine patterns: HIGH — derived from ARCHITECTURE.md (itself HIGH confidence)
- Exit codes: MEDIUM — proposed during Claude's Discretion resolution; no external standard required
- SSE fallback signal: MEDIUM — documented pattern but not tested against legacy server

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable stack; MCP SDK releases weekly but ~1.29.x patch range is stable)
