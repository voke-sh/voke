# Phase 5: CI + Publication - Research

**Researched:** 2026-06-13
**Domain:** stdio MCP transport, GitHub Actions composite action, npm publish, VitePress static site
**Confidence:** HIGH (verified against SDK source, npm registry, GitHub Actions docs, Context7)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### stdio ingestion (ING-06)
- **D-01:** Invocation syntax is `voke lint -- <cmd args...>` — everything after `--` is the subprocess command and its args. NOT a `--stdio` flag, NOT a `stdio:` scheme.
- **D-02:** Subprocess inherits parent environment, plus repeatable `--env KEY=VAL` to add/override. `--env` values are masked in all output (same masking as `--header`, carries D-09 from Phase 2).
- **D-03:** stdio must produce the same canonicalized tool surface as live/offline modes and reuse the existing pipeline. Integration seam: `resolve-target.ts` SCHEME_HANDLERS + TransportKind — add a `stdio` kind. Subprocess torn down deterministically (no orphan process), output byte-identical x3 (carries D-12).
- Carry-forward from Phase 2 (apply, do not re-ask): fail-fast no-retry (D-08), abort-on-partial-page (D-10), distinct exit codes per failure class, header/token masking (D-09).

#### GitHub Action (CI-01, CI-02)
- **D-04:** Packaging is a composite `action.yml` that runs `npx voke@<ver> lint ...` via `actions/setup-node` (Node 22). No Docker, no committed JS bundle.
- **D-05:** This requires publishing `voke` to npm (the Action's `npx` and the README `npx voke lint` one-liner both depend on it). npm publish is in-scope for this phase.
- **D-06:** `action.yml` lives at the root of the same `voke-sh/voke` repo as the linter.
- **D-07:** README/quickstart recommends major-tag pinning `uses: voke-sh/voke@v1` (moving tag, auto patches/minors). Mention full-SHA pinning as the security-conscious option. Action exposes a `min-score` input.

#### Spec publication (PUB-01)
- **D-08:** Publish as a dedicated static docs site built with VitePress, deployed to voke.sh/spec.
- **D-09:** Spec lives in the same repo as the linter.
- **D-10:** Versioned files, keep all. `spec/MTQS-v0.1.md` stays immutable/live; future versions added alongside.

#### README + repo readiness (CI-02, PUB-02)
- **D-11:** README quickstart leads with the GitHub Action YAML snippet.
- **D-12:** License: Apache-2.0 for both linter and spec.
- **D-13:** CONTRIBUTING.md + rule PR template emphasize primary-source citation (never Glama), positive + negative fixtures, determinism preservation.

### Claude's Discretion
- Exact subprocess teardown mechanism (signal, timeout, orphan-prevention) for deterministic stdio shutdown
- stdio transport wiring via MCP SDK's `StdioClientTransport`
- Exact `action.yml` input/output schema beyond `min-score` (e.g. `target`, `format`, `args`)
- VitePress config specifics (theme, nav, version dropdown, voke.sh domain/CNAME + deploy target)
- Rule PR template field set; CONTRIBUTING.md section structure; npm package metadata (scope, bin, files, provenance)
- The exact distinct exit code assigned to stdio launch/teardown failures

### Deferred Ideas (OUT OF SCOPE)
- Launch blog post + live Apideck demo run — Phase 6
- Spec-change governance process (proposal/review/versioning workflow for MTQS evolution) — beyond v0.1 launch
- Split-licensing (Apache spec / MIT code) — rejected for single Apache-2.0 simplicity
- Second public MCP server run — Phase 6 DoD
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ING-06 | Ingest from a stdio MCP server launched as a subprocess (`voke lint -- <cmd>`) — enables hermetic CI and local dev loop for stdio-only servers; same canonicalized surface as live/offline modes; subprocess torn down deterministically | SDK `StdioClientTransport` wiring; process-group teardown pattern; `--` passthrough in commander; `--env` masking; new `stdio` TransportKind in SCHEME_HANDLERS |
| CI-01 | A GitHub Action wrapper + YAML config runs `voke lint` in CI and fails the build below threshold | Composite `action.yml` pattern; `actions/setup-node@v4` Node 22; `npx voke@<ver>` invocation; `min-score` input maps to `--min-score` flag |
| CI-02 | README doubles as the demo (copy-paste runnable) | Action YAML snippet in README; zero-modification runnable; major-tag pinning pattern |
| PUB-01 | MTQS spec is published and versioned at voke.sh/spec in a public repo accepting PRs | VitePress config; GitHub Pages CNAME; GitHub Actions deploy workflow; versioned file layout |
| PUB-02 | CONTRIBUTING.md + a rule PR template exist before the repo goes public | Rule PR template fields; CONTRIBUTING.md section structure; SCOPE.md §4 primary-source citation gate |
</phase_requirements>

---

## Summary

Phase 5 has four distinct integration areas that compose into the v0.1 public launch: stdio ingestion, a GitHub Action wrapper, npm publication, and a VitePress spec site.

The most technically nuanced area is **stdio teardown**. The MCP SDK `StdioClientTransport.close()` (v1.29.0, confirmed in installed source) implements a three-stage shutdown: close stdin → await 'close' event with 2s timeout → SIGTERM if still alive → await 2s → SIGKILL. This is sufficient for deterministic teardown for `voke`'s single-tool-surface-fetch use case, because `client.close()` is called once after `listTools` completes and the transport closes stdin first (a clean signal to cooperative servers). The known orphan-process issue (SDK issue #2023) affects wrapper commands like `npx` or `uvx` that spawn a child of a child; for the voke use case, this is the caller's responsibility — `voke lint -- node server.js` spawns Node directly, which handles SIGTERM. Add a `StdioLaunchError` (exit code 8) for subprocess launch failure and a `StdioTeardownError` (exit code 9) for teardown failure after ingest completes.

The **npm package name `voke` is already taken** on npm (an MIT event-emitter package by KingPixil, v1.0.2). The linter must be published as a scoped package: **`@voke-sh/voke`** (scope aligns with the GitHub org `voke-sh`). `@voke-sh/voke` is confirmed available. `voke-lint` is also available as fallback. Use `@voke-sh/voke` — it matches the `uses: voke-sh/voke@v1` Action reference and keeps npm + GitHub collocated.

The **GitHub Action composite pattern** is well-understood: `action.yml` at repo root, `runs.using: composite`, each `run` step must explicitly declare `shell: bash`. The Action calls `actions/setup-node@v4` with `node-version: '22'` then runs `npx @voke-sh/voke@latest lint ...`. Input type constraint: composite actions accept only string inputs (no boolean/number types). The `min-score` input is a string that maps directly to the CLI `--min-score` flag.

**VitePress 1.6.4** (current on npm) is straightforward for this use case. The spec site lives in `docs/` at repo root, builds with `vitepress build docs`, deploys to GitHub Pages with a standard workflow, and uses a `CNAME` file in `docs/public/` for the `voke.sh` custom domain. For v0.1, the version "dropdown" is a simple nav link list (v0.1 is the only version); a full switcher plugin is deferred until v0.2 ships.

**Primary recommendation:** Publish as `@voke-sh/voke`. Wire `StdioClientTransport` with the SDK's own three-stage teardown; add exit codes 8 (launch failure) and 9 (teardown error). Deploy VitePress to GitHub Pages with CNAME for `voke.sh`. The composite Action runs `npx @voke-sh/voke@latest lint`.

---

## Standard Stack

### Core (no new runtime deps required)

All Phase 5 work uses libraries already in the project. No new runtime dependencies needed.

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `@modelcontextprotocol/sdk` | `~1.29.0` (pinned) | `StdioClientTransport` for subprocess stdio ingestion | Already in `packages/linter/package.json` |
| `commander` | `15.0.0` | `--` passthrough args parsing; `--env KEY=VAL` repeatable flag | Already wired in `program.ts` |
| `chalk` | `5.6.2` | Output coloring (masking of `--env` values follows same pattern as `--header`) | Already in project |

### New Dev / Infrastructure Dependencies

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `vitepress` | `1.6.4` | Static docs site for spec publication | Dev dependency in root workspace or `docs/` package |

### Verified Package Name

| Package | npm Status | Notes |
|---------|-----------|-------|
| `voke` | **TAKEN** (v1.0.2, MIT event-emitter, KingPixil) | Cannot publish as `voke` |
| `@voke-sh/voke` | **Available** | Recommended; matches GitHub org `voke-sh/voke` |
| `voke-lint` | Available | Fallback only; loses brand alignment |

**Installation (docs site only — runtime deps already present):**
```bash
npm install --save-dev vitepress@1.6.4
```

**Version verification:**
```bash
npm view @modelcontextprotocol/sdk version  # 1.29.0
npm view vitepress version                   # 1.6.4
# voke is taken: npm view voke              # 1.0.2 (not ours)
# @voke-sh/voke is available
```

---

## Architecture Patterns

### Recommended Project Structure (additions for Phase 5)

```
/                              # repo root
├── action.yml                 # GitHub Actions composite action (new)
├── LICENSE                    # Apache-2.0 (new)
├── README.md                  # leads with Action YAML snippet (new)
├── CONTRIBUTING.md            # rule PR rigor (new)
├── .github/
│   ├── ISSUE_TEMPLATE/        # (optional)
│   └── pull_request_template/
│       └── rule_pr.md         # enforces primary-source citation (new)
├── docs/                      # VitePress source (new)
│   ├── .vitepress/
│   │   └── config.ts          # minimal VitePress config
│   ├── public/
│   │   └── CNAME              # "voke.sh"
│   └── spec/                  # symlink or copy of spec/
│       ├── index.md           # versions landing page
│       └── v0.1/
│           ├── MTQS-v0.1.md   # immutable spec
│           └── SCOPE.md       # immutable scope
├── spec/                      # source-of-truth spec files (unchanged)
├── packages/
│   └── linter/
│       ├── package.json       # name changed to @voke-sh/voke, private: false
│       └── src/
│           ├── cli/
│           │   └── program.ts # -- passthrough + --env wired
│           ├── ingestion/
│           │   ├── mcp-client.ts      # StdioClientTransport added
│           │   └── stdio-client.ts    # new: ingestStdio()
│           └── cli/
│               └── resolve-target.ts  # stdio kind added
└── .github/workflows/
    ├── ci.yml                 # existing test CI
    ├── publish.yml            # npm publish on GitHub release (new)
    └── docs.yml               # VitePress build + deploy to GitHub Pages (new)
```

### Pattern 1: stdio ingestion via `StdioClientTransport`

**What:** Wire `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js`. The transport spawns the subprocess, communicates over stdin/stdout, and implements a three-stage close: stdin-end → 2s wait → SIGTERM → 2s wait → SIGKILL.

**When to use:** When `resolveTarget` returns `kind: 'stdio'` (triggered by `--` separator in argv).

**Key SDK behavior (verified against installed v1.29.0 source):**
- `env` parameter: the SDK merges `getDefaultEnvironment()` (safe inherited vars: PATH, HOME, etc.) with the provided `env` object. If the caller passes `env`, only those explicit keys override the defaults; the safe defaults are always present. This is the correct behavior for `--env KEY=VAL` — pass the merged env.
- `stderr`: defaults to `'inherit'` (server's stderr flows to voke's stderr). Keep default for transparency.
- `close()` three-stage teardown: close stdin → await `close` event (2s timeout) → `processToClose.kill('SIGTERM')` → await 2s → `processToClose.kill('SIGKILL')`. This is already deterministic for direct-process invocations.

```typescript
// Source: packages/linter/src/ingestion/mcp-client.ts (pattern extension)
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface IngestStdioOptions {
  /** Parsed subprocess command (argv[0] after --) */
  command: string;
  /** Subprocess args (argv[1..] after --) */
  args: string[];
  /**
   * Extra env vars from --env KEY=VAL flags (values are MASKED in all output).
   * The SDK merges getDefaultEnvironment() with this — parent PATH/HOME etc. are always present.
   */
  extraEnv?: Record<string, string>;
  /** Per-request timeout in ms; defaults to LIST_TOOLS_TIMEOUT_MS (30000). */
  timeoutMs?: number;
}

// In ingestStdio():
const transport = new StdioClientTransport({
  command: opts.command,
  args: opts.args,
  env: opts.extraEnv,   // SDK merges with getDefaultEnvironment() automatically
  // stderr: 'inherit' (default) — server stderr flows to voke stderr for transparency
} satisfies StdioServerParameters);

const client = new Client({ name: 'voke', version: VOKE_VERSION });
try {
  await client.connect(transport);   // throws if spawn fails
} catch (err) {
  throw new StdioLaunchError(opts.command, err);  // exit 8
}

const rawTools = await fetchAllTools(client, opts.timeoutMs);
// ... same canonicalization pipeline as ingestLive ...

try {
  await client.close();
} catch (err) {
  throw new StdioTeardownError(opts.command, err);  // exit 9
}
```

**Source:** Installed SDK source `node_modules/@modelcontextprotocol/sdk/dist/cjs/client/stdio.js` — confirmed v1.29.0.

### Pattern 2: `--` passthrough in commander + `--env` flag

**What:** Commander v15 supports `allowExcessArguments` and `passThroughOptions` for `--` passthrough. After `lint`, everything after `--` is captured as the stdio command.

```typescript
// Source: packages/linter/src/cli/program.ts (extension)
program
  .command('lint')
  .argument('<target>', 'MCP server URL, snapshot file, or "--" to use stdio (see -- <cmd>)')
  .option('--env <KEY=VAL>', 'extra env var for stdio subprocess (repeatable; values masked)', collect, [])
  .allowExcessArguments(true)
  .passThroughOptions(true)
  // ...

// In action handler: detect stdio mode when target is "--" or collect post-"--" args
// Commander: process.argv will contain everything after "--" as raw args
// Use program.args to capture the remainder after "--"
```

**Commander `--` note:** The idiomatic approach is to parse `process.argv` and split at `--` before passing to commander, extracting `stdioCmd = argv.slice(argv.indexOf('--') + 1)`. This is simpler than `passThroughOptions`.

```typescript
// In cli/index.ts (pre-commander split):
const dashDashIdx = process.argv.indexOf('--');
const stdioArgs = dashDashIdx !== -1 ? process.argv.slice(dashDashIdx + 1) : undefined;
const cleanArgv = dashDashIdx !== -1 ? process.argv.slice(0, dashDashIdx) : process.argv;
await buildProgram(stdioArgs).parseAsync(cleanArgv);
```

### Pattern 3: `resolve-target.ts` SCHEME_HANDLERS extension for stdio

**What:** When `stdioArgs` are present (i.e., `--` was in argv), the target resolution is bypassed entirely — no `<target>` positional needed. The `resolveTarget` function gains a new return kind `'stdio'`.

```typescript
// Source: packages/linter/src/cli/resolve-target.ts
export type TransportKind = 'live' | 'file' | 'stdio';

export interface ResolvedTarget {
  kind: TransportKind;
  target: string;
  /** Only present when kind === 'stdio' */
  stdioArgs?: string[];
}

// When resolveTarget is called with a special sentinel or when kind='stdio' is
// determined upstream (before resolveTarget), pass stdioArgs through to RunLintOpts.
```

**Simpler approach (recommended):** The `run-lint.ts` RunLintOpts gains an optional `stdioArgs?: string[]`. When `stdioArgs` is set, bypass `resolveTarget` entirely and go straight to `ingestStdio`. The planner can decide exact wiring during planning.

### Pattern 4: GitHub Actions composite action (`action.yml`)

**What:** A composite action that sets up Node 22, then runs `npx @voke-sh/voke@latest lint` with the user's inputs.

**Mandatory constraint:** Every `run` step in a composite action MUST declare `shell: bash` explicitly. Inputs are strings only — no boolean or number types allowed.

```yaml
# Source: GitHub Actions composite action documentation (verified 2026)
# File: action.yml (repo root)
name: 'Voke MCP Linter'
description: 'Run voke lint on an MCP server and fail the build below a score threshold'
author: 'voke-sh'

inputs:
  target:
    description: 'MCP server URL, snapshot file path, or "--" for stdio mode'
    required: true
  min-score:
    description: 'Fail the build if server score is below this threshold (0-100)'
    required: false
    default: '0'
  format:
    description: 'Output format: human | json'
    required: false
    default: 'human'
  args:
    description: 'Additional CLI args passed verbatim to voke lint (e.g. "--header Authorization: Bearer $TOKEN")'
    required: false
    default: ''
  version:
    description: 'voke version to use (e.g. "latest" or "0.1.0")'
    required: false
    default: 'latest'

outputs:
  score:
    description: 'The server score (0-100) from the lint run'
    value: ${{ steps.lint.outputs.score }}

runs:
  using: 'composite'
  steps:
    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22'

    - name: Run voke lint
      id: lint
      shell: bash
      run: |
        npx @voke-sh/voke@${{ inputs.version }} lint \
          ${{ inputs.target }} \
          --min-score ${{ inputs.min-score }} \
          --output ${{ inputs.format }} \
          --ci \
          ${{ inputs.args }}
```

**Major-tag workflow** (for `uses: voke-sh/voke@v1`): After publishing a GitHub release tag `v0.1.0`, create/update a moving tag `v0` pointing to the same commit. Use `actions/github-script` or a simple git push in the release workflow:

```bash
git tag -fa v0 -m "Update v0 tag"
git push origin v0 --force
```

Note: For a v0.1 initial release, the moving tag is `v0` (not `v1`). The README should recommend `uses: voke-sh/voke@v0`.

### Pattern 5: npm publish in GitHub Actions

**What:** Trigger on GitHub release published. Run from `packages/linter/` workspace. Use `--provenance` for supply-chain attestation.

```yaml
# File: .github/workflows/publish.yml
name: Publish to npm
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write   # required for npm provenance
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
        shell: bash
      - run: npm --workspace @voke/linter run build
        shell: bash
      - run: npm publish --workspace @voke/linter --provenance --access public
        shell: bash
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**package.json changes required:**
```json
{
  "name": "@voke-sh/voke",
  "version": "0.1.0",
  "private": false,
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "files": ["dist"],
  "bin": { "voke": "./dist/cli/index.js" }
}
```

**Source:** npm docs (https://docs.npmjs.com/generating-provenance-statements/); GitHub Docs (https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages). Confirmed: `--provenance` requires `id-token: write` permission.

### Pattern 6: VitePress docs site structure

**What:** Minimal VitePress config for `docs/` dir. The spec files are referenced/symlinked into `docs/spec/`. GitHub Actions deploys to GitHub Pages; `CNAME` file routes `voke.sh` custom domain.

```typescript
// docs/.vitepress/config.ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'MTQS',
  description: 'MCP Tool Quality Specification',
  base: '/',  // root — custom domain, not subpath
  themeConfig: {
    nav: [
      { text: 'Spec', link: '/spec/' },
      { text: 'GitHub', link: 'https://github.com/voke-sh/voke' },
    ],
    sidebar: {
      '/spec/': [
        { text: 'Versions', link: '/spec/' },
        {
          text: 'v0.1',
          items: [
            { text: 'MTQS Specification', link: '/spec/v0.1/MTQS-v0.1' },
            { text: 'Scope', link: '/spec/v0.1/SCOPE' },
          ]
        }
      ]
    }
  }
})
```

```
docs/
├── .vitepress/
│   └── config.ts
├── public/
│   └── CNAME           # contains exactly: voke.sh
├── index.md            # site landing page
└── spec/
    ├── index.md        # "Versions" list page — permanent links to each version
    └── v0.1/
        ├── MTQS-v0.1.md  # copied from spec/ during build (or symlinked)
        └── SCOPE.md      # copied from spec/ during build
