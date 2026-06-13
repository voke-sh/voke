# Contributing to Voke

Thank you for contributing to Voke and the MCP Tool Quality Specification (MTQS). There are
two contribution tracks: rule contributions (new or changed MTQS rules in the spec) and code
contributions (improvements to the linter, CLI, or tooling). Both tracks start with a GitHub
issue or PR -- the guidelines below explain what each needs to include.

---

## Rule Contributions (MTQS spec changes)

Rule PRs have a higher bar than code PRs because rules define what "quality" means. A merged
rule becomes normative and must be independently citeable forever. The following requirements
are non-negotiable.

### Every rule PR MUST include

**1. A primary-source citation (never Glama)**

Every rule MUST cite exactly one of the following:

- The MCP specification (the authoritative protocol reference)
- Anthropic's published guidance -- "Writing effective tools for agents" (Sep 2025)
- JSON Schema 2020-12 (RFC-compliant specification)
- A peer-reviewed paper (with DOI or direct URL)

The citation must be a direct URL or DOI, not a blog post paraphrasing a primary source.
Glama is explicitly prohibited as a citation -- Voke must synthesize from independent primary
sources to remain a credible open standard. See [spec/SCOPE.md](spec/SCOPE.md) §4 for the
full normative scope-creep prevention rule.

**2. Positive and negative fixtures**

- A positive fixture: a known-good tool definition that PASSES the rule (no finding fired)
- A negative fixture: a known-bad tool definition that FIRES the rule (finding present)

Both fixtures must be committed as test cases in the relevant rule test file under
`tests/rules/`. The test suite fails if either fixture produces the wrong result.

**3. A registry entry in spec/mtqs-v0.1.yaml**

Every rule in code must have a corresponding entry in `spec/mtqs-v0.1.yaml` (id, severity,
dimension, fixHint). The CI build (`npm test`) verifies registry-to-code parity -- a rule
present in code but missing from the registry will fail the test suite. Likewise, a registry
entry with no corresponding rule implementation will fail.

**4. Preserved determinism**

Rule functions are typed `(ctx: RuleContext) => Finding[]` -- pure, synchronous, no IO. The
determinism guarantee (same input, same output, byte-identical across runs) is the core trust
property of MTQS L1. A rule that:

- Makes any network request or reads any file
- Calls any LLM API
- Reads system state (env vars beyond what is injected, clock, random values)
- Requires a previous tool snapshot (that is an L2 feature)

...will be rejected. If the check cannot be expressed as a pure function of a typed
`ToolSnapshot` object, it is an L4 candidate -- not an L1 rule. See
[spec/SCOPE.md](spec/SCOPE.md) §3 for the full determinism guarantee.

All rule PRs use the [rule PR template](.github/pull_request_template/rule_pr.md).

---

## Code Contributions

Code contributions to the linter, CLI, output formatters, and ingestion pipeline are welcome.
For significant changes, open an issue first to discuss the approach.

### Dev setup

```bash
# Install all workspace dependencies
npm ci

# Run the full test suite (must pass before opening a PR)
npm test

# Build the linter package
npm --workspace @voke-sh/voke run build

# Type-check only (tsup skips type errors during build)
npm --workspace @voke-sh/voke run typecheck
```

### Running tests

```bash
# Full suite
npm test

# Watch mode
npx vitest

# Single test file
npx vitest run tests/rules/schema.test.ts
```

Tests live in `tests/` at the repo root and are organized by domain:
`tests/rules/`, `tests/engine/`, `tests/ingestion/`, `tests/cli/`.

### Code style

- TypeScript, strictly typed -- no `any`.
- Pure functions for rule logic -- no IO, no side effects in rule bodies.
- Follow the existing patterns in `packages/linter/src/`.

---

## Determinism Contract

The determinism guarantee is the entire competitive wedge of MTQS. Any contribution --
rule or code -- that introduces non-determinism is a trust failure and will be rejected.

The three pillars:

1. **Sort** -- tools are sorted alphabetically by name before scoring; findings are sorted
   by `toolId -> ruleId -> path`. The protocol does not guarantee ordering.
2. **Integer-first arithmetic** -- `Math.round(penalty * multiplier)` per finding, then sum
   integers; do not accumulate floats and round at the end.
3. **No IO in rule bodies** -- rule functions receive a frozen `RuleContext` object; they must
   not call `fetch`, `fs`, or any async IO.

The determinism proof lives at `tests/engine/determinism.test.ts`. It checks byte-identical
output across three runs on the Apideck fixture and confirms shuffle-invariance.

---

## Reporting Issues

For bugs in the linter: open a GitHub issue with the target URL (or snapshot file) and the
full `voke lint --output json` output.

For proposed spec changes (new rules, severity changes, new dimensions): open a GitHub issue
tagged `spec:proposal` with a draft primary-source citation and a sketch of the positive and
negative fixture.

---

## License

All contributions are licensed under Apache-2.0, the same license as the project. By
submitting a PR you agree that your contribution is released under these terms.
