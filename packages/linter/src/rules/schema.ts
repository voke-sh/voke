/**
 * Schema Correctness rules (MTQS-S01 through MTQS-S08).
 *
 * These 8 rules cover RULE-01 in full and form the T1 (1.5x weight) correctness floor.
 * A broken inputSchema means the tool literally cannot be used by an agent.
 *
 * All rules:
 * - target: 'tool' (per-tool evaluation)
 * - dimension: 'schema'
 * - mtqsVersion: '0.1'
 * - pure synchronous functions with ZERO IO (no fetch, no Date.now, no Math.random)
 *
 * Helpers from schema-checks.ts are REUSED (never reimplemented):
 * - isValidJsonSchema2020: S03, S06
 * - hasExternalRef: S04
 * - schemaDepth: S05
 */
import type { RuleDefinition, Finding, RuleContext } from '../engine/types.js';
import {
  isValidJsonSchema2020,
  hasExternalRef,
  schemaDepth,
} from '../ingestion/schema-checks.js';

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Build a Finding with all required fields.
 * Uses the rule's id, dimension, and defaultSeverity as the base.
 */
const makeFinding = (
  rule: Pick<RuleDefinition, 'id' | 'dimension' | 'defaultSeverity' | 'fixHint'>,
  toolId: string,
  path: string[],
  message: string,
): Finding => ({
  ruleId: rule.id,
  dimension: rule.dimension,
  severity: rule.defaultSeverity,
  message,
  location: { tool: toolId, path },
  fixHint: rule.fixHint,
});

/**
 * Returns true if the schema is null, undefined, or otherwise absent.
 * ToolSnapshot types inputSchema as always-present but live tools can carry null.
 */
const isAbsent = (schema: unknown): boolean =>
  schema === null || schema === undefined;

/**
 * Check if a property schema is "bare" — an object with zero own keys.
 * A bare schema provides no type information to agents.
 */
const isBareSchema = (schema: unknown): boolean =>
  typeof schema === 'object' &&
  schema !== null &&
  !Array.isArray(schema) &&
  Object.keys(schema as object).length === 0;

// ────────────────────────────────────────────────────────────────────
// MTQS-S01: inputSchema Presence
// ────────────────────────────────────────────────────────────────────

const s01: RuleDefinition = {
  id: 'MTQS-S01',
  description:
    'inputSchema must be present and non-null; every tool must declare its argument schema so agents know what to send.',
  dimension: 'schema',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint:
    'Add "inputSchema": {"type": "object", "properties": {}, "additionalProperties": false} for tools that take no parameters. The MCP spec mandates a valid JSON Schema object.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (!isAbsent(tool.inputSchema)) return [];
    return [
      makeFinding(
        s01,
        tool.toolId,
        ['inputSchema'],
        'MTQS-S01 [error] inputSchema is absent or null: agents cannot determine what arguments to send',
      ),
    ];
  },
};

// ────────────────────────────────────────────────────────────────────
// MTQS-S02: inputSchema Root Type
// ────────────────────────────────────────────────────────────────────

const s02: RuleDefinition = {
  id: 'MTQS-S02',
  description:
    'inputSchema root must have type set to object; MCP tool arguments are always passed as a JSON object, not an array or scalar.',
  dimension: 'schema',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint:
    'Set the top-level "type" field of inputSchema to "object". Tool arguments are always key-value pairs, not a bare array or primitive.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    // S01 handles the absent case — S02 is a no-op when inputSchema is absent
    if (isAbsent(tool.inputSchema)) return [];

    const schema = tool.inputSchema as Record<string, unknown>;
    const rootType = schema['type'];
    if (rootType === 'object') return [];

    // Use 'absent' when the type key is missing
    const actualType =
      typeof rootType === 'string' ? rootType : 'absent';
    return [
      makeFinding(
        s02,
        tool.toolId,
        ['inputSchema', 'type'],
        `MTQS-S02 [error] inputSchema root type is "${actualType}": MCP tool arguments must be a JSON object`,
      ),
    ];
  },
};

// ────────────────────────────────────────────────────────────────────
// MTQS-S03: inputSchema Structural Validity
// ────────────────────────────────────────────────────────────────────

const s03: RuleDefinition = {
  id: 'MTQS-S03',
  description:
    'inputSchema must be structurally valid JSON Schema 2020-12; unknown top-level keywords or malformed $ref values cause client validation failure.',
  dimension: 'schema',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint:
    'Validate inputSchema against the JSON Schema 2020-12 meta-schema. Common errors: unknown keywords, incorrect type values, malformed $ref.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    // S01 handles the absent case — S03 is a no-op when inputSchema is absent
    if (isAbsent(tool.inputSchema)) return [];
    if (isValidJsonSchema2020(tool.inputSchema)) return [];
    return [
      makeFinding(
        s03,
        tool.toolId,
        ['inputSchema'],
        'MTQS-S03 [error] inputSchema fails JSON Schema 2020-12 validation',
      ),
    ];
  },
};

// ────────────────────────────────────────────────────────────────────
// MTQS-S04: No External $ref
// ────────────────────────────────────────────────────────────────────

