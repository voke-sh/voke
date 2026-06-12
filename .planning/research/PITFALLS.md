# Pitfalls Research

**Domain:** MCP Tool Quality Specification + reference linter (open-source, solo part-time)
**Researched:** 2026-06-12
**Confidence:** HIGH (MCP RC specifics), MEDIUM (determinism patterns), HIGH (OSS sustainability patterns)

---

## Critical Pitfalls

### Pitfall 1: Determinism Leak via Non-Reproducible Aggregate Score

**What goes wrong:**
The score produced by `voke lint` differs between runs on identical input. This is not a hypothetical — it is the defining failure mode of the incumbent (Glama's LLM-judge score). If MTQS produces the same failure, the entire value proposition collapses. Concrete JavaScript sources of silent non-determinism in a scoring pipeline:

- `Object.keys()` and `for...in` iteration over plain objects: integer-keyed properties are sorted numerically and appear first regardless of insertion order; string keys are insertion-ordered. If tool properties are ingested into a plain object rather than built deterministically, key order varies by how the MCP server serializes its `tools/list` response.
- `Set` iteration: Set preserves insertion order, but if a Set is built from an array that came off the wire (e.g., `tools/list` response ordering), and the server re-orders tools across calls (alphabetically vs. registration order), iteration order changes.
- `Array.prototype.sort()` is stable since ES2019/Node 12, but only if the comparison function is purely lexicographic on a stable key. If any rule generates a score from a sorted list of tool names and the names collide (equal comparison), the stable sort guarantees relative position within the original array — meaning response-order dependence bleeds in.
- Floating-point score aggregation: weighted averages accumulated via `+=` are not associative. `(0.4 * dimA + 0.3 * dimB + 0.3 * dimC)` and `(0.3 * dimC + 0.3 * dimB + 0.4 * dimA)` may produce different IEEE 754 double results at the last ULP. When the scoring formula sums N per-tool scores to a server score, order matters.
- `Date.now()`, `Math.random()`, timestamps anywhere in the result payload.
- `Intl.Collator` / `String.prototype.localeCompare()` without a pinned locale: result depends on the runner's `LANG`/`LC_ALL`. Sorting tool names for output display via locale-aware comparison produces different orderings on `en-US` vs `C.UTF-8` runners.

**Why it happens:**
Developers write rule functions that "happen to work" against the Apideck test server because that server returns tools in a stable registration order. The leak only surfaces when a different server returns tools in a different order, or when the CI runner has a different locale, or when two dimensions contribute identical scores and floating-point accumulation order changes between Node versions.

**How to avoid:**
- Canonicalize the ingested tool list immediately after `tools/list` returns: sort by `tool.name` lexicographically (pure byte-order `localeCompare('en', {sensitivity: 'variant'})` with an explicit locale, not the default) before passing to the rule engine. This makes the engine's input order a function of the content, not of the server.
- Never use `Object.keys()` on the ingested tool schema object as the authoritative key list for scoring. Always iterate over a sorted copy.
- Use integer arithmetic for scoring wherever possible: represent a dimension score as an integer out of 100, convert to float only in the final formatted output. This eliminates IEEE 754 accumulation order sensitivity.
- If floating-point is unavoidable, use a fixed evaluation order (sorted dimension IDs, sorted tool names) and document it in the spec as part of the formula.
- Forbid `Date.now()`, `Math.random()`, and `Intl` collation without explicit locale from all rule functions and the scoring core. Add a lint check (ironic but effective) or a code-review checklist item.
- Write a reproducibility test: run `voke lint <snapshot-file>` twice in the same process and once in a fresh process; assert byte-identical output. Run this in CI from Phase 2 onward.

**Warning signs:**
- Rule output differs when `tools/list` response order changes (test by shuffling a fixture).
- CI score on the same commit differs by 0.01 on a re-run.
- Any rule function that reads `new Date()` or calls `Math.random()`.
- Any `sort()` call without an explicit comparator.
- Any `JSON.stringify(obj)` where `obj` was not explicitly sorted first.

**Phase to address:**
Phase 2 (Rule Engine + Result Type). The canonicalization contract must be baked into the ingestion layer before the first rule is written. A reproducibility test must be a Phase 2 exit criterion, not a Phase 5 cleanup task.

---

### Pitfall 2: Spec-vs-Code Drift (Linter Gets Ahead of the Documented Ruleset)

**What goes wrong:**
A rule is implemented in the linter that has no corresponding entry in the MTQS spec document. Or a rule is in the spec but the implementation has a different severity, different mechanical check, or different rule ID. Over time, "the source of truth" becomes ambiguous — is it the TypeScript code or the Markdown doc? Downstream users who read the spec to understand their score find that the behavior they observe doesn't match.

The secondary failure: the linter does not declare which MTQS version it implements. A user pins `voke@1.2.3` and a server scores B. Six months later they upgrade, the score drops to C. There is no way to know whether the server regressed or the spec tightened.

**Why it happens:**
During focused coding sessions (2–3h part-time), it is faster to just implement an idea as code than to draft a spec paragraph first. The spec doc ends up as a post-hoc description of what the code already does, written under time pressure and missing nuances. Rule IDs assigned in code (`MTQS-DESC-001`) diverge from whatever the spec doc says.

**How to avoid:**
- Enforce spec-first as a hard workflow gate: no rule may exist in the codebase without a corresponding entry in the spec document with a matching rule ID, severity, description, and fix hint. The rule code file can carry a comment `// Implements MTQS-DESC-001 v0.1` as the traceability link.
- Version the spec independently from the linter with a declared compatibility field. In `package.json` or a `voke.config.ts` constant: `const MTQS_VERSION = "0.1"`. The CLI prints this in `--version` output. The spec document's header says "Implemented by voke-lint >= 1.0.0".
- Keep MTQS rules in a machine-readable format (YAML or JSON, one entry per rule) that is the authoritative source for both the spec documentation and the linter. The spec doc is generated (or at minimum manually kept in sync) from this file. This prevents the doc and the code from diverging silently.
- For community-submitted rules (Phase 5+): require a spec entry PR before or alongside the implementation PR. The rule entry is the design document. Merge order: spec entry first, then implementation.

**Warning signs:**
- A rule exists in `src/rules/` with no corresponding entry in `docs/spec/rules.md`.
- `--version` output does not include the MTQS version string.
- A CI badge on a README says "MTQS score: A" but links to a spec URL that 404s or shows a different rule count than the linter emits.
- Rule IDs in code contain a number that doesn't match the spec (e.g., code says `MTQS-SCH-004` but spec only defines `MTQS-SCH-001` through `MTQS-SCH-003`).

**Phase to address:**
Phase 1 (MTQS v0.1 authoring). The spec document and the machine-readable rule registry are the Phase 1 deliverable. Phase 2 (Rule Engine) starts from that registry. Phase 3 (Rule Implementations) implements against it. The connection must be established before any code is written.

---

### Pitfall 3: MCP RC 2026-07-28 Migration Traps in the Validator

**What goes wrong:**
Four specific traps in the JSON Schema 2020-12 upgrade:

1. **External `$ref` auto-dereference**: The RC explicitly prohibits implementations from auto-dereferencing external `$ref` URIs. A naive validator that calls `$RefParser.dereference()` on an ingested tool schema will silently fetch external URLs (potential SSRF, DoS from slow hosts, circular reference crashes). The mastra-ai codebase hit exactly this: `$RefParser.dereference()` on recursive `$defs/$ref` structures creates circular JS objects that crash `JSON.stringify`.

2. **Schema depth and validation time unbounded**: The RC says validators "should bound schema depth and validation time." A tool schema with deeply nested `allOf` compositions (common in generated OpenAPI-to-MCP conversions) can cause the validation pass to hang or OOM. There is no built-in bound in Ajv or most JSON Schema validators.

3. **`oneOf` exhaustive evaluation cost**: Unlike `anyOf` (short-circuits on first match), `oneOf` must evaluate all branches to confirm exactly one matches. A tool schema with `oneOf` containing 20 branches (plausible in a generated server) causes quadratic validation work. Linter performance on the 229-tool Apideck server becomes the problem.

4. **`inputSchema` still requires `type: "object"` root**: The RC lifts composition keywords but does not remove the root object constraint. A MTQS rule that validates inputSchema conformance must check that `type: "object"` is present even when the schema uses `allOf`/`oneOf` — because the composition keywords are valid alongside the type constraint, not instead of it. Getting this wrong produces false-positive rule violations on conformant servers.

**Why it happens:**
Libraries and examples written before the RC (most of npm's JSON Schema ecosystem) either auto-dereference or do not implement 2020-12 at all (Ajv 6.x only does draft-07). Developers reach for the first working library they find without checking its $ref handling.

**How to avoid:**
- Use Ajv 8.x (which supports JSON Schema 2020-12 natively) from day one. Do NOT call any `$ref`-resolving middleware on tool schemas during ingestion. Resolve only internal `$ref` references (within the same schema's `$defs`) using a safe local-only resolver.
- Set a schema depth limit (e.g., max depth 10) before passing to the validator. Walk the schema tree and raise a `MTQS-SCH-DEPTH` error if exceeded, rather than letting the validator hang.
- Prefer `anyOf` over `oneOf` in MTQS's own meta-schema for rules that check composition — and document this preference in the rule authoring guide.
- Write a dedicated test fixture with an external `$ref` in a tool schema and assert that `voke lint` does NOT fetch the external URL and instead emits `MTQS-SCH-EXTREF` as an error.
- Add a test fixture with a 15-level-deep nested schema and assert that lint completes in under 500ms and emits the depth error.

**Warning signs:**
- `$RefParser` anywhere in the dependency tree being called without the `dereference: false` option.
- Lint taking >5s on the Apideck 229-tool server during development.
- Any test that makes real outbound HTTP calls (intercept with a network stub in tests).
- A rule that flags `oneOf`/`anyOf`/`allOf` presence as invalid (they are valid in RC).

**Phase to address:**
Phase 2 (Tool Surface Ingestion). The ingestion layer must enforce the no-external-dereference contract and depth bound before the first rule fires. Verify with the Apideck server in Phase 4 (CLI integration).

---

### Pitfall 4: Scope Creep Toward Gateway/Proxy or Model-in-the-Loop

**What goes wrong:**
Two distinct drift patterns, both fatal for different reasons:

**Pattern A — Gateway/proxy drift**: A feature request comes in to "proxy the tool call through voke so it can check annotations at runtime." This is genuinely useful, but it makes Voke an in-path MCP intermediary — directly on the employer-conflict line. Once voke wraps tool calls, it is a gateway. The L3 monitor section already shows the temptation: "optional canary call only against a tool the user explicitly marks read-only." Generalizing that to "voke intercepts all calls" is one PR away from being an integration product.

**Pattern B — L4 eval drift**: A rule cannot be checked mechanically, so the developer adds an LLM call inside the rule function to assess "is this description well-written?" This kills the determinism guarantee. The CI signal becomes non-reproducible. The score changes without input changes. Once one rule has an LLM call, the boundary is gone.

**Why it happens:**
Both feel like natural feature extensions. "Just one model call for the description quality rule" seems harmless. "Just forward the call through voke for annotation enforcement" seems consistent with the observability framing. The cost is not visible until it has already happened.

**How to avoid:**
- Make the scope line explicit in the codebase: add a `SCOPE.md` at the repo root (1 page) that defines "Voke is a user/observer of MCP servers, never an in-path intermediary." Link to it from CONTRIBUTING.md.
- The rule engine interface must be typed to prohibit async external calls. Rule functions are `(tool: MCPTool) => RuleResult` — synchronous, pure, no IO. This is enforced structurally, not by convention.
- Any feature request that requires voke to issue a `tools/call` (other than an explicit L3 canary marked read-only by the user) is out of scope for L1/L2. The issue template should ask "does this require voke to call a tool?" as a triage question.
- L4 (model-in-the-loop eval) is a separate binary/package — not a flag on `voke lint`. The separation is physical, not just conceptual.

**Warning signs:**
- Any rule function with an `async` keyword or a network call.
- Any feature discussion that includes the phrase "voke could just call the tool to verify."
- A dependency on an LLM SDK appearing in `package.json`.
- A flag like `--enable-llm` or `--deep-check` being considered for `voke lint`.

**Phase to address:**
Phase 1 (Rule Engine design). The rule function type signature is the enforcement mechanism. It must be established before Phase 3 (rule implementations) begins. Revisit at Phase 6 (GitHub Action + launch) when "just one more thing" pressure peaks.

---

### Pitfall 5: Abandonment from Phases Too Large to Finish in a 2–3h Session

**What goes wrong:**
A phase is defined as "implement all 7 MTQS dimensions with full scoring." That is 3–4 weeks of part-time work with no intermediate demo artifact. After two sessions, the phase is 20% done and there is nothing to show. Motivation collapses. The project stalls. The category seat that was empty in June 2026 gets claimed by another tool that ships faster.

**Why it happens:**
Roadmap phases are scoped to logical units ("implement rules") rather than time-boxed units ("implement 2 rules + have lint output something demoable"). The minimum demoable artifact is buried at the end of a large phase.

**How to avoid:**
- Every phase must produce a demoable artifact within the first session (2–3h). "Demoable" means: `voke lint <real-server>` runs without crashing and prints something meaningful, even if incomplete.
- Phase sizes should be estimated in sessions (2h units), not story points or days. Target 3–5 sessions per phase. A phase that estimates >6 sessions must be split.
- The first demoable end-to-end run (rule engine → ingest one tool → score one dimension → print one finding) must happen by the end of Phase 2, not Phase 4.
- Keep a single "northstar demo command" visible in the README from Phase 2 onward: `voke lint https://mcp.apideck.dev/mcp`. Even if it prints partial results, the command must work. This is the regression check that keeps motivation anchored.
- Treat blog post drafting as a parallel task that starts in Phase 3, not a deliverable for Phase 7. Writing forces clarification of what the demo should show; it is not a reward for finishing.

**Warning signs:**
- A phase plan where `voke lint` doesn't produce any output until step 4 of 6.
- More than one week passes without a runnable CLI artifact.
- The phrase "once the rule engine is complete" appearing as a prerequisite for anything demoable.
- A phase that touches spec authoring, rule engine, ingestion, AND scoring all at once.

**Phase to address:**
Phase 0 (planning / roadmap). The phase decomposition strategy must be decided before any work begins. The "first finishable unit" from PRD §13 — `voke lint` against one real server → deterministic per-rule findings + stable score → same output on re-run — must be a Phase 2 or Phase 3 exit milestone, not a Phase 7 milestone.

---

### Pitfall 6: Real-Server Integration Failures (Auth, Rate Limits, Large Surfaces, Flaky Behavior)

**What goes wrong:**
Connecting to real third-party MCP servers during development introduces three distinct failure modes:

1. **Rate limiting on `tools/list`**: The AWS Knowledge MCP and other production servers apply per-IP rate limits as aggressive as 1 request per 15 seconds. The MCP initialization sequence (initialize → tools/list) fires two rapid requests; rate-limited servers return 429 on the second. The linter hangs or crashes with an opaque error. For the 229-tool Apideck server, the response payload is large enough that network latency on a slow connection produces timeout errors when the default timeout is 30s.

2. **Auth token handling**: 53% of production MCP servers use static bearer tokens. The linter must accept a `--header` or `--token` flag to pass credentials. Without this, any authenticated server is untestable in CI. The bearer token must NOT be logged in stdout or stored in the result JSON.

3. **Flaky servers in development**: Running `voke lint` against a live server during rule development means any server-side flakiness (5xx, partial tool list) produces confusing linter failures that look like rule bugs. The 229-tool Apideck server is the demo artifact; if it has any instability during the launch week, the blog post is broken.

4. **Blind tool calls on a cron**: The L3 section of the PRD correctly notes "never blind-call tools on a cron." This must be a hard-coded constraint in the CLI: `voke lint` issues only `tools/list` (and `initialize`). It never calls `tools/call` unless a future `--canary-tool` flag is added with explicit read-only confirmation. This is both a safety property and a scope-enforcement mechanism.

**Why it happens:**
During development, the developer tests against a local mock server where none of these constraints apply. The first time the linter runs against a real server is the launch demo. At that point, any of these failures is a launch-blocking bug.

**How to avoid:**
- Build a fixture-based test mode from Phase 2: `voke lint --from-file tools-dump.json` must work without any network call. All rule development and unit testing happens against fixtures, not live servers.
- Treat live-server integration as a separate test suite that runs only when explicitly invoked (`npm run test:live`). Gate the launch on passing this suite against the Apideck server at least 3 consecutive times.
- Add `--timeout` (default 30s), `--header "Authorization: Bearer $TOKEN"` flags in Phase 4 (CLI). Test against a real authenticated server before declaring Phase 4 complete.
- Add a network call spy to the unit test suite that fails any test that makes an outbound HTTP call. This forces fixture use in unit tests.
- Save the tools/list response from the Apideck server as a committed fixture in the repo. The launch blog post demo can use this fixture (reproducible) while also showing a live run as a screenshot.

**Warning signs:**
- No `--from-file` flag in the CLI design.
- Unit tests that call `new MCPClient(realServerUrl)`.
- The phrase "I'll test against Apideck later" appearing before Phase 4.
- No explicit timeout handling in the MCP SDK client wrapper.

**Phase to address:**
Phase 2 (Ingestion layer). Fixture-first ingestion is a Phase 2 requirement. Live-server integration with auth/timeout is Phase 4. The Apideck 229-tool fixture must be committed to the repo by Phase 3.

---

### Pitfall 7: OSS Contribution Hygiene — AI-Generated Rule PRs and Score Reproducibility

**What goes wrong:**
Once the spec repo is public and accepting rule PRs, two failure modes emerge specific to this project:

1. **AI-generated rule submissions**: In 2026, the average public OSS repo receives hundreds of AI-generated PRs monthly. Rule PRs are particularly susceptible: they look structurally correct (valid TypeScript, matching the rule interface) but contain subtle semantic errors (wrong mechanical check, incorrect severity, rule that flags valid MCP servers). Reviewing them is more cognitively demanding than writing the rule correctly from scratch, because the reviewer must evaluate the rule logic rather than just checking style.

2. **Community-submitted score results are not reproducible**: If users submit "my server scored X" reports and the score depends on factors outside the tool schema (network response ordering, their MCP SDK version, their Node version), the reported score cannot be reproduced by others. This undermines the "auditable" claim.

**Why it happens:**
Open contribution policies are adopted from standard OSS templates without considering the domain-specific review burden of rule logic. Score reporting happens informally in issues/discussions before a formal score-reproduction protocol exists.

**How to avoid:**
- Establish a rule PR template that requires: (a) link to the spec entry that defines this rule, (b) the primary source citation (Anthropic docs, MCP spec, JSON Schema spec), (c) a test fixture where the rule fires (positive case) and a fixture where it does not (negative case). Without these three, the PR is not reviewable.
- For the solo phase: a "no external rule PRs accepted until v0.2" policy is acceptable and honest. The spec must stabilize before community extension makes sense. Gate community rules behind a `voke.sh/spec` discussion process first.
- Document score reproducibility requirements: the MTQS score is defined as "the output of `voke lint --from-file <canonical-dump>` using the pinned linter version." A score reported without the canonical dump file and linter version is not auditable. Add this to the spec's "How to Report a Score" section.
- Pin Node.js version in CI (`.nvmrc` or `engines` field in `package.json`) so that any floating-point behavior difference between Node 20 and Node 22 is contained.

**Warning signs:**
- A PR that adds a rule without a corresponding test fixture.
- A score reported in an issue with no `voke lint --version` output attached.
- The spec discussion board (GitHub Discussions or similar) accumulating rule proposals with no defined lifecycle.
- PRs from accounts with no prior engagement that touch only TypeScript rule files.

**Phase to address:**
Phase 5 (Spec publication + GitHub Action). CONTRIBUTING.md and the rule PR template are Phase 5 deliverables, not afterthoughts. Node version pinning is Phase 2.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Scoring via plain `Object.values(scores).reduce()` without sorted keys | Fast to write | Non-deterministic if object property order varies by ingest path | Never — sort keys before reduce |
| Inline rule logic in the CLI handler instead of rule engine | Fewer files in early phases | Blocks L2 diff reuse; breaks Spectral-style extensibility | Never — rule engine is the core |
| Testing only against the Apideck live server | Always-fresh data | Flaky CI; launch demo depends on server uptime | Never — commit a fixture by Phase 3 |
| Skipping spec entry and writing rule code first | Faster iteration | Spec-code drift; can't accept community rule PRs reliably | Never in Phase 3+; acceptable only in Phase 2 for engine scaffolding |
| Using `JSON.stringify()` for canonical hash/comparison of tool shapes | Simple to implement | Key ordering varies by ingestion source | Never without prior sort |
| Accepting the first JSON Schema validator without checking $ref handling | Quick start | Auto-deref SSRF/crash risk; incompatible with RC requirement | Never |
| Logging raw tool schemas in debug output | Easier debugging | May log bearer tokens if schema contains auth examples | Only behind explicit `--debug` flag with sanitization |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MCP SDK (TypeScript) `tools/list` | Calling without a timeout; no error handling for 429 | Wrap in a timeout (30s default); handle 429 with a retry-once-after-delay |
| MCP SDK `initialize` → `tools/list` | Sending both before the initialize response is confirmed | Wait for `initialize` response before issuing `tools/list` |
| Ajv 8.x with JSON Schema 2020-12 | Using `new Ajv()` defaults which are draft-07 | Instantiate with `new Ajv2020()` from `ajv/dist/2020` |
| `$ref` in tool inputSchema | Passing schema to `$RefParser.dereference()` | Use `$RefParser.bundle()` (local only) or write a custom local-only resolver |
| GitHub Actions `tools/list` against authenticated server | Bearer token in `run:` step log | Use `${{ secrets.TOKEN }}` and assert `--header` flag masks it in output |
| Node.js `sort()` for tool name ordering | `[].sort()` without comparator (lexicographic but locale-dependent in some environments) | `[].sort((a, b) => a.localeCompare(b, 'en', {sensitivity: 'variant'}))` with pinned locale |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `oneOf` validation on 20+ branch schemas | Lint hangs on complex generated servers; 30s+ for 229 tools | Detect `oneOf` with >10 branches and emit `MTQS-SCH-COMPLEX` warning; add a 5s per-tool timeout | Any server with polymorphic tool schemas generated from OpenAPI |
| Walking the full schema tree recursively without depth bound | OOM or stack overflow on pathological schemas | Walk with depth counter; throw/return at depth 12 | Recursive `$ref`/`$defs` schemas |
| Loading all 229 tools into memory simultaneously for cross-tool coherence rules | Works fine; won't be a real perf issue at this scale | N/A for L1 — 229 tools is the upper bound for now | If surface coherence rules need pairwise comparison: O(n²) is fine at 229 |
| Connecting to live server on every CI run | Flaky CI; rate-limit 429 on parallel matrix builds | Default to fixture file in CI; live connection is opt-in | Any server with rate limits on `tools/list` |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging the full `Authorization` header in debug/verbose output | Bearer token exfiltration in CI logs | Sanitize headers before logging; mask any `Authorization` value |
| Auto-dereferencing external `$ref` in tool schemas | SSRF against internal network addresses; DoS from slow/large external schemas; circular reference crash | Never dereference external `$ref`; validate this is prohibited in ingestion layer tests |
| Accepting tool schema input without depth/size bounds | DoS via deeply nested schema; OOM | Bound schema depth (12 levels) and total schema size (1MB) before validation |
| Storing `--token` flag value in result JSON | Bearer token in committed snapshot files | Result type never includes connection credentials; they exist only in memory |

---

## "Looks Done But Isn't" Checklist

- [ ] **Determinism**: Output verified as byte-identical across 3 consecutive runs on the same fixture — not just "looks the same"
- [ ] **MTQS version declaration**: `voke lint --version` prints both the CLI version AND the MTQS spec version it implements
- [ ] **Spec-rule traceability**: Every rule in `src/rules/` has a matching entry in the spec document with the same rule ID and severity
- [ ] **No external network calls in unit tests**: Test suite passes with network blocked (verify with `nock` or similar)
- [ ] **Fixture coverage**: Both positive (rule fires) and negative (rule does not fire) fixtures exist for every rule
- [ ] **Auth flag masking**: `--header "Authorization: Bearer secret"` does not appear in lint output or result JSON
- [ ] **Depth bound**: `voke lint` completes in <10s on a fixture with a 15-level-deep schema (emits error, does not hang)
- [ ] **External $ref rejection**: `voke lint` on a schema containing `$ref: "https://external.com/schema"` emits `MTQS-SCH-EXTREF`, does not fetch the URL
- [ ] **Locale independence**: Lint output is identical when `LC_ALL=C` vs `LC_ALL=en_US.UTF-8`
- [ ] **GitHub Action**: The Action YAML example in README actually works (test it in a real repo before launch)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Determinism leak discovered post-launch | HIGH | Identify the non-deterministic source; add failing test; fix; publish a new MTQS patch version with a changelog note; existing CI configs that pinned `voke@1.x` now get the fix on next version bump |
| Spec-code drift discovered after community rules exist | HIGH | Audit every rule for spec coverage; write missing spec entries; publish a corrigendum; version-bump MTQS |
| External $ref auto-deref shipped in a release | MEDIUM | Patch immediately; the risk is DoS/SSRF if someone runs voke against a malicious server; publish security advisory |
| Phase too large, stalls mid-phase | LOW | Split the phase retroactively; declare the completed work as a shippable artifact even if incomplete; post a "partial results" demo to maintain public momentum |
| AI-generated junk rule PR merged by mistake | MEDIUM | Revert the merge; add the failing test case the PR lacked; tighten the PR template |
| Live server unavailable during launch demo | LOW | Use the committed fixture file; launch post shows fixture run + screenshot of live run taken before launch |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Determinism leak (score non-reproducibility) | Phase 2 (Rule Engine) | Reproducibility test is a Phase 2 exit criterion |
| Spec-vs-code drift | Phase 1 (MTQS authoring) | Rule registry exists; every Phase 3 rule has a spec entry |
| MCP RC $ref / depth / composition traps | Phase 2 (Ingestion) | Fixture with external $ref emits MTQS-SCH-EXTREF; depth fixture completes in <10s |
| Scope creep (gateway/LLM drift) | Phase 1 (Rule Engine design) | Rule function type is synchronous pure; SCOPE.md exists |
| Phase-size abandonment risk | Phase 0 (Roadmap planning) | Each phase has a demoable artifact reachable within session 1 |
| Real-server integration failures | Phase 2 (Ingestion) / Phase 4 (CLI) | Fixture mode works; live mode tested against Apideck 3× |
| OSS AI-generated PR / score reproducibility | Phase 5 (Spec publication) | CONTRIBUTING.md + rule PR template exist before first community PR |
| Floating-point score non-determinism | Phase 2 (Rule Engine) | Integer scoring used; byte-identical output test passes |
| Locale-sensitive sort non-determinism | Phase 2 (Ingestion) | Locale independence test passes (LC_ALL=C vs en_US) |
| Bearer token logging | Phase 4 (CLI) | `--header Authorization: Bearer secret` absent from all output |

---

## Sources

- MCP 2026-07-28 RC official announcement: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- MCP RC migration breakdown: https://dev.to/akaranjkar08/mcp-spec-ships-july-28-every-breaking-change-and-how-to-migrate-4co8
- fastmcp issue on $ref auto-deref breaking discriminator mapping: https://github.com/PrefectHQ/fastmcp/issues/3679
- mastra circular $ref crash: https://github.com/mastra-ai/mastra/issues/15341
- MCP tools/list timeout (30s too short for complex servers): https://github.com/OpenCoworkAI/open-cowork/issues/161
- AWS MCP rate limit issue: https://github.com/awslabs/mcp/issues/2949
- JSON.stringify key ordering non-determinism: https://github.com/auth0/node-jsonwebtoken/issues/404
- JavaScript determinism for game engines (comprehensive coverage): https://developers.rune.ai/blog/making-js-deterministic-for-fun-and-glory
- OSS maintainers drowning in AI PRs (2026): https://thenewstack.io/ai-generated-code-crisis/
- MCP security — static bearer token risks: https://medium.com/data-science-collective/why-your-mcp-server-is-a-security-disaster-waiting-to-happen-660577d8077c
- Floating-point non-associativity and reproducibility: https://arxiv.org/html/2408.05148v3
- MCP scope discipline (AAIF summit 2026): https://futurumgroup.com/insights/mcp-dev-summit-2026-aaif-sets-a-clear-direction-with-disciplined-guardrails/

---
*Pitfalls research for: MCP Tool Quality Specification + reference linter (open-source, solo part-time)*
*Researched: 2026-06-12*