```

**Key insight:** `spec/MTQS-v0.1.md` must NOT be deleted from `spec/` — it stays there as the source of truth. The `docs/spec/v0.1/` directory contains copies (or symlinks) for VitePress rendering. The build script can copy during `docs:build`.

### Anti-Patterns to Avoid

- **`voke lint stdio://node server.js`** — rejected by D-01; the `--` syntax is the locked decision.
- **`--stdio` flag** — rejected by D-01; `--` passthrough is the standard convention.
- **`ajv.compileAsync` or `loadSchema` in any new rule** — never wire; determinism violation.
- **Using Docker image in `action.yml`** — rejected by D-04; npx composite is lighter.
- **Committing `dist/` to the repo for the Action** — rejected by D-04; npx fetches from npm.
- **Publishing as unscoped `voke`** — name is taken on npm.
- **Dereferencing spec files in VitePress** — keep `spec/MTQS-v0.1.md` immutable in `spec/`; copy into `docs/` for rendering only.
- **Using `npm publish` from workspace root without `--workspace`** — root `package.json` is `private: true`; use `--workspace @voke/linter`.
- **Spawning subprocess with `shell: true`** — shell wrapper creates additional child processes that are not in the direct child PID, exacerbating orphan-process risk.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| stdio subprocess lifecycle | Custom spawn/kill wrapper | `StdioClientTransport` from SDK | SDK already implements 3-stage teardown (stdin-end → SIGTERM → SIGKILL with timeouts); any custom wrapper would miss edge cases |
| Env var safe inheritance | Manual `process.env` copy with deny-list | SDK's `getDefaultEnvironment()` | Already implemented; picks up correct platform-specific safe vars (PATH, HOME, etc.) merged with user `--env` additions |
| npm package publishing | Manual `npm publish` scripts | Standard `npm publish --workspace` with `--provenance` flag | Provenance attestation is one flag; workflow is 10 lines |
| VitePress custom version switcher | Custom Vue component | Simple nav links for v0.1; `@viteplus/versions` plugin if needed for v0.2 | v0.1 has one version; a full switcher is premature optimization |
| GitHub major-tag management | Manual tag deletion scripts | `git tag -fa v0 && git push origin v0 --force` in release workflow | Two git commands; no action needed |
| Apache-2.0 license text | Writing license from scratch | Copy from https://www.apache.org/licenses/LICENSE-2.0.txt | Standard text, must be verbatim |

