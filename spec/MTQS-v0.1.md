# MCP Tool Quality Specification (MTQS) v0.1

## Abstract

The MCP Tool Quality Specification (MTQS) is an open, versioned, deterministic, auditable ruleset for evaluating MCP tool surface quality. A tool definition is a contract between a deterministic system (the MCP server) and a non-deterministic agent (the LLM). When that contract is incomplete, ambiguous, or structurally broken, agents fail in ways that are hard to attribute: wrong tool selection, hallucinated parameter values, unnecessary confirmation prompts, and silent data loss. MTQS v0.1 delivers three artifacts: (1) this specification document, a normative per-rule rubric with primary-source citations and a published scoring formula; (2) a machine-readable YAML rule registry that is the single source of truth for rule IDs, severities, and fix hints; and (3) a reference linter (`voke lint`) that implements every rule deterministically. Same input always yields same output, every run, on any platform. No model in the loop.

---

## 1. Motivation and Scope

### 1.1 The Problem

97.1% of tools surveyed across 856 MCP tools from 103 servers have at least one quality smell, according to the academic study "MCP Tool Descriptions Are Smelly" (arxiv:2602.14878, Hasan et al., Feb 2026). The most prevalent defect, Opaque Parameters, affects 84.3% of tools. Despite this, no open standard exists that defines what a "well-designed MCP tool" means, what rules govern it, and how to score it reproducibly.

The only scoring systems in wide use are closed-source, LLM-based, and non-reproducible. Two runs of the same server against such a system can produce different scores. This makes LLM-judge scores unsuitable as CI gates: a system that should reject a broken release must produce the same answer every time.

MTQS fills this gap: an open specification for which the linter is the reference implementation, in the ESLint / WCAG / AsyncAPI model. Own the standard, own the ecosystem.

### 1.2 What MTQS Is

MTQS v0.1 is:

- **Deterministic**: the same `tools/list` response produces the same per-rule findings, the same per-tool scores, and the same server score on every run, on every platform.
- **Auditable**: every finding traces to exactly one rule; every rule traces to a primary source (MCP spec, Anthropic engineering guidance, JSON Schema 2020-12, or peer-reviewed academic work).
- **Rule-per-finding**: each finding identifies the specific rule that fired, the parameter or field that violated it, and the verbatim fix hint from the registry.
- **CI-gradeable**: the `--min-score` flag makes `voke lint` a binary gate suitable for GitHub Actions and any other CI system.

### 1.3 What MTQS Is Not

MTQS v0.1 is explicitly **not**:

- An LLM-as-judge: no model call appears in any rule function. Rules are pure TypeScript functions over typed `ToolSnapshot` objects. No IO, no randomness.
- An API gateway or proxy: Voke reads `tools/list` as a read-only observer and never sits in the execution path of tool calls.
- A runtime monitor: no scheduling, no alerting, no health checks. These belong to L3 of the Voke roadmap.
- An agent evaluator: MTQS does not execute tools or run agent loops. Whether an agent *succeeds* using a tool is an L4 evaluation concern.
- A semantic linter: MTQS checks mechanical properties. Whether a description is *clear* or *accurate* requires a model; that is L4.

See `spec/SCOPE.md` for the complete L1 boundary statement.

---

## 2. Dimensions

MTQS v0.1 groups its 22 rules into five dimensions. Each dimension has a weight multiplier that scales the base severity penalty (§4.2). Dimensions are ordered by their importance to agent usability and safety.

| Dimension | Tier | Weight | Rule Count | Primary Source |
|-----------|------|--------|-----------|----------------|
| Schema Correctness | T1 | 1.5× | 8 | MCP spec JSON Schema Usage; JSON Schema 2020-12 |
| Annotation Transparency | T1 | 1.5× | 6 | MCP spec ToolAnnotations; schema.ts |
| Description-as-Prompt | T2 | 1.2× | 3 | Anthropic "Writing effective tools for agents" |
| Parameter Semantics | T2 | 1.2× | 2 | Anthropic principle 5; arxiv:2602.14878 |
| Naming | T3 | 1.0× | 3 | SEP-986; MCP spec |

**Schema Correctness (T1, 1.5×):** The correctness floor. A broken `inputSchema` means the tool literally cannot be used: agents cannot know what arguments to send, clients cannot validate calls, and the MCP protocol contract is violated. Eight rules cover presence, root type, structural validity, external reference prohibition, depth bounds, output schema validity, required-array explicitness, and bare-object anti-patterns.

**Annotation Transparency (T1, 1.5×):** The safety-critical differentiator. The MCP spec defines cautious defaults: `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`. An unannotated tool is assumed to be maximally risky. No other known tool checks annotation consistency mechanically. Six rules cover annotation presence and the four behavioral hints, plus the read/write cross-constraint.

**Description-as-Prompt (T2, 1.2×):** Agent usability. A tool description is a prompt: it is what the agent reads when deciding which tool to call. Anthropic engineering guidance (Sep 2025) shows that "small refinements to descriptions yielded dramatic benchmark improvements" on SWE-bench Verified. Three rules cover description presence, minimum length, and the name-copy anti-pattern.

**Parameter Semantics (T2, 1.2×):** Parameter quality. The Opaque Parameters smell, the most mechanically detectable, affects 84.3% of tools. Two rules cover per-property descriptions and the enum anti-pattern for constrained string values.

**Naming (T3, 1.0×):** Spec compliance floor. Names must be within the MCP spec length bounds, use allowed characters, and be unique within a server. Three rules cover length/presence, character set, and server-level uniqueness.

---

## 3. Rules

Each rule section below follows the MTQS rubric template. The `{#MTQS-XXX}` anchor makes every rule independently linkable. Fix hints are verbatim from the YAML registry (`spec/mtqs-v0.1.yaml`). If they differ, the registry is authoritative.

---

### MTQS-S01: inputSchema Presence {#MTQS-S01}

