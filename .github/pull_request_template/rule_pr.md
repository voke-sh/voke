## Rule

**Rule ID:** (e.g. MTQS-S01)
**Dimension:** (schema | description | naming | parameters | annotations)
**Severity:** (error | warning | info | hint)

Brief description of what the rule checks and why it matters for agent usability.

---

## Primary-source citation (REQUIRED)

- [ ] I cite a primary source (Anthropic / MCP spec / JSON Schema / academic). I am NOT citing Glama (see [SCOPE.md §4](../../spec/SCOPE.md)).

**Citation URL or DOI:**

```
(paste the direct URL or DOI here -- no blog paraphrases)
```

**How this source justifies the rule:**

(one or two sentences explaining the direct connection between the cited source and the rule)

---

## Fixtures

- [ ] Positive fixture added (a known-good tool definition that PASSES the rule -- no finding fired)
- [ ] Negative fixture added (a known-bad tool definition that FIRES the rule -- finding present)

**Positive fixture (passes):**

```json
{
  "name": "example_tool",
  "description": "...",
  "inputSchema": {}
}
```

**Negative fixture (fires the rule):**

```json
{
  "name": "example_tool",
  "description": "...",
  "inputSchema": {}
}
```

**Expected finding for the negative fixture:**

```
MTQS-XXX: <message>
```

---

## Registry

- [ ] Rule has an entry in `spec/mtqs-v0.1.yaml` (id, severity, dimension, fixHint)

Paste the YAML entry:

```yaml
- id: MTQS-XXX
  dimension: schema
  severity: error
  description: "..."
  fixHint: "..."
```

---

## Determinism

- [ ] No IO / no network / no LLM in the rule body
- [ ] Output is byte-identical across runs (pure function of `RuleContext`)

If any of the above boxes cannot be checked, this rule is an L4 candidate, not an L1 rule.
See [SCOPE.md §3](../../spec/SCOPE.md) for the full determinism guarantee.

---

## Checklist

- [ ] `npm test` passes with the new rule and both fixtures
- [ ] `npm --workspace @voke-sh/voke run build` exits 0
- [ ] No `any` types introduced
- [ ] No em dashes in prose (project editorial convention)

---

*All rule PRs are governed by [SCOPE.md §4](../../spec/SCOPE.md) -- the scope creep prevention
rule. Citing Glama as a primary source is prohibited. Primary sources are: the MCP
specification, Anthropic's published agent-tool guidance, JSON Schema 2020-12, and
peer-reviewed papers.*