**Key insight:** The SDK's `StdioClientTransport` already handles the hardest parts of subprocess lifecycle management. Wrap it, don't replace it.

---

## Common Pitfalls

### Pitfall 1: npm package name collision (`voke` is taken)
**What goes wrong:** `npm publish` fails with 403 — package name `voke` is owned by KingPixil (v1.0.2, MIT event-emitter).
**Why it happens:** The current `packages/linter/package.json` has `"name": "@voke/linter"` but the intended published name was `voke`. Didn't check registry first.
**How to avoid:** Publish as `@voke-sh/voke`. Change `packages/linter/package.json` `name` to `@voke-sh/voke` and add `"private": false`. The npm org `voke-sh` must be created and the token must have publish rights to that scope.
**Warning signs:** Any plan that uses the unscoped name `voke` in `npm publish` will fail.

### Pitfall 2: Orphan processes with wrapper commands (npx, uvx, python -m)
**What goes wrong:** `voke lint -- npx @modelcontextprotocol/server-filesystem /` launches `npx` as the direct child; `npx` then spawns the actual server. On `client.close()`, only `npx` receives SIGTERM. The actual server process becomes an orphan.
**Why it happens:** SDK `close()` calls `processToClose.kill('SIGTERM')` on the direct child PID only — no process group kill.
**How to avoid:** Document in the README that `voke lint -- <cmd>` works best with direct process invocations (e.g. `node server.js`, `python server.py`). For wrapper invocations, the subprocess gets SIGTERM; cooperative wrappers (npx) forward it. This is acceptable for v0.1 CI use — the process exits after `listTools`, so any orphan from the tool is short-lived. Add a warning in stderr output if the close() takes longer than expected.
**Warning signs:** Tests that check "no leftover processes" after stdio runs against npx-wrapped servers.