| Property | Value |
|----------|-------|
| **Dimension** | Schema Correctness |
| **Severity** | `error` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [MCP spec: JSON Schema Usage](https://modelcontextprotocol.io/specification/draft/basic/index#json-schema-usage) |

**What it checks:** `inputSchema` is present and non-null on the tool definition.

**Why it matters:** The MCP specification states that "`inputSchema` MUST be a valid JSON Schema object (not `null`)." Without `inputSchema`, agents have no typed contract describing what arguments to send. They must guess, which produces hallucinated argument names, wrong types, and tool-call failures. An absent schema is the most fundamental quality defect a tool can have. Hard tier cap: D (≤69). A tool without a schema is unusable.

**Passing example:**
```json
{
  "name": "get_user",
  "description": "Retrieve a user record by ID. Returns id, name, email, and role fields.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "user_id": { "type": "string", "description": "The UUID of the user to retrieve" }
    },
    "required": ["user_id"]
  }
}
```

**Failing example:**
```json
{
  "name": "get_user",
  "description": "Retrieve a user record by ID.",
  "inputSchema": null
}
```

**Finding message:** `MTQS-S01 [error] inputSchema is absent or null: agents cannot determine what arguments to send`

**Fix hint:** Add `"inputSchema": {"type": "object", "properties": {}, "additionalProperties": false}` for tools that take no parameters. The MCP spec mandates a valid JSON Schema object.

---

### MTQS-S02: inputSchema Root Type {#MTQS-S02}

| Property | Value |
|----------|-------|
| **Dimension** | Schema Correctness |
| **Severity** | `error` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [MCP spec: JSON Schema Usage](https://modelcontextprotocol.io/specification/draft/basic/index#json-schema-usage) |

**What it checks:** The root of `inputSchema` has `"type": "object"`.

**Why it matters:** MCP tool arguments are always passed as a JSON object (key-value pairs), never as a bare array or primitive. The MCP spec and SEP-2106 both require that `inputSchema` root have `type: "object"`. A schema with `type: "array"` or no type at all will cause client validation to reject calls or pass them through unchecked. Every MCP client assumes an object at the root.

**Passing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" }
    }
  }
}
```

**Failing example:**
```json
{
  "inputSchema": {
    "type": "array",
    "items": { "type": "string" }
  }
}
```

**Finding message:** `MTQS-S02 [error] inputSchema root type is "array": MCP tool arguments must be a JSON object`

**Fix hint:** Set the top-level `"type"` field of inputSchema to `"object"`. Tool arguments are always key-value pairs, not a bare array or primitive.

---

### MTQS-S03: inputSchema Structural Validity {#MTQS-S03}

| Property | Value |
|----------|-------|
| **Dimension** | Schema Correctness |
| **Severity** | `error` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) |

**What it checks:** `inputSchema` is structurally valid JSON Schema 2020-12, with no unknown top-level keywords, no malformed `$ref` values, and no type values outside the JSON Schema vocabulary.

**Why it matters:** MCP implementations validate tool calls against `inputSchema`. If the schema itself fails validation against the JSON Schema 2020-12 meta-schema, client validation is undefined: some clients silently pass all calls through, others reject all calls. Either way the contract is broken. The MCP spec requires JSON Schema 2020-12 compliance; structural validity is the prerequisite. Hard tier cap: D (≤69). A structurally invalid schema is non-functional.

**Passing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "limit": { "type": "integer", "minimum": 1, "maximum": 100 }
    },
    "required": []
  }
}
```

**Failing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "unknownKeyword": true,
    "properties": {
      "limit": { "typ": "integer" }
    }
  }
}
```

**Finding message:** `MTQS-S03 [error] inputSchema fails JSON Schema 2020-12 validation: unknown keyword "unknownKeyword"`

**Fix hint:** Validate inputSchema against the JSON Schema 2020-12 meta-schema. Common errors: unknown keywords, incorrect type values, malformed $ref.

---

### MTQS-S04: No External $ref {#MTQS-S04}

| Property | Value |
|----------|-------|
| **Dimension** | Schema Correctness |
| **Severity** | `error` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [MCP spec: JSON Schema Usage](https://modelcontextprotocol.io/specification/draft/basic/index#json-schema-usage) |

**What it checks:** No unresolved external `$ref` URIs appear in `inputSchema` or `outputSchema`. No `$ref` values point outside the `$defs` block of the same schema object.

**Why it matters:** The MCP spec states that "implementations MUST NOT automatically dereference `$ref` values that resolve to a network URI." This is both a security requirement (auto-dereffing a URL fetches attacker-controlled content) and a determinism requirement (a remote schema can change). The spec further states that "schemas that fail to validate due to an unresolved external `$ref` SHOULD be rejected rather than silently treated as permissive." External refs make the tool non-functional in compliant clients. Hard tier cap: C (≤79). The tool is usable but compromised.

**Passing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "address": { "$ref": "#/$defs/Address" }
    },
    "$defs": {
      "Address": {
        "type": "object",
        "properties": {
          "street": { "type": "string" },
          "city": { "type": "string" }
        }
      }
    }
  }
}
```

**Failing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "address": { "$ref": "https://example.com/schemas/address.json" }
    }
  }
}
```

**Finding message:** `MTQS-S04 [error] inputSchema contains external $ref "https://example.com/schemas/address.json": MCP implementations must not auto-dereference network URIs`

**Fix hint:** Move all schema definitions into `$defs` within the schema object and use local `$ref` values (e.g. `"#/$defs/MyType"`). Do not reference external URLs.

---

### MTQS-S05: Schema Nesting Depth {#MTQS-S05}

| Property | Value |
|----------|-------|
| **Dimension** | Schema Correctness |
| **Severity** | `warning` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [MCP spec: JSON Schema Usage](https://modelcontextprotocol.io/specification/draft/basic/index#json-schema-usage) |

**What it checks:** Schema nesting depth does not exceed 5 levels (MTQS-RECOMMENDED; not MCP-mandated).

**Why it matters:** The MCP spec states that "composition keywords (`anyOf`, `oneOf`, `allOf`, `if`/`then`/`else`) and `$defs` enable expressive schemas but can be expensive to validate. Implementations SHOULD apply reasonable bounds, such as a maximum schema depth, a cap on the total number of subschemas, or a per-validation time budget, to prevent a malicious schema from acting as a Denial-of-Service vector." The MTQS-RECOMMENDED depth limit of 5 levels is a practical default derived from this guidance; legitimate schemas rarely need deeper nesting. If your schema requires depth >5, consider using `$defs` references to flatten it.

**Passing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "filter": {
        "type": "object",
        "properties": {
          "date_range": {
            "type": "object",
            "properties": {
              "start": { "type": "string", "format": "date" }
            }
          }
        }
      }
    }
  }
}
```

