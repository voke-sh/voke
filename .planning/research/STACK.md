# Stack Research

**Domain:** TypeScript CLI tool — MCP tool-quality linter + spec (MTQS / Voke L1)
**Researched:** 2026-06-12
**Confidence:** HIGH (all versions confirmed via npm registry; client usage confirmed via Context7 against official SDK repo)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@modelcontextprotocol/sdk` | **1.29.0** | Connect to MCP servers as a client; call `tools/list`; read offline tool dumps | Only official, maintained TS client; already bundles ajv ^8.17 + ajv-formats ^3 for schema work; `StreamableHTTPClientTransport` is the primary path for deployed servers; SDK is updated weekly as of June 2026 |
| `ajv` (via `ajv/dist/2020`) | **8.20.0** | Validate that each tool's `inputSchema` / `outputSchema` is valid JSON Schema 2020-12; also use inside rule checks to type-check schema depth, detect bare-object fields, etc. | Only validator in wide use that fully implements draft-2020-12 (including `prefixItems`, `$dynamicRef`); strict mode is synchronous and deterministic; no IO unless `loadSchema` is explicitly wired — never wire it, block external refs at construction |
| `ajv-formats` | **3.0.1** | Standard format keywords (`date`, `uri`, `email`, etc.) for schema correctness rules | Companion package to ajv; v3 aligns with ajv ^8; already a peer dependency of `@modelcontextprotocol/sdk` |
| `commander` | **15.0.0** | CLI framework — `voke lint`, `--min-score`, `--output`, `--format` flags; exit codes | Zero runtime deps; the de-facto standard for single-binary TS CLIs; excellent typed option parsing; `program.error()` with custom exit codes maps cleanly onto `--min-score` gate |
| `vitest` | **4.1.8** | Unit test runner | Native ESM + TypeScript (no transform config); 5–8x faster than Jest in 2026 benchmarks; top-ranked in State of JS 2024; zero-config for a tsup-built TS project |
| `tsup` | **8.5.1** | Build: bundle TypeScript to distributable CJS + ESM with type declarations | esbuild-based, zero-config, handles dual CJS/ESM output + `.d.ts`; run `tsc --noEmit` separately for type-checking (tsup deliberately skips type errors); ideal for a CLI that ships as a single entrypoint |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | **4.4.3** | Internal config schema parsing (YAML config file, `voke.yml`) | `@modelcontextprotocol/sdk` already depends on `^3.25 || ^4.0`; use for any structured input the user controls; do NOT use Zod for MCP tool schema validation (that is ajv's job — Zod does not implement JSON Schema 2020-12) |
| `chalk` | **5.6.2** | Terminal colour in lint output (error = red, warning = yellow, info = blue) | ESM-only as of v5; pure cosmetic; conditionally disable when `NO_COLOR` or `--ci` flag is present for deterministic text output in log parsers |
| `@stoplight/spectral-core` | **1.23.0** | PATTERN ONLY — import `ISpectralDiagnostic`, `Severity` as type references; understand the shape | Do NOT embed the full engine (see Spectral decision below); use as vocabulary reference |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `typescript` | Type checking (separate from build) | Run `tsc --noEmit` in CI as a separate step; tsup handles transpilation but skips type errors |
| `npm` (not pnpm) | Package manager | Single package (not monorepo); `package-lock.json` with `--frozen-lockfile` in CI is sufficient; contributors expect `npm install` to work without extra setup; pnpm's benefits (disk deduplication) do not apply to a single-package OSS CLI |
| `actions/setup-node` v4 | GitHub Actions Node setup | Pin to `node-version: 22` (Active LTS through April 2027; Node 24 is too new for broad CI compatibility as of June 2026; Node 20 is EOL April 2026 and being removed from runner toolcache May 2026) |

---

## Key Architecture Decisions

### MCP Client: `StreamableHTTPClientTransport` + SSE fallback

**Confirmed via Context7 (official SDK repo docs/client.md, v1.29.0).**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// Primary path: Streamable HTTP (2025+ servers)
const client = new Client({ name: 'voke', version: '0.1.0' });
try {
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
  await client.connect(transport);
} catch {
  // Fallback: SSE transport (legacy servers pre-2025 RC)
  const transport = new SSEClientTransport(new URL(serverUrl));
  await client.connect(transport);
}

// Paginated tools/list — required for servers with >100 tools (e.g. 229-tool Apideck)
const allTools: Tool[] = [];
let cursor: string | undefined;
do {
  const { tools, nextCursor } = await client.listTools({ cursor });
  allTools.push(...tools);
  cursor = nextCursor;
} while (cursor);
```

**Offline / saved dump:** Accept a JSON file matching the `ListToolsResult` wire format (an array of `Tool` objects from the SDK type). Parse with `JSON.parse` + Zod schema guard — no network needed.

### JSON Schema 2020-12 Validation: `ajv/dist/2020` with external-ref blocking

**Confirmed via ajv docs + npm registry (v8.20.0, April 2026 publish).**