### Pitfall 3: SDK env parameter replaces (not supplements) `getDefaultEnvironment()`
**What goes wrong:** When `StdioServerParameters.env` is provided, the SDK merges `getDefaultEnvironment()` WITH the user's `env`. This is correct behavior. However, if the caller passes the full `process.env`, it overwrites the safe-filtered defaults and may leak secrets.
**Why it happens:** SDK source: `env: { ...getDefaultEnvironment(), ...this._serverParams.env }`. If caller passes `process.env` directly, all env vars are forwarded including secrets.
**How to avoid:** Pass ONLY the `--env KEY=VAL` additions from the CLI flags as `extraEnv`. Never pass `process.env` directly to `StdioClientTransport`. The SDK handles safe inheritance of PATH, HOME, etc. automatically.
**Warning signs:** `--env` handling that merges with `process.env` before passing to SDK.

### Pitfall 4: `--env` values appearing in error messages or output
**What goes wrong:** Error messages like `StdioLaunchError: failed to spawn 'node server.js' with env {DATABASE_URL: 'postgres://user:password@host/db'}` leak secrets.
**Why it happens:** Env values passed as `extraEnv` are not masked unless the masking function is applied before stringifying.
**How to avoid:** Apply the same `maskHeaders`-style masking to `extraEnv` values: replace all values with `[MASKED]` before including in any error message, log, or output. The function is already in `mcp-client.ts`.
**Warning signs:** Any new error class that formats `opts.extraEnv` in its message.