**Failing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "l1": { "type": "object", "properties": {
        "l2": { "type": "object", "properties": {
          "l3": { "type": "object", "properties": {
            "l4": { "type": "object", "properties": {
              "l5": { "type": "object", "properties": {
                "l6": { "type": "string" }
              }}
            }}
          }}
        }}
      }}
    }
  }
}
```

**Finding message:** `MTQS-S05 [warning] inputSchema nesting depth is 6, exceeding MTQS-RECOMMENDED maximum of 5`

**Fix hint:** Flatten deeply nested schemas using `$defs` for reuse. The MCP spec SHOULD bound schema depth to prevent denial-of-service; MTQS recommends 5 levels max.

---

### MTQS-S06: outputSchema Structural Validity {#MTQS-S06}

| Property | Value |
|----------|-------|
| **Dimension** | Schema Correctness |
| **Severity** | `error` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) |

**What it checks:** `outputSchema`, if present, is structurally valid JSON Schema 2020-12.

**Why it matters:** MCP clients use `outputSchema` to validate tool responses and help agents parse structured output. An invalid `outputSchema` breaks this client-side validation, producing the same pathologies as an invalid `inputSchema`: undefined behavior, silent pass-through, or rejection of all responses. The MCP spec and SEP-2106 apply the same JSON Schema 2020-12 rules to `outputSchema` as to `inputSchema`. Hard tier cap: D (≤69). A structurally invalid output schema is non-functional.

**Passing example:**
```json
{
  "outputSchema": {
    "type": "object",
    "properties": {
      "users": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "name": { "type": "string" }
          },
          "required": ["id", "name"]
        }
      }
    },
    "required": ["users"]
  }
}
```

**Failing example:**
```json
{
  "outputSchema": {
    "type": "object",
    "xInvalidKeyword": true,
    "properties": {
      "result": { "typ": "string" }
    }
  }
}
```

**Finding message:** `MTQS-S06 [error] outputSchema fails JSON Schema 2020-12 validation: unknown keyword "xInvalidKeyword"`

**Fix hint:** Validate outputSchema against the JSON Schema 2020-12 meta-schema just as you would inputSchema. Remove or correct any unknown keywords or malformed `$ref`.

---

### MTQS-S07: Required Array Presence {#MTQS-S07}

| Property | Value |
|----------|-------|
| **Dimension** | Schema Correctness |
| **Severity** | `warning` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) |

**What it checks:** A `required` array is present whenever `properties` is defined in `inputSchema`, even if the array is empty.

**Why it matters:** JSON Schema 2020-12 best practice requires that required/optional semantics be declared explicitly. When `properties` is defined but `required` is absent, every property is implicitly optional. Agents cannot determine which arguments must be provided versus which are optional, leading to omitted required arguments or over-provided optional ones. An explicit `"required": []` for all-optional schemas is the correct signal.

**Passing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" },
      "limit": { "type": "integer", "description": "Max results (default 25)" }
    },
    "required": ["query"]
  }
}
```

**Failing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query" },
      "limit": { "type": "integer", "description": "Max results" }
    }
  }
}
```

**Finding message:** `MTQS-S07 [warning] inputSchema.properties is defined but "required" array is absent: required/optional semantics are implicit`

**Fix hint:** Add `"required": []` or list the mandatory fields explicitly. JSON Schema best practice requires explicit required/optional declaration for clarity.

---

### MTQS-S08: No Bare Untyped Properties {#MTQS-S08}

| Property | Value |
|----------|-------|
| **Dimension** | Schema Correctness |
| **Severity** | `warning` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [JSON Schema 2020-12](https://json-schema.org/draft/2020-12) |

**What it checks:** No property in `inputSchema.properties` uses a bare `{}` (empty object) schema. Every property must have at least a `type` keyword or a `$ref`.

**Why it matters:** A bare `{}` property accepts any JSON value: string, number, object, array, null. Agents have no type information to guide argument construction, increasing the chance of wrong-type arguments. JSON Schema 2020-12 best practice, and Anthropic guidance on parameter semantics, both require typed properties. Bare schemas are a mechanical signal of Opaque Parameters (84.3% prevalence per arxiv:2602.14878).

**Passing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "user_id": { "type": "string", "description": "UUID of the user" },
      "metadata": { "type": "object", "description": "Arbitrary key-value metadata" }
    }
  }
}
```

