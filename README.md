# Voke

Deterministic MCP tool quality linter, MTQS v0.1 reference implementation.

`voke lint <server>` produces deterministic per-rule findings and a stable score against the
published MTQS ruleset. Same input always yields the same output -- no model in the loop,
CI-gradeable, and reproducible across runs.

---

## Quickstart: GitHub Action

Add a lint job to any repo in under a minute. Copy and paste this workflow with zero
modification -- only change `target` to your MCP server URL:

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

The job will pass if your server scores 70 or above, and fail the build if it falls below.
This snippet is a syntactically valid GitHub Actions workflow that becomes a live CI gate once
`@voke-sh/voke` is published to npm (Phase 6 first release).

**Pinning:** `@v0` is the moving major tag -- it auto-updates on patch and minor releases.
For a security-conscious option, pin to the full commit SHA of a known-good release instead.

### Action inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `target` | yes | - | MCP server URL, snapshot file path, or `--` for stdio mode |
| `min-score` | no | `0` | Fail the build if server score is below this threshold (0-100) |
| `format` | no | `human` | Output format: `human` or `json` |
| `args` | no | `` | Extra CLI args passed verbatim (e.g. `--header 'Authorization: Bearer $TOKEN'`) |
| `version` | no | `latest` | Specific `@voke-sh/voke` version to use (e.g. `0.1.0`) |

### Action outputs

| Output | Description |
|--------|-------------|
| `score` | The server score (0-100) for use in downstream steps |

---

## Local Usage

### HTTP server (live)

```bash
npx @voke-sh/voke lint https://your-mcp-server.example.com/mcp
```

Set a minimum score gate:

```bash
npx @voke-sh/voke lint https://your-mcp-server.example.com/mcp --min-score 70
```

### Offline snapshot

```bash
npx @voke-sh/voke lint ./tools-snapshot.json
```

Save a snapshot for reproducible CI runs that don't require a live server.

### Stdio server (subprocess)

```bash
npx @voke-sh/voke lint -- node server.js
npx @voke-sh/voke lint -- python server.py --port 0
```

Everything after `--` is the subprocess command. The server is launched, linted, and torn
down deterministically. Pass extra environment variables with `--env`:

```bash
npx @voke-sh/voke lint --env API_KEY=mysecret -- node server.js
```

`--env` values are masked in all output (logs, findings, error messages).

### JSON output

```bash
npx @voke-sh/voke lint https://your-mcp-server.example.com/mcp --output json
```

The JSON report is deterministic -- same input always produces byte-identical output
(excluding the `generatedAt` metadata field).

### Authentication

```bash
npx @voke-sh/voke lint https://your-mcp-server.example.com/mcp \
  --header 'Authorization: Bearer $TOKEN'
```

Header values are masked in all output.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success -- score meets or exceeds `--min-score` (or no threshold set) |
| 1 | Score below `--min-score` threshold |
| 2 | Connection failure (StreamableHTTP and SSE both failed) |
| 3 | Usage or auth error |
| 4 | Partial pagination (a tools/list page failed mid-stream) |
| 5 | Rule execution error |
| 6 | Schema depth exceeded hard cap |
| 7 | Config parse error |
| 8 | stdio subprocess launch failure |
| 9 | stdio teardown failure |
| 70 | Unexpected internal error |

---

## Spec

The MTQS (MCP Tool Quality Specification) v0.1 is published at:

**https://voke-sh.github.io/voke/spec/** (voke.sh/spec once the custom domain is live)

The spec is versioned and immutable -- a v0.1 link will never break when v0.2 ships. Every
lost point in a voke report traces to exactly one rule ID, which traces to exactly one citable
primary source in the spec. No black-box scoring.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute rules to MTQS and code to the
linter. All rule PRs use the
[rule PR template](.github/pull_request_template/rule_pr.md),
which requires a primary-source citation (never Glama) and positive + negative fixtures.

---

## License

Apache-2.0. See [LICENSE](LICENSE).