### Pitfall 5: composite `action.yml` missing `shell:` on `run` steps
**What goes wrong:** GitHub Actions rejects the composite action with a validation error: "shell is required when run is provided."
**Why it happens:** Composite actions require explicit `shell:` on every `run` step (unlike normal workflow steps where it defaults to bash on Linux).
**How to avoid:** Always add `shell: bash` to every `run` step in `action.yml`.
**Warning signs:** Action fails on first use with a YAML validation error about missing shell.

### Pitfall 6: `npm publish` from workspace root publishes wrong package
**What goes wrong:** Running `npm publish` from the root publishes the root `voke` workspace, which is `private: true` and will error — OR if `private: true` is removed, publishes the monorepo root, which is not the CLI.
**Why it happens:** Root `package.json` is a workspace coordinator, not a publishable package.
**How to avoid:** Always use `npm publish --workspace @voke/linter` (or `cd packages/linter && npm publish`). Alternatively use `npm publish --workspace @voke-sh/voke` after renaming.
**Warning signs:** Release workflow that runs bare `npm publish` from repo root.

### Pitfall 7: VitePress `base` misconfiguration for custom domain
**What goes wrong:** Links in the deployed site are broken (double-slash, wrong paths) because `base` is set to `/voke/` (the GitHub repo name path) when using a custom domain.
**Why it happens:** `base` is only needed for subdirectory deployments like `user.github.io/repo/`. With a custom domain (`voke.sh`), the site is at root, so `base` must be `'/'` (or omitted, as `'/'` is the default).
**How to avoid:** Set `base: '/'` in VitePress config when using a custom domain (voke.sh).
**Warning signs:** 404s on CSS/JS assets; all nav links have `/voke/` prefix.