**Failing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "user_id": {},
      "metadata": {}
    }
  }
}
```

**Finding message:** `MTQS-S08 [warning] inputSchema.properties.user_id uses bare {} schema: no type information provided for agents`

**Fix hint:** Specify `"type"` or a composition keyword (`oneOf`, `anyOf`, `$ref`) for every property. Bare `{}` schemas give agents no type information and fail 2020-12 best practice.

---

### MTQS-D01: Description Presence {#MTQS-D01}

| Property | Value |
|----------|-------|
| **Dimension** | Description-as-Prompt |
| **Severity** | `error` |
| **Scope** | `per-tool` |
| **Weight** | 1.2× |
| **Introduced** | v0.1 |
| **Source** | [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) |

**What it checks:** The `description` field is present and non-empty on the tool definition.

**Why it matters:** Anthropic engineering guidance (Sep 2025) states that "small refinements to descriptions yielded dramatic benchmark improvements" on SWE-bench Verified. A tool without a description forces the agent to infer purpose from the name alone, a guessing game that fails at scale. The academic study arxiv:2602.14878 found that 56% of tools have the "Unclear Purpose" smell, the most common category. Without a description, the agent cannot decide when to call the tool, what it returns, or how to use its output. This is the most fundamental description defect.

**Passing example:**
```json
{
  "name": "search_contacts",
  "description": "Search CRM contacts by name, email, or phone number. Returns matching contact records with id, name, email, and phone fields. Use before creating a new contact to check for duplicates."
}
```

**Failing example:**
```json
{
  "name": "search_contacts",
  "description": ""
}
```

**Finding message:** `MTQS-D01 [error] description is absent or empty: agents cannot determine what this tool does`

**Fix hint:** Add a description explaining what the tool does, when to use it, and what it returns. Prompt-engineering tool descriptions dramatically reduces agent error rates.

---

### MTQS-D02: Description Minimum Length {#MTQS-D02}

| Property | Value |
|----------|-------|
| **Dimension** | Description-as-Prompt |
| **Severity** | `warning` |
| **Scope** | `per-tool` |
| **Weight** | 1.2× |
| **Introduced** | v0.1 |
| **Source** | [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) |

**What it checks:** The tool `description` is at least 20 characters long.

**Why it matters:** Anthropic guidance on description quality notes that descriptions must cover what the tool does, when to use it, and what it returns. A description under 20 characters cannot convey all three. Single-word descriptions ("Search", "Delete") are worse than no description because they satisfy the presence check while conveying near-zero information. The "Underspecified or Incomplete" smell affects the majority of tools in arxiv:2602.14878. The 20-character floor is a mechanical proxy for the minimum viable description.

**Passing example:**
```json
{
  "description": "Search contacts by name or email."
}
```

**Failing example:**
```json
{
  "description": "Search"
}
```

**Finding message:** `MTQS-D02 [warning] description is 6 characters: minimum is 20 characters for a meaningful description`

**Fix hint:** Expand the description to cover what the tool does, when to use it, and what it returns. Single-word or single-phrase descriptions rarely provide agents enough context for correct selection.

---

### MTQS-D03: Description Not a Name Copy {#MTQS-D03}

| Property | Value |
|----------|-------|
| **Dimension** | Description-as-Prompt |
| **Severity** | `error` |
| **Scope** | `per-tool` |
| **Weight** | 1.2× |
| **Introduced** | v0.1 |
| **Source** | [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) |

**What it checks:** The tool `description` is not a byte-for-byte copy of the tool `name`.

**Why it matters:** Anthropic engineering guidance identifies the "Unclear Purpose" smell (56% prevalence) as the description that offers no information beyond the name. A description exactly equal to the name, such as `name: "search"` with `description: "search"`, adds zero information. The agent already has the name. This is the most mechanically detectable form of the Unclear Purpose smell. Hard tier cap: C (≤79). A tool whose description is identical to its name has no genuine description.

**Passing example:**
```json
{
  "name": "search",
  "description": "Full-text search across all indexed documents. Returns up to 20 matching results sorted by relevance."
}
```

**Failing example:**
```json
{
  "name": "search",
  "description": "search"
}
```

**Finding message:** `MTQS-D03 [error] description is a byte-for-byte copy of the tool name "search": adds no information`

**Fix hint:** Replace the name-copy with a real description of what the tool does and returns. A description equal to the name is the Unclear Purpose smell.

---

### MTQS-N01: Tool Name Presence and Length {#MTQS-N01}

| Property | Value |
|----------|-------|
| **Dimension** | Naming |
| **Severity** | `error` |
| **Scope** | `per-tool` |
| **Weight** | 1.0× |
| **Introduced** | v0.1 |
| **Source** | [SEP-986: Specify Format for Tool Names](https://modelcontextprotocol.io/seps/986-specify-format-for-tool-names) |

**What it checks:** The tool `name` is present, non-empty, and between 1 and 128 characters in length.

**Why it matters:** The MCP spec requires a non-empty tool name; names over 128 characters violate the MCP specification and will be rejected by compliant clients. SEP-986 (Final, 2025-07-16) further recommends names between 1 and 64 characters. The tighter recommendation reflects real-world client prompt-budget constraints where long names consume tokens that should describe the tool's purpose. The 128-character threshold is the hard spec limit (error); the 64-character recommendation from SEP-986 is captured in the fix hint as a best practice.

**Passing example:**
```json
{
  "name": "crm_search_contacts"
}
```

**Failing example:**
```json
{
  "name": "search_for_contacts_in_the_crm_system_using_multiple_criteria_including_name_email_phone_and_company_with_pagination_support_and_sorting_options"
}
```

**Finding message:** `MTQS-N01 [error] tool name is 141 characters: maximum is 128 per MCP spec (SEP-986 recommends 1–64)`

**Fix hint:** Keep the tool name between 1 and 64 characters (SEP-986 recommendation) and at most 128 characters (MCP spec limit). Names over 128 chars will be rejected by clients.

---

### MTQS-N02: Tool Name Character Set {#MTQS-N02}

| Property | Value |
|----------|-------|
| **Dimension** | Naming |
| **Severity** | `error` |
| **Scope** | `per-tool` |
| **Weight** | 1.0× |
| **Introduced** | v0.1 |
| **Source** | [SEP-986: Specify Format for Tool Names](https://modelcontextprotocol.io/seps/986-specify-format-for-tool-names) |

**What it checks:** The tool `name` contains only allowed characters: `[A-Za-z0-9_\-./]`. No spaces, commas, or other special characters are permitted.

**Why it matters:** SEP-986 (Final) specifies that "Tool names SHOULD NOT contain spaces, commas, or other special characters." The allowed character set is letters, digits, underscore, dash, dot, and forward-slash. Names with spaces or commas cause parsing failures in many MCP clients and prompt-construction libraries that use tool names as unquoted identifiers. The character constraint is both a spec compliance requirement and a practical interoperability requirement.

**Passing example:**
```json
{
  "name": "crm/search_contacts"
}
```

**Failing example:**
```json
{
  "name": "search contacts, all"
}
```

**Finding message:** `MTQS-N02 [error] tool name "search contacts, all" contains illegal characters (space, comma): allowed: [A-Za-z0-9_\\-./]`

**Fix hint:** Rename using only `[A-Za-z0-9_\-./]` characters. Use underscore or dash as word separators. Spaces and commas cause parsing failures in many MCP clients.

---

### MTQS-N03: Tool Name Uniqueness {#MTQS-N03}

| Property | Value |
|----------|-------|
| **Dimension** | Naming |
| **Severity** | `error` |
| **Scope** | `server` |
| **Weight** | 1.0× |
| **Introduced** | v0.1 |
| **Source** | [SEP-986: Specify Format for Tool Names](https://modelcontextprotocol.io/seps/986-specify-format-for-tool-names) |

**What it checks:** Tool names are unique within the server. No two tools share the same `name` (server-scoped rule, evaluated across the full `tools/list` response).

**Why it matters:** SEP-986 states "Tool names SHOULD be unique within their namespace." Duplicate names cause non-deterministic tool dispatch: when an agent calls a tool by name, the runtime must arbitrarily pick one of the duplicates, or error. Either outcome is incorrect. Agents build mental models of available tools by name; duplicates shatter that model. This is the only server-scoped rule in MTQS v0.1, evaluated after all per-tool rules are complete.

**Passing example:**
```json
[
  { "name": "crm_search_contacts" },
  { "name": "files_search_documents" }
]
```

**Failing example:**
```json
[
  { "name": "search" },
  { "name": "search" }
]
```

**Finding message:** `MTQS-N03 [error] tool name "search" is duplicated: 2 tools share this name, causing non-deterministic dispatch`

**Fix hint:** Rename one of the colliding tools to uniquely identify it within the server. Use namespace prefixes (e.g., `crm_search` vs `files_search`) to avoid collisions.

---

### MTQS-P01: Parameter Descriptions {#MTQS-P01}

| Property | Value |
|----------|-------|
| **Dimension** | Parameter Semantics |
| **Severity** | `warning` |
| **Scope** | `per-tool` |
| **Weight** | 1.2× |
| **Introduced** | v0.1 |
| **Source** | [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) |

**What it checks:** Every property in `inputSchema.properties` has a non-empty `description`.

**Why it matters:** Anthropic engineering guidance (Sep 2025) explicitly states: "instead of a parameter named `user`, try a parameter named `user_id`" and notes that description refinements "yielded dramatic benchmark improvements" on SWE-bench Verified. The "Opaque Parameters" smell is the most prevalent mechanically-detectable defect at 84.3% of tools (arxiv:2602.14878). Agents filling parameter values without descriptions must guess meaning from property names alone. That guessing fails for non-obvious names like `q`, `ctx`, `opts`, or `f`.

**Passing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "user_id": {
        "type": "string",
        "description": "UUID of the user whose profile to retrieve. Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      },
      "include_deleted": {
        "type": "boolean",
        "description": "When true, includes soft-deleted user records in the response. Default: false."
      }
    }
  }
}
```