The MCP 2026-07-28 RC (SEP-2106) lifts `inputSchema`/`outputSchema` to full JSON Schema 2020-12. Implementations **must not** auto-deref external `$ref`. Implement by never wiring `loadSchema` — ajv's default behaviour throws a `missing schema` error for any `$ref` whose URI is not already registered. This is exactly the rule: flag any tool schema containing an external `$ref`.

```typescript
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

// Construct ONCE at module load; reuse across all tool validations (deterministic, no IO)
const ajv = new Ajv2020({
  strict: true,        // unknown keywords throw — required for determinism
  allErrors: true,     // collect every violation per schema, not just the first
  // loadSchema: NOT SET — external $ref will throw; that IS the rule check
});
addFormats(ajv);
```

For the "schema correctness" MTQS dimension: attempt `ajv.compile(tool.inputSchema)` and collect errors. For "bounded depth": walk the schema object recursively without compiling; ajv is not involved.

**Do not use `ajv.compileAsync`** — it enables remote loading, breaks determinism.

### Spectral: imitate the pattern, do NOT embed the engine

**Decision: hand-roll a Spectral-shaped rule engine.**

Rationale from investigation:

1. **Bundle weight.** `@stoplight/spectral-core` at v1.23.0 has an unpacked size of ~204 KB plus heavy transitive dependencies: `jsonpath-plus`, `nimma`, `lodash`, `expr-eval-fork`, `ajv-errors`, multiple `@stoplight/*` packages. For a CLI that ships as a single compiled bundle, this adds ~1–2 MB of dead weight. Spectral is built to lint YAML/JSON *documents* identified by a URI with JSONPath `given` selectors traversing OpenAPI/AsyncAPI trees. MCP tools are small, structured TypeScript objects — JSONPath selectors are overkill.

2. **Targeting mismatch.** Spectral's `given` uses JSONPath to select nodes from a parsed YAML/JSON document. MTQS rules target typed `Tool` objects in memory. The overhead of parsing, resolving, and traversing a JSONPath expression to reach `tool.inputSchema.properties` is unnecessary when you can just write `tool.inputSchema?.properties`.

3. **The Spectral interface is the right interface.** The rule shape is excellent: `{ id, severity, message, given, then: function }`. Implement exactly this interface natively in ~100 lines of TypeScript. This gives the exact developer ergonomics (custom/vendor rules feel native to AsyncAPI TSC audience) without the dependency surface.

4. **What to borrow from Spectral.** Import `Severity` enum shape and `ISpectralDiagnostic` as naming/typing inspiration. The result type each rule produces maps to: `{ ruleId, severity, message, path, tool }`.

**The hand-rolled engine is:**
```typescript
type Severity = 'error' | 'warning' | 'info' | 'hint';

interface RuleFinding {
  ruleId: string;
  severity: Severity;
  message: string;
  path: string[];      // e.g. ['tools', 'get_user', 'inputSchema', 'properties', 'user']
  toolName: string;
}

interface Rule {
  id: string;
  severity: Severity;
  description: string;
  check: (tool: Tool, server: ServerContext) => RuleFinding[];
}
```

This is ~50 lines. Spectral's engine is 5000+ lines because it handles YAML parsing, JSONPath, ruleset loading from URLs, and document URI resolution — none of which voke needs.

---

## Installation

```bash
# Runtime dependencies
npm install @modelcontextprotocol/sdk ajv ajv-formats commander chalk zod

# Dev dependencies
npm install -D typescript tsup vitest @types/node
```