const s04: RuleDefinition = {
  id: 'MTQS-S04',
  description:
    'No unresolved external $ref URIs may appear in inputSchema or outputSchema; MCP implementations must not auto-dereference network URIs.',
  dimension: 'schema',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint:
    'Move all schema definitions into $defs within the schema object and use local $ref values (e.g. "#/$defs/MyType"). Do not reference external URLs.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    const findings: Finding[] = [];

    if (!isAbsent(tool.inputSchema) && hasExternalRef(tool.inputSchema)) {
      findings.push(
        makeFinding(
          s04,
          tool.toolId,
          ['inputSchema'],
          'MTQS-S04 [error] inputSchema contains external $ref: MCP implementations must not auto-dereference network URIs',
        ),
      );
    }

    if (tool.outputSchema !== undefined && tool.outputSchema !== null && hasExternalRef(tool.outputSchema)) {
      findings.push(
        makeFinding(
          s04,
          tool.toolId,
          ['outputSchema'],
          'MTQS-S04 [error] outputSchema contains external $ref: MCP implementations must not auto-dereference network URIs',
        ),
      );
    }

    return findings;
  },
};

// ────────────────────────────────────────────────────────────────────
// MTQS-S05: Schema Nesting Depth
// ────────────────────────────────────────────────────────────────────

const s05: RuleDefinition = {
  id: 'MTQS-S05',
  description:
    'Schema nesting depth should not exceed 5 levels (MTQS-RECOMMENDED, not MCP-mandated); deeply nested schemas are expensive to validate and error-prone.',
  dimension: 'schema',
  target: 'tool',
  defaultSeverity: 'warning',
  fixHint:
    'Flatten deeply nested schemas using $defs for reuse. The MCP spec SHOULD bound schema depth to prevent denial-of-service; MTQS recommends 5 levels max.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (isAbsent(tool.inputSchema)) return [];

    const depth = schemaDepth(tool.inputSchema);
    if (depth <= 5) return [];

    return [
      makeFinding(
        s05,
        tool.toolId,
        ['inputSchema'],
        `MTQS-S05 [warning] inputSchema nesting depth is ${depth}, exceeding MTQS-RECOMMENDED maximum of 5`,
      ),
    ];
  },
};

// ────────────────────────────────────────────────────────────────────
// MTQS-S06: outputSchema Structural Validity
// ────────────────────────────────────────────────────────────────────

const s06: RuleDefinition = {
  id: 'MTQS-S06',
  description:
    'outputSchema, if present, must be structurally valid JSON Schema 2020-12; an invalid output schema breaks client-side response validation.',
  dimension: 'schema',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint:
    'Validate outputSchema against the JSON Schema 2020-12 meta-schema just as you would inputSchema. Remove or correct any unknown keywords or malformed $ref.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    // Rule only fires when outputSchema is present
    if (tool.outputSchema === undefined || tool.outputSchema === null) return [];
    if (isValidJsonSchema2020(tool.outputSchema)) return [];
    return [
      makeFinding(
        s06,
        tool.toolId,
        ['outputSchema'],
        'MTQS-S06 [error] outputSchema fails JSON Schema 2020-12 validation',
      ),
    ];
  },
};

// ────────────────────────────────────────────────────────────────────
// MTQS-S07: Required Array Presence
// ────────────────────────────────────────────────────────────────────

const s07: RuleDefinition = {
  id: 'MTQS-S07',
  description:
    'A required array should be present whenever properties is defined, even if empty; omitting it leaves required/optional semantics implicit.',
  dimension: 'schema',
  target: 'tool',
  defaultSeverity: 'warning',
  fixHint:
    'Add "required": [] or list the mandatory fields explicitly. JSON Schema best practice requires explicit required/optional declaration for clarity.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (isAbsent(tool.inputSchema)) return [];

    const schema = tool.inputSchema as Record<string, unknown>;
    const properties = schema['properties'];

    // Rule only applies when properties is defined (a non-null object)
    if (
      properties === null ||
      properties === undefined ||
      typeof properties !== 'object' ||
      Array.isArray(properties)
    ) {
      return [];
    }

    // Check if required is absent or undefined
    if (schema['required'] !== undefined) return [];

    return [
      makeFinding(
        s07,
        tool.toolId,
        ['inputSchema', 'required'],
        'MTQS-S07 [warning] inputSchema.properties is defined but "required" array is absent: required/optional semantics are implicit',
      ),
    ];
  },
};

// ────────────────────────────────────────────────────────────────────
// MTQS-S08: No Bare Untyped Properties
// ────────────────────────────────────────────────────────────────────

const s08: RuleDefinition = {
  id: 'MTQS-S08',
  description:
    'No property in inputSchema.properties should use a bare {} untyped schema; every property must have at least a type keyword or a $ref.',
  dimension: 'schema',
  target: 'tool',
  defaultSeverity: 'warning',
  fixHint:
    'Specify "type" or a composition keyword (oneOf, anyOf, $ref) for every property. Bare {} schemas give agents no type information and fail 2020-12 best practice.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (isAbsent(tool.inputSchema)) return [];

    const schema = tool.inputSchema as Record<string, unknown>;
    const properties = schema['properties'];

    // Rule only applies when properties is a non-null object
    if (
      properties === null ||
      properties === undefined ||
      typeof properties !== 'object' ||
      Array.isArray(properties)
    ) {
      return [];
    }

    const findings: Finding[] = [];
    const propsObj = properties as Record<string, unknown>;

    // Iterate in insertion order (Object.keys is stable in V8 and Node.js)
    for (const propName of Object.keys(propsObj)) {
      const propSchema = propsObj[propName];
      if (isBareSchema(propSchema)) {
        findings.push(
          makeFinding(
            s08,
            tool.toolId,
            ['inputSchema', 'properties', propName],
            `MTQS-S08 [warning] inputSchema.properties.${propName} uses bare {} schema: no type information provided for agents`,
          ),
        );
      }
    }

    return findings;
  },
};

// ────────────────────────────────────────────────────────────────────
// Export: all 8 schema rules
// ────────────────────────────────────────────────────────────────────

export const schemaRules: RuleDefinition[] = [s01, s02, s03, s04, s05, s06, s07, s08];