### Pitfall 8: `CNAME` file lost on GitHub Pages re-deploy
**What goes wrong:** After the first deploy that manually sets a custom domain in GitHub UI, subsequent pushes from the workflow overwrite `CNAME` if it's not committed in the build output.
**Why it happens:** GitHub Pages workflow uploads the VitePress `dist/` artifact, which doesn't include `CNAME` unless placed in `docs/public/`.
**How to avoid:** Place `CNAME` in `docs/public/CNAME` (VitePress copies `public/` contents verbatim to `dist/`). Do not rely on the GitHub UI setting alone.
**Warning signs:** After a re-deploy, the site returns to `voke-sh.github.io` instead of `voke.sh`.

### Pitfall 9: `packages/linter/package.json` still has `"private": true` at publish time
**What goes wrong:** `npm publish --workspace @voke/linter` fails with "Cannot publish private package."
**Why it happens:** The current `packages/linter/package.json` has `"private": true`.
**How to avoid:** Remove `"private": true` from `packages/linter/package.json` and set `"name": "@voke-sh/voke"` with `"publishConfig": { "access": "public" }`.
**Warning signs:** `npm publish` exits with error about private packages.

### Pitfall 10: Determinism broken by subprocess-injected timestamps
**What goes wrong:** A stdio server that injects a `capturedAt`-like timestamp into its tool descriptions produces different output across runs, breaking the byte-identical x3 test.
**Why it happens:** The determinism contract covers the voke pipeline (sorting, scoring, formatting) — it cannot prevent a server from returning non-deterministic tool names/descriptions across connections.
**How to avoid:** The determinism acceptance test for stdio must use a deterministic stdio fixture server (a local Node.js script that always returns the same fixed tool list). Never test determinism against a real running server.
**Warning signs:** Flaky byte-identical x3 test for stdio mode.

---

## Code Examples

### StdioClientTransport — minimal wiring

```typescript
// Source: @modelcontextprotocol/sdk/dist/cjs/client/stdio.js (v1.29.0, installed)
// Import path for ESM (tsup will bundle this):
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['server.js', '--port', '0'],
  env: { MY_KEY: 'MY_VAL' },  // SDK merges with getDefaultEnvironment() automatically
  // stderr: 'inherit' (default) — server's stderr flows to voke's stderr
});
const client = new Client({ name: 'voke', version: VOKE_VERSION });
await client.connect(transport);  // spawns subprocess; throws if spawn fails
// ... listTools ...
await client.close();  // 3-stage teardown: stdin-end → 2s → SIGTERM → 2s → SIGKILL
```

### SDK close() three-stage teardown (confirmed from installed source)

```javascript
// Source: node_modules/@modelcontextprotocol/sdk/dist/cjs/client/stdio.js, lines 144-175
async close() {
  if (this._process) {
    const processToClose = this._process;
    this._process = undefined;
    const closePromise = new Promise(resolve => {
      processToClose.once('close', () => { resolve(undefined); });
    });
    processToClose.stdin?.end();
    // Stage 1: wait for close event (2s timeout)
    await Promise.race([closePromise, new Promise(resolve => setTimeout(resolve, 2000).unref())]);
    if (processToClose.exitCode === null) {
      // Stage 2: SIGTERM
      processToClose.kill('SIGTERM');
      await Promise.race([closePromise, new Promise(resolve => setTimeout(resolve, 2000).unref())]);
    }
    if (processToClose.exitCode === null) {
      // Stage 3: SIGKILL
      processToClose.kill('SIGKILL');
    }
  }
}
```

**Planning implication:** The close() takes up to 4 seconds in the worst case (SIGTERM-resistant process). That is acceptable for CI. Voke should not add additional timeout logic on top of the SDK's own teardown — trust the SDK.

### Exit codes for stdio (extends existing map in `errors.ts`)

```typescript
// New error classes to add to packages/linter/src/errors.ts
// Exit code 8: stdio subprocess failed to launch
export class StdioLaunchError extends VokeError {
  constructor(command: string, cause: unknown) {
    super(
      `Failed to launch stdio server '${command}': ${String(cause)}. ` +
        `Check the command exists and is executable.`,
      8,
    );
    this.name = 'StdioLaunchError';
  }
}

// Exit code 9: stdio teardown threw (post-ingest cleanup failure)
export class StdioTeardownError extends VokeError {
  constructor(command: string, cause: unknown) {
    super(
      `Failed to cleanly stop stdio server '${command}': ${String(cause)}.`,
      9,
    );
    this.name = 'StdioTeardownError';
  }
}
```