**Failing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "user_id": { "type": "string" },
      "include_deleted": { "type": "boolean" }
    }
  }
}
```

**Finding message:** `MTQS-P01 [warning] inputSchema.properties.user_id has no description: agents cannot determine its meaning or constraints`

**Fix hint:** Add a `"description"` to each parameter explaining its meaning, type constraints, and valid values. Use descriptive names like `user_id` instead of bare `user`.

---

### MTQS-P02: Enum for Constrained Strings {#MTQS-P02}

| Property | Value |
|----------|-------|
| **Dimension** | Parameter Semantics |
| **Severity** | `warning` |
| **Scope** | `per-tool` |
| **Weight** | 1.2× |
| **Introduced** | v0.1 |
| **Source** | [Anthropic: Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) |

**What it checks:** Properties whose values are drawn from a finite, known set of strings use `"enum"` rather than free-text `"type": "string"`.

**Why it matters:** Anthropic guidance (Sep 2025) identifies "optional `response_format` enum parameters allowing agents to request detailed or concise outputs" as a token-efficiency pattern. JSON Schema best practice uses `enum` for constrained value sets. Without `enum`, agents must guess valid values for parameters like `"status"`, `"format"`, or `"sort_order"`, producing hallucinated values that the API rejects. The fix is mechanical: if the valid values are known and finite, enumerate them.

**Passing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": ["active", "inactive", "pending"],
        "description": "Filter contacts by account status"
      }
    }
  }
}
```