The MCP SDK already pulls in `ajv ^8.17.1` and `ajv-formats ^3.0.1` as runtime deps, so those are already in the closure. Declaring them explicitly as direct deps is still correct (version pinning, explicit intent).

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `commander` v15 | `yargs` | yargs has more runtime dependencies; commander's TypeScript types are cleaner; neither has a technical advantage for a simple `lint` subcommand |
| `commander` v15 | `clipanion` | clipanion is excellent but adds class-based API surface; overkill for a CLI with one primary command |
| `ajv/dist/2020` | `@cfworkers/json-schema` | MCP SDK itself already has `/validation/cfworker` export but it's experimental; ajv is the standard, fully documented, and stable at 8.20.0 |
| `ajv/dist/2020` | `hyperjump/json-schema` | Less adoption, less documentation; ajv is already a transitive dep via the SDK |
| Hand-rolled rule engine | `@stoplight/spectral-core` embedded | ~1.5 MB of dependencies for a feature set we use at 5%; JSONPath overkill for typed TS objects; see full analysis above |
| `vitest` | `jest` | jest requires ts-jest or @swc/jest for TypeScript; vitest works out-of-the-box; 5x faster; no React Native target to constrain us |
| `tsup` | `tsc` (emit only) | tsc does not bundle; CLI needs a single dist entry; tsup (esbuild) is zero-config and 45x faster at transpilation |
| `npm` | `pnpm` | Single-package OSS CLI; contributor friction of non-npm tooling outweighs disk savings; lockfile determinism achieved with `--frozen-lockfile` |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@stoplight/spectral-core` as the linter engine | 204 KB unpacked, lodash + jsonpath-plus + nimma transitive deps; built for YAML document linting, not typed TS objects; the pattern is the value, not the runtime | Hand-rolled Spectral-shaped rule engine (~50 lines) |
| `ajv.compileAsync` / wiring `loadSchema` | Enables remote IO during schema validation → breaks determinism; also a security surface | `ajv.compile` (sync only); flag any schema with unresolved external `$ref` as an MTQS error |
| `zod` for MCP `inputSchema` / `outputSchema` validation | Zod implements its own schema language, not JSON Schema 2020-12; cannot validate arbitrary user-supplied JSON Schema | `ajv/dist/2020` — the right tool for JSON Schema validation |
| `json-schema-ref-parser` (inline/deref before validation) | Auto-dereffing external `$ref` is exactly what the MCP 2026-07-28 RC says implementations must NOT do; also breaks determinism if the remote ref changes | Validate schemas with external refs as-is; flag the external `$ref` as an MTQS error |
| `esbuild` directly | tsup wraps esbuild with type declaration generation and saner defaults; no reason to use esbuild raw | `tsup` |
| Node 20 | EOL April 2026; removed from GitHub Actions runner toolcache May 2026 | Node 22 (Active LTS through April 2027) |
| Node 24 | Too new as of June 2026 for broad contributor compatibility | Node 22 |
| Any LLM API / AI SDK | Non-determinism in L1 is a trust failure; the entire competitive wedge vs Glama is reproducibility | Pure TypeScript logic only in rule checks |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@modelcontextprotocol/sdk` ^1.29.0 | `ajv` ^8.17.1, `ajv-formats` ^3.0.1, `zod` ^3.25 or ^4.0 | SDK declares these as runtime deps; declaring them directly is safe (will resolve same versions) |
| `ajv` ^8.20.0 | `ajv-formats` ^3.0.1 | ajv-formats v3 is the correct companion for ajv v8; do not use ajv-formats v2 (targets ajv ≤7) |
| `@stoplight/spectral-core` ^1.23.0 | `ajv` ^8.18.0 (its own dep) | If you ever install spectral-core, its ajv peer will coexist fine since both want ^8.x; only relevant if type-borrowing requires installing the package |
| `tsup` ^8.5.1 | `vitest` ^4.1.8 | No known conflicts; both use esbuild internally but independently |
| `commander` ^15.0.0 | Node >=18 | commander 15 dropped Node 16 support; align with SDK's `engines: >=18` |

---

## Determinism Risk Register

These are the specific choices that could silently break the "same input → same output" guarantee:

| Risk | Source | Mitigation |
|------|--------|------------|
| External `$ref` in tool schema fetched at runtime | `ajv.compileAsync` + `loadSchema` | Never wire `loadSchema`; use `ajv.compile` (sync); treat unresolved external `$ref` as an MTQS error, not a validation skip |
| Non-deterministic tool ordering from `listTools` | MCP protocol does not guarantee order | Sort `allTools` by `tool.name` alphabetically before scoring; document this in spec |
| Network call during rule check | Any rule that calls fetch/http | Lint rules must be pure functions of the tool object; no IO in rule bodies |
| `chalk` colour codes in score output affecting grep/diff | ANSI escape sequences in piped output | Respect `NO_COLOR` env var; add `--no-color` / `--ci` flag; never colour the score line itself |
| SDK version drift changing `Tool` type shape | `@modelcontextprotocol/sdk` minor updates | Pin to a specific minor in `package.json` (`~1.29.0`, not `^1.29.0`) for stable CI; accept patch updates |

---

## Sources

- `/modelcontextprotocol/typescript-sdk` via Context7 — `client.md`, `client-quickstart.md` (StreamableHTTPClientTransport, listTools pagination); confirmed v1.29.0 on npm registry (published 2026-06-04)
- `/ajv-validator/ajv` via Context7 — draft 2020-12 support, strict mode options, `$ref` handling; confirmed v8.20.0 on npm registry (published 2026-04-24)
- npm registry direct (`npm view`) — versions for all packages confirmed 2026-06-12
- WebSearch: Spectral programmatic API, bundle dependencies (v1.23.0, published 2026-05-12)
- WebSearch: tsup vs tsc 2026 — tsup/esbuild for CLI build; tsc --noEmit for type-checking
- WebSearch: vitest vs jest 2026 — vitest top-ranked State of JS 2024; 5.6x faster cold starts
- WebSearch: GitHub Actions Node LTS — Node 20 EOL April 2026; runner default moving to Node 22 (May 2026); Node 22 active LTS through April 2027
- WebSearch: pnpm vs npm 2026 — npm recommended for single-package OSS for contributor accessibility

---
*Stack research for: Voke L1 — MTQS linter + CLI (TypeScript)*
*Researched: 2026-06-12*