Updated exit code map:
| Code | Meaning |
|------|---------|
| 0 | Success (score >= min-score or no threshold) |
| 1 | Score below --min-score threshold |
| 2 | Connect failure (StreamableHTTP + SSE both failed) |
| 3 | Usage error / auth error (UsageError or AuthError) |
| 4 | Partial pagination (page failed; D-10) |
| 5 | Rule execution threw |
| 6 | Schema depth exceeded hard cap (D-04) |
| 7 | Config parse error |
| 8 | stdio subprocess launch failure (NEW) |
| 9 | stdio teardown failure (NEW) |
| 70 | Unexpected internal error |

### `--env` parsing with masking

```typescript
// Extension to program.ts — follows --header (D-09) pattern exactly
.option('--env <KEY=VAL>', 'extra env var for stdio subprocess (repeatable; values masked in output)', collect, [])

// In resolveLintOpts:
const rawEnvFlags = (opts['env'] as string[] | undefined) ?? [];
// Parse KEY=VAL into Record<string, string>
const extraEnv: Record<string, string> = {};
for (const kv of rawEnvFlags) {
  const idx = kv.indexOf('=');
  if (idx === -1) throw new UsageError(`--env must be KEY=VAL, got: '${kv}'`);
  extraEnv[kv.slice(0, idx)] = kv.slice(idx + 1);
}
// maskedEnv used only in diagnostic output — never log extraEnv raw values
const maskedEnv = maskHeaders(extraEnv);  // reuse maskHeaders (replaces values with [MASKED])
```

### README Action snippet (copy-paste runnable)

```yaml
# .github/workflows/mcp-lint.yml
name: MCP Tool Quality Check
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: voke-sh/voke@v0
        with:
          target: 'https://your-mcp-server.example.com/mcp'
          min-score: '70'
```