**Failing example:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "description": "Filter by status. One of: active, inactive, pending."
      }
    }
  }
}
```

**Finding message:** `MTQS-P02 [warning] inputSchema.properties.status appears to have a finite value set described in text: consider using "enum" to enforce valid values`

**Fix hint:** Replace free-text string parameters like `"status"` or `"format"` with `"enum": ["value1", "value2", ...]` to constrain the valid value set.

---

### MTQS-A01: Annotations Presence {#MTQS-A01}

| Property | Value |
|----------|-------|
| **Dimension** | Annotation Transparency |
| **Severity** | `info` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [MCP schema: ToolAnnotations](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts) |

**What it checks:** The `annotations` object is present on the tool definition.

**Why it matters:** The MCP specification defines cautious defaults for all annotation fields: `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`. An unannotated tool is therefore assumed to be maximally risky: non-read-only, destructive, non-idempotent, and open-world. For read-only lookup tools like `get_user`, this default posture causes agents to add unnecessary confirmation prompts before every call. Annotation presence is an `info`-severity finding (report-only, no score impact) because the real penalty falls on the specific missing hints (A02–A05). This finding signals the overall absence of risk metadata.

**Passing example:**
```json
{
  "name": "get_user",
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false
  }
}
```

**Failing example:**
```json
{
  "name": "get_user"
}
```

**Finding message:** `MTQS-A01 [info] annotations object is absent: tool defaults to the most-risky posture (readOnly=false, destructive=true, idempotent=false)`

**Fix hint:** Add `"annotations": {}` and set at minimum `readOnlyHint` and `destructiveHint`. Unannotated tools default to the most restrictive risk posture.

---

### MTQS-A02: readOnlyHint Presence {#MTQS-A02}

| Property | Value |
|----------|-------|
| **Dimension** | Annotation Transparency |
| **Severity** | `warning` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [MCP schema: ToolAnnotations](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts) |

**What it checks:** `readOnlyHint` is explicitly set as a boolean in the `annotations` object.

**Why it matters:** The MCP schema defines `readOnlyHint` with a default of `false`: "If true, the tool does not modify its environment." An unset `readOnlyHint` signals to agents that the tool may modify its environment, even for pure read operations like `list_users` or `get_contact`. This causes agents to add unnecessary confirmation prompts before read operations, degrading usability. Explicit annotation removes ambiguity: agents can confidently call read-only tools without confirmation overhead.

**Passing example:**
```json
{
  "annotations": {
    "readOnlyHint": true
  }
}
```

**Failing example:**
```json
{
  "annotations": {
    "destructiveHint": false
  }
}
```

**Finding message:** `MTQS-A02 [warning] readOnlyHint is not set: default is false (tool may modify environment), which may cause unnecessary confirmation prompts for read-only tools`

**Fix hint:** Set `"readOnlyHint": true` if the tool only reads data; false if it writes. Do not leave the agent to assume the worst (default is false = may modify).

---

### MTQS-A03: destructiveHint Presence {#MTQS-A03}

| Property | Value |
|----------|-------|
| **Dimension** | Annotation Transparency |
| **Severity** | `warning` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [MCP schema: ToolAnnotations](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts) |

**What it checks:** `destructiveHint` is explicitly set as a boolean in the `annotations` object.

**Why it matters:** The MCP schema defines `destructiveHint` with a default of `true`: "If true, the tool may perform destructive updates. If false, performs only additive updates." An unset `destructiveHint` signals that the tool may perform destructive operations, even for additive operations like `create_contact` or `append_note`. This causes agents to prompt for confirmation before every additive operation, creating friction on benign actions. Setting `destructiveHint: false` on additive tools reduces confirmation friction and improves agent throughput.

**Passing example:**
```json
{
  "annotations": {
    "readOnlyHint": false,
    "destructiveHint": false
  }
}
```

**Failing example:**
```json
{
  "annotations": {
    "readOnlyHint": false
  }
}
```

**Finding message:** `MTQS-A03 [warning] destructiveHint is not set: default is true (tool may perform destructive updates), which causes unnecessary confirmation prompts for additive tools`

**Fix hint:** Set `"destructiveHint": false` for additive operations (create/append); `true` for delete/overwrite. Default is true, meaning destructive assumed.

---

### MTQS-A04: idempotentHint Presence {#MTQS-A04}

| Property | Value |
|----------|-------|
| **Dimension** | Annotation Transparency |
| **Severity** | `info` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [MCP schema: ToolAnnotations](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts) |

**What it checks:** `idempotentHint` is explicitly set as a boolean in the `annotations` object.

**Why it matters:** The MCP schema defines `idempotentHint` with a default of `false`: "If true, calling the tool repeatedly with same args has no additional effect." Idempotency is a retry-safety signal. When `idempotentHint: true`, agents know that failed calls can be safely retried without double-effects. Without this signal, agents must assume retry is unsafe, leading to more user interruptions and slower error recovery in agentic workflows. This is an `info`-severity finding (report-only, no score impact) because idempotency is context-dependent and not all tools can declare it.

**Passing example:**
```json
{
  "annotations": {
    "idempotentHint": true
  }
}
```

**Failing example:**
```json
{
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false
  }
}
```

**Finding message:** `MTQS-A04 [info] idempotentHint is not set: agents cannot determine if retrying this tool is safe`

**Fix hint:** Set `"idempotentHint": true` if repeated calls with the same args produce no additional effect (safe to retry on failure). Default is false.

---

### MTQS-A05: openWorldHint Presence {#MTQS-A05}

| Property | Value |
|----------|-------|
| **Dimension** | Annotation Transparency |
| **Severity** | `info` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [MCP schema: ToolAnnotations](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts) |

**What it checks:** `openWorldHint` is explicitly set as a boolean in the `annotations` object.

**Why it matters:** The MCP schema defines `openWorldHint` with a default of `true`: "If true, may interact with an 'open world' of external entities." For closed-domain tools that only touch internal databases or local files, an unset `openWorldHint` causes agents to assume external network interaction, leading to unnecessary caution, extra confirmation prompts in privacy-sensitive contexts, and misaligned risk assessment. Setting `openWorldHint: false` on internal tools enables agents to treat them with lower risk posture. This is an `info`-severity finding (report-only, no score impact).

**Passing example:**
```json
{
  "annotations": {
    "openWorldHint": false
  }
}
```

**Failing example:**
```json
{
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true
  }
}
```

**Finding message:** `MTQS-A05 [info] openWorldHint is not set: default is true (tool may interact with external entities)`

**Fix hint:** Set `"openWorldHint": false` for closed-domain tools (local file, internal DB); true for tools touching external APIs or the internet. Default is true.

---

### MTQS-A06: Read-Only + Destructive Contradiction {#MTQS-A06}

| Property | Value |
|----------|-------|
| **Dimension** | Annotation Transparency |
| **Severity** | `error` |
| **Scope** | `per-tool` |
| **Weight** | 1.5× |
| **Introduced** | v0.1 |
| **Source** | [MCP schema: ToolAnnotations](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts) |

**What it checks:** When `readOnlyHint` is `true`, `destructiveHint` is not simultaneously `true`.

**Why it matters:** The MCP schema source explicitly states: "`destructiveHint` and `idempotentHint` are only meaningful when `readOnlyHint == false`." A tool marked both read-only and destructive is a logical contradiction: a read-only tool cannot perform destructive updates by definition. This annotation combination signals a misconfiguration; the developer likely copied an annotation template without adapting it. Agents may incorrectly apply destructive-operation risk policies (extra confirmation, audit logging) to read-only tools that do not warrant them, or apply read-only optimistic policies to tools that are actually destructive. Hard tier cap: C (≤79).

**Passing example:**
```json
{
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true
  }
}
```

**Failing example:**
```json
{
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": true
  }
}
```

**Finding message:** `MTQS-A06 [error] annotations.readOnlyHint is true and annotations.destructiveHint is true: a read-only tool cannot be destructive`

**Fix hint:** Set `destructiveHint: false` (or omit it) when `readOnlyHint: true`. The MCP schema notes `destructiveHint` is only meaningful when `readOnlyHint == false`.

---

## 4. Scoring Formula

### 4.0 The Formula

Per tool:

    penalty(finding) = round(basePenalty × dimensionMultiplier)
    rawScore         = max(0, 100 − Σ penalty(finding))
    toolScore        = min(rawScore, lowestHardCap)   // caps only lower a grade, never add deductions

Per server:

    serverScore = round(mean(toolScore for every tool))

That is the entire model. Everything below is the value of one variable in these formulas.

| Variable | Defined in |
|----------|------------|
| `basePenalty` (15 / 5 / 0) | §4.1 Severity Penalties |
| `dimensionMultiplier` (1.5× / 1.2× / 1.0×) | §4.2 Dimension Multipliers |
| `lowestHardCap` | §4.3 Hard Tier Caps |
| why round per finding | §4.4 Determinism Rules |
| score to tier (A–F) | §4.6 Tier Table |

**In plain terms.** The linter reports a set of problems for each tool. Every problem has a point cost set by how serious it is, and that cost is weighted up for problems in critical areas like schema and safety. Round each weighted cost to a whole number and subtract the sum from 100. If the tool has a fatal flaw, a hard cap then limits the highest grade it can earn, regardless of the points. The resulting number maps to a letter grade from A to F. A server's grade is the average of its tools' grades.

### 4.1 Severity Penalties

Base penalties are integers. `info` and `hint` are report-only: they surface as findings with fix hints but never reduce the score (Decision D-02).

| Severity | Base Penalty | Notes |
|----------|-------------|-------|
| `error` | 15 points | Spec violation or dangerous misconfiguration; one error moves a tool from A toward B |
| `warning` | 5 points | Quality deficit; three warnings = −15 points; meaningful without catastrophizing |
| `info` | 0 points | Report-only; annotates findings for developer awareness |
| `hint` | 0 points | Report-only; forward-looking guidance |

### 4.2 Dimension Multipliers

Penalties are scaled by a dimension multiplier encoding the D-09 weight tiers. The multiplier is applied per finding before summing.

| Dimension | Tier | Multiplier | Justification |
|-----------|------|-----------|---------------|
| `schema` | T1 | 1.5× | Correctness floor; broken schema = tool is unusable |
| `annotations` | T1 | 1.5× | Safety-critical; unannotated = maximal risk posture |
| `description` | T2 | 1.2× | Agent usability; Anthropic guidance; 97.1% smell prevalence |
| `parameters` | T2 | 1.2× | Opaque Parameters smell at 84.3% prevalence |
| `naming` | T3 | 1.0× | Spec compliance floor |

### 4.3 Hard Tier Caps

Some flaws are fatal, not merely costly. A hard cap sets the highest grade a tool can earn regardless of its point total, because a tool that agents cannot call must never score as "good."

Certain critical errors cap the achievable tier regardless of the numeric score. Caps are post-computation overrides applied as `min(rawScore, capValue)`, never modeled as additional point deductions (Pitfall 3 guard).

| Condition | Cap Level | Cap Value | Affected Rule(s) | Rationale |
|-----------|-----------|-----------|------------------|-----------|
| `MTQS-S01` error fires | D | 69 | S01 | No inputSchema = tool is unusable |
| `MTQS-S03` error fires | D | 69 | S03 | Invalid inputSchema = structurally broken |
| `MTQS-S06` error fires | D | 69 | S06 | Invalid outputSchema = structurally broken |
| `MTQS-S04` error fires | C | 79 | S04 | External $ref = spec violation + runtime hazard |
| `MTQS-A06` error fires | C | 79 | A06 | Dangerous annotation contradiction |
| `MTQS-D03` error fires | C | 79 | D03 | No genuine description; agent cannot understand tool |

Caps are per-tool, not server-level. Multiple caps in effect: apply `min(rawScore, lowestCap)`.

### 4.4 Determinism Rules (Rounding and Evaluation Order)

The score must be identical on every machine. Decimal math drifts across CPUs and JavaScript engines; whole-number math does not. So the formula rounds each penalty to a whole number first, then adds only whole numbers.

#### Rounding

To ensure scoring determinism across all JavaScript engines (no IEEE 754 floating-point accumulation differences), the formula uses integer-first arithmetic:

1. **Base penalties are integers:** 15 (`error`), 5 (`warning`), 0 (`info`/`hint`)
2. **Per-finding rounding:** `penalty = Math.round(basePenalty × multiplier)`, rounded immediately per finding
3. **Integer accumulation:** `totalPenalty = sum(roundedPenalties)`, summing integers with no float accumulation
4. **Score is integer subtraction:** `score = Math.max(0, 100 − totalPenalty)`
5. **Server score rounds once:** `serverScore = Math.round(mean(cappedToolScores))`

**Why this matters:** `Math.round(5 × 1.5) = Math.round(7.5) = 8`. Two such findings sum to `8 + 8 = 16`. Float-summing first: `7.5 + 7.5 = 15.0`, then round → `15`. The per-finding rounding approach avoids this difference. All MTQS-compliant implementations must use per-finding rounding.

#### Evaluation Order

**Fixed evaluation order (required for determinism):**

1. Rules are evaluated in alphabetical order by rule ID: `MTQS-A01`, `MTQS-A02`, ..., `MTQS-S01`, ..., `MTQS-S08`
2. Findings are sorted: `toolId` ascending → `ruleId` ascending → `path` ascending
3. The server score is computed after all per-tool scores are computed and sorted by `toolId`

#### Worked Example: `search` Tool (Poorly Designed)

```json
{
  "name": "search",
  "description": "search",
  "inputSchema": {
    "type": "object",
    "properties": {
      "q": {}
    }
  },
  "annotations": {}
}
```

| Rule | Severity | Dimension | Base | Multiplier | `Math.round(base × mult)` |
|------|----------|-----------|------|-----------|--------------------------|
| MTQS-D02 | warning | description | 5 | 1.2× | **6** |
| MTQS-D03 | error | description | 15 | 1.2× | **18** |
| MTQS-S07 | warning | schema | 5 | 1.5× | **8** |
| MTQS-S08 | warning | schema | 5 | 1.5× | **8** |
| MTQS-P01 | warning | parameters | 5 | 1.2× | **6** |
| MTQS-A02 | warning | annotations | 5 | 1.5× | **8** |
| MTQS-A03 | warning | annotations | 5 | 1.5× | **8** |

**Total deduction:** 18 + 6 + 8 + 8 + 6 + 8 + 8 = **62**

**Raw score:** 100 − 62 = **38**

**Cap check:** MTQS-D03 fires → cap C (≤79). `min(38, 79) = 38`. Cap does not bind (score is already below the cap value).

**Final score: 38, Tier F**

_Note: A01, A04, A05 fire as `info` findings (report-only, zero penalty). The `annotations: {}` block means A01 does not fire (annotations object is present); A02 and A03 fire because the hints are absent within the block._

#### Worked Example: `crm_search_contacts` Tool (Well Designed)

```json
{
  "name": "crm_search_contacts",
  "description": "Search CRM contacts by name, email, or phone. Returns up to 50 matching contacts. Use when you need to find an existing contact before creating a new one. Returns id, name, email, and phone fields.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query matching against name, email, or phone number"
      },
      "limit": {
        "type": "integer",
        "description": "Max results to return (1–50, default 25)"
      }
    },
    "required": ["query"]
  },
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false
  }
}
```

**Findings:** None. All 22 P1 rules pass.

**Raw score:** 100 − 0 = **100**

**Cap check:** No cap-triggering rules fired.

**Final score: 100, Tier A**

#### Server Score

Server score = `Math.round(mean(cappedToolScores))`, computed after all per-tool scores are capped, sorted by `toolId`.

For a server with `search` (38) and `crm_search_contacts` (100):

`serverScore = Math.round((38 + 100) / 2) = Math.round(69.0) = 69 (Tier D)`

### 4.5 Server Score Formula

```
serverScore    = Math.round(mean(cappedToolScores sorted by toolId))
serverTier     = tierFor(serverScore)
worstOffenders = cappedToolScores.sortAscending().slice(0, 5)
```

The worst-offenders list (bottom 5 tools by score) is the actionable fix target. The server cannot achieve tier A if its mean is pulled down by broken tools, but a single broken tool on a large server does not automatically tank the server score.

### 4.6 Tier Table

| Tier | Score Range | Meaning |
|------|------------|---------|
| **A** | ≥ 90 | Well-designed; all critical checks pass; annotation transparency complete |
| **B** | ≥ 80 | Good quality; minor gaps in annotations or parameter descriptions |
| **C** | ≥ 70 | Acceptable; has warnings worth fixing; some annotation or description gaps |
| **D** | ≥ 60 | Poor quality; significant schema or description defects; hard caps may apply |
| **F** | < 60 | Failing; one or more spec violations or systemic description problems |

---

## 5. Tiers

MTQS uses standard A–F tier cuts (Decision D-06). Cuts are fixed. Calibration happens by adjusting weights and penalties, not by moving the cut boundaries.

| Tier | Minimum Score | Meaning in Practice |
|------|--------------|---------------------|
| **A** | 90 | All critical rules pass. Annotations are complete. Description is substantive. Parameters are typed and described. The tool is production-ready for agentic use. |
| **B** | 80 | One or two quality gaps, typically minor annotation or parameter description omissions. The tool is usable and safe; fix the warnings for an A. |
| **C** | 70 | Several warnings or a description gap. Agents can use the tool but may encounter avoidable errors. Worth a fix sprint before a major release. |
| **D** | 60 | Serious defects, likely a hard-cap condition (broken schema, absent description, annotation contradiction) combined with multiple warnings. Address errors before relying on this tool in production. |
| **F** | < 60 | Failing. Multiple spec violations, absent descriptions, or a combination that makes the tool unreliable in agentic contexts. Do not ship to production. |

The A tier is intentionally achievable by following Anthropic's tool-design guidance and the MCP specification. It is not perfection; it is "designed correctly for agent use." The F tier is not harsh. A tool earns F by accumulating 41+ points of deductions, which requires multiple errors or a large number of warnings.

---

## 6. Versioning

MTQS uses semantic versioning. Rule IDs are stable forever. Once assigned, `MTQS-S01` always refers to the inputSchema presence check and no other rule.

| Change Type | Version Bump | Example |
|-------------|-------------|---------|
| Add new rules | Minor (v0.1 → v0.2) | Adding A07–A09 verb-annotation consistency |
| Change rule severity or weight | Major (v0.1 → v1.0) | Changing MTQS-D01 from `error` to `warning` |
| Change tier cut boundaries | Major | Changing A cut from ≥90 to ≥85 |
| Remove or deprecate a rule | Major | Deprecating MTQS-S05 |

**Linter version declaration:** Every `voke lint` invocation declares the MTQS version it implements in its output. CI configurations pin to a specific MTQS version to prevent score drift from rule additions.

**ID reservation:** v0.1 reserves the following ID ranges. v0.2 additions continue the sequence without gaps:
- Schema: S01–S08 (v0.1). S09+ reserved for v0.2.
- Annotations: A01–A06 (v0.1). A07–A09 reserved for v0.2 verb-annotation rules.
- Description: D01–D03 (v0.1). D04–D06 reserved for v0.2 proxy heuristics.
- Naming: N01–N03 (v0.1). N04–N06 reserved for v0.2 namespace consistency.
- Parameters: P01–P02 (v0.1). P03–P05 reserved for v0.2 ID-naming rules.
- Output: O01–O04 reserved for v0.2 token-efficiency rules.
- Coherence: C01–C03 reserved for v0.2 surface-coherence rules.

---

## 7. Extensibility

MTQS v0.1 defines the core ruleset and scoring formula. Extensibility is a v1.0 feature. The following describes the design intent, not the current implementation.

**Custom rulesets** will follow the Spectral-style `extends` pattern: a vendor config file declares which MTQS rules to include/exclude and adds vendor-specific rules using the same `RuleDefinition` interface. Vendor rule IDs must use a vendor namespace prefix (e.g., `ACME-S01`) to avoid collision with MTQS IDs.

**The `register()` boundary** is the interface between the MTQS rule engine and custom rules. A custom rule must be a pure TypeScript function `(ctx: RuleContext) => Finding[]` with no IO, no model calls, and no side effects. This preserves the determinism guarantee for all rules, built-in and custom.

**Vendor namespaces** follow the pattern `{VENDOR}-{DIMENSION}{NN}`. Vendor rules participate in scoring using the same severity/weight/cap system as MTQS rules, declared in the vendor's registry file.

---

## 8. References

1. Anthropic, "Writing effective tools for agents, with agents" (Sep 11, 2025). [https://www.anthropic.com/engineering/writing-tools-for-agents](https://www.anthropic.com/engineering/writing-tools-for-agents). Five principles for tool design; quantitative evidence for description quality; `user_id` naming guidance.

2. MCP Specification (draft), Tools section, "JSON Schema Usage" subsection. [https://modelcontextprotocol.io/specification/draft/basic/index#json-schema-usage](https://modelcontextprotocol.io/specification/draft/basic/index#json-schema-usage). Normative language for `inputSchema` requirements; external `$ref` prohibition; schema depth bounds.

3. MCP TypeScript schema (draft), ToolAnnotations definition. [https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/draft/schema.ts). Exact field definitions, defaults, and cross-constraints for all five annotation hints.

4. SEP-986, "Specify Format for Tool Names" (Final, 2025-07-16, author: kentcdodds). [https://modelcontextprotocol.io/seps/986-specify-format-for-tool-names](https://modelcontextprotocol.io/seps/986-specify-format-for-tool-names). Tool name character set; 1–64 character recommendation; uniqueness requirement.

5. JSON Schema 2020-12 specification. [https://json-schema.org/draft/2020-12](https://json-schema.org/draft/2020-12). Required array best practice; bare-object anti-pattern; composition keyword bounds.

6. Hasan, Li, Rajbahadur, Adams, Hassan. "Model Context Protocol (MCP) Tool Descriptions Are Smelly! Towards Improving AI Agent Efficiency with Augmented MCP Tool Descriptions" (arxiv:2602.14878, submitted Feb 2026). [https://arxiv.org/html/2602.14878v1](https://arxiv.org/html/2602.14878v1). Six smell categories; 97.1% prevalence across 856 tools; Opaque Parameters at 84.3%; ICC scores (0.62–0.90) establishing why LLM-based evaluation is out of L1.