This is the zero-modification snippet that must appear at the top of README.md (CI-02 criterion #3).

### VitePress deploy workflow

```yaml
# .github/workflows/docs.yml
name: Deploy Spec to GitHub Pages
on:
  push:
    branches: [main]
    paths: ['spec/**', 'docs/**']
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - name: Copy spec files into docs
        run: |
          mkdir -p docs/spec/v0.1
          cp spec/MTQS-v0.1.md docs/spec/v0.1/
          cp spec/SCOPE.md docs/spec/v0.1/
      - run: npm run docs:build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSE-only MCP transport | StreamableHTTP primary + SSE fallback | MCP SDK v1.0+ | Already implemented in Phase 2 |
| Docker-in-Action GitHub actions | Composite npx-based actions | 2023-2024 | Faster cold start, no Docker pull; what voke uses |
| npm publish without provenance | `npm publish --provenance` | npm 9.5+ / 2023 | Supply-chain attestation; id-token: write required |
| VitePress 0.x | VitePress 1.x (currently 1.6.4) | 2023 stable release | Breaking config changes from 0.x; use 1.x directly |

**Deprecated/outdated:**
- `@stoplight/spectral-core` as linter engine — already excluded (CLAUDE.md); out of scope.
- `json-schema-ref-parser` for deref — already excluded.
- Node 20 — EOL April 2026; already pinned to Node 22.

---

## Open Questions

1. **npm org `voke-sh` creation**
   - What we know: `@voke-sh/voke` is not published; the npm org must exist before `npm publish` succeeds.
   - What's unclear: whether the npm org `voke-sh` already exists or needs to be created at https://www.npmjs.com/org/create.
   - Recommendation: Wave 0 task — create npm org `voke-sh` and add an `NPM_TOKEN` secret to the GitHub repo before the publish workflow runs.

2. **`voke.sh` domain ownership and DNS**
   - What we know: D-08 locked the deployment target as `voke.sh/spec`. A GitHub Pages CNAME pointing `voke.sh` to `voke-sh.github.io` requires DNS control of the domain.
   - What's unclear: whether `voke.sh` is currently owned; DNS records needed (CNAME for apex domain requires A records to GitHub's IPs, not a CNAME record).
   - Recommendation: Out of scope for the planner — document as a prerequisite. If the domain isn't owned, the CNAME file can contain a placeholder; spec is accessible at `voke-sh.github.io/voke/spec/` in the meantime.

3. **`spec/` content copy vs symlink in `docs/`**
   - What we know: `spec/MTQS-v0.1.md` must remain in `spec/` as source of truth. VitePress must render it at `voke.sh/spec/v0.1/`.
   - What's unclear: whether to copy files in the deploy workflow (straightforward, no VitePress plugin needed) vs use VitePress `rewrites` config to reference files outside `docs/`.
   - Recommendation: Copy in the workflow (`cp spec/MTQS-v0.1.md docs/spec/v0.1/` before `docs:build`). VitePress `rewrites` can also work but adds config complexity.

4. **`--` passthrough in commander v15 — exact argv handling**
   - What we know: Commander v15 can handle `--` via `passThroughOptions` or by pre-splitting `process.argv` before passing to commander.
   - What's unclear: whether `program.parseAsync(argv)` respects `--` as a stop-parsing marker when `passThroughOptions` is set.
   - Recommendation: Pre-split `process.argv` at `--` before calling `buildProgram().parseAsync(cleanArgv)` — this is simpler, avoids commander internals, and the planner can test it explicitly.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.8 |
| Config file | `vitest.config.ts` (root) — `include: ['tests/**/*.test.ts']` |
| Quick run command | `npx vitest run tests/ingestion/stdio-client.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ING-06 | `ingestStdio()` returns canonicalized VokeSnapshot from subprocess | unit | `npx vitest run tests/ingestion/stdio-client.test.ts` | Wave 0 |
| ING-06 | subprocess torn down after `client.close()` (no EADDRINUSE on repeated runs) | unit | `npx vitest run tests/ingestion/stdio-client.test.ts` | Wave 0 |
| ING-06 | `--env KEY=VAL` values masked in error output | unit | `npx vitest run tests/cli/program.test.ts` | Wave 0 (extend) |
| ING-06 | byte-identical x3 output for stdio mode (determinism D-12) | e2e | `npx vitest run tests/cli/e2e-determinism.test.ts` | Wave 0 (extend) |
| ING-06 | exit code 8 on subprocess launch failure | unit | `npx vitest run tests/ingestion/stdio-client.test.ts` | Wave 0 |
| ING-06 | resolveTarget handles -- passthrough (no scheme misdetection) | unit | `npx vitest run tests/cli/resolve-target.test.ts` | Wave 0 (extend) |
| CI-01 | `action.yml` validates against composite action schema | lint/manual | Manual: run `npx @github/actions-toolkit validate action.yml` | Wave 0 |
| CI-01 | Action invokes correct `npx @voke-sh/voke@...` command | integration | Test Action in test org repo | Manual only |
| CI-02 | README Action YAML snippet is copy-paste runnable | manual | Paste into test repo; run pipeline | Manual only |
| PUB-01 | VitePress builds without error | smoke | `npm run docs:build` (exits 0) | Wave 0 |
| PUB-01 | Spec files present in VitePress dist | smoke | check `docs/.vitepress/dist/spec/v0.1/` | Wave 0 |
| PUB-02 | CONTRIBUTING.md and rule PR template files exist | smoke | `test -f CONTRIBUTING.md && test -f .github/pull_request_template/rule_pr.md` | Wave 0 |

### stdio fixture server (determinism test prerequisite)
- `tests/fixtures/stdio-server.js` — a Node.js script that always returns the same 2-tool list; runs as the subprocess target for `--` tests.
- Used by: `stdio-client.test.ts` (unit) and the stdio determinism e2e extension.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/ingestion/ tests/cli/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npm run docs:build` exits 0 before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/ingestion/stdio-client.test.ts` — covers ING-06 unit tests (launch, teardown, masking, exit codes 8/9)
- [ ] `tests/fixtures/stdio-server.js` — deterministic stdio fixture server for subprocess tests
- [ ] `docs/.vitepress/config.ts` — VitePress config (needed before `docs:build` test)
- [ ] `docs/spec/index.md` — versions landing page placeholder
- [ ] npm org `voke-sh` created on npmjs.com (not a code file — prerequisite)

---

## Sources

### Primary (HIGH confidence)
- `/modelcontextprotocol/typescript-sdk` via Context7 — `StdioClientTransport`, `StdioServerParameters`, `close()` behavior, `getDefaultEnvironment()`
- Installed SDK source `node_modules/@modelcontextprotocol/sdk/dist/cjs/client/stdio.js` (v1.29.0) — confirmed `close()` three-stage implementation, `getDefaultEnvironment()` whitelist, spawn env merging behavior
- `/vuejs/vitepress` via Context7 — GitHub Pages workflow, `base` config, CNAME, deploy.md patterns
- npm registry `npm view voke` — confirmed package taken (v1.0.2, KingPixil, MIT event-emitter)
- npm registry `npm view @voke-sh/voke` — confirmed available
- npm registry `npm view vitepress` — confirmed 1.6.4

### Secondary (MEDIUM confidence)
- [npm Generating Provenance Statements](https://docs.npmjs.com/generating-provenance-statements/) — `--provenance` flag, `id-token: write` permission, `publishConfig.provenance`
- [GitHub Docs: Publishing Node.js packages](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages) — complete workflow YAML with provenance
- [GitHub Actions Composite Action Development](https://eastondev.com/blog/en/posts/dev/20260506-github-actions-composite-action/) — mandatory `shell: bash` requirement, string-only inputs, outputs via `$GITHUB_OUTPUT`
- [SDK Issue #2023: StdioClientTransport orphan processes](https://github.com/modelcontextprotocol/typescript-sdk/issues/2023) — documents wrapper-command orphan issue; confirmed root cause; no fix in v1.29.0

### Tertiary (LOW confidence)
- WebSearch: `@viteplus/versions` plugin — versioned VitePress docs; LOW confidence on exact API; not needed for v0.1
- WebSearch: `action-semver-release-action` — moving major tags pattern; LOW; simple git commands preferred

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed from npm registry and installed source
- Architecture: HIGH — SDK internals confirmed from installed source; composite action pattern confirmed from official docs
- Pitfalls: HIGH — npm name collision confirmed empirically; SDK close() behavior confirmed from source; composite `shell:` requirement confirmed from official guide
- npm name conflict: HIGH — `npm view voke` ran and confirmed

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (SDK updates weekly; check StdioClientTransport issue #2023 status if >2 weeks pass)
