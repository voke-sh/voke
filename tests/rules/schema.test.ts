import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { schemaRules } from '../../packages/linter/src/rules/schema.js';
import type { RuleContext, RuleDefinition } from '../../packages/linter/src/engine/types.js';
import type { ToolSnapshot } from '../../packages/linter/src/ingestion/types.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixturesDir = resolve(process.cwd(), 'tests/fixtures/rules');
const schemaPassFixture = JSON.parse(
  readFileSync(resolve(fixturesDir, 'schema-pass.json'), 'utf8'),
) as unknown;
const schemaFailFixture = JSON.parse(
  readFileSync(resolve(fixturesDir, 'schema-fail.json'), 'utf8'),
) as unknown;

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Run a single rule's fn against a ToolSnapshot and return the findings.
 * Uses a frozen RuleContext per D-14 purity pattern.
 */
const runRule = (rule: RuleDefinition, tool: ToolSnapshot) => {
  const ctx: RuleContext = Object.freeze({
    tool,
    surface: Object.freeze([tool]) as ReadonlyArray<ToolSnapshot>,
    config: Object.freeze({}),
  });
  return rule.fn(ctx);
};

/**
 * Look up a rule by ID from schemaRules array.
 */
const getRule = (id: string): RuleDefinition => {
  const rule = schemaRules.find(r => r.id === id);
  if (!rule) throw new Error(`Rule ${id} not found in schemaRules`);
  return rule;
};

/**
 * Build a minimal valid ToolSnapshot with overrides.
 */
const makeTool = (overrides: Partial<ToolSnapshot> = {}): ToolSnapshot => ({
  toolId: 'test-tool',
  contentHash: 'abc123',
  name: 'test-tool',
  description: 'A test tool with a real description',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'The user ID' },
    },
    required: ['userId'],
    additionalProperties: false,
  },
  ...overrides,
});

// Cast fixtures to ToolSnapshot arrays
const passTool = schemaPassFixture as unknown as ToolSnapshot;
const failTools = schemaFailFixture as unknown as Record<string, ToolSnapshot>;

// ────────────────────────────────────────────────────────────────────
// Network-block: D-14 purity enforcement
// ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('Network blocked in tests')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ────────────────────────────────────────────────────────────────────
// Registry sanity
// ────────────────────────────────────────────────────────────────────

describe('schemaRules registry', () => {
  it('exports exactly 8 rule definitions', () => {
    expect(schemaRules).toHaveLength(8);
  });

  it('all rules have dimension "schema"', () => {
    for (const rule of schemaRules) {
      expect(rule.dimension).toBe('schema');
    }
  });

  it('all rules have target "tool"', () => {
    for (const rule of schemaRules) {
      expect(rule.target).toBe('tool');
    }
  });

  it('all rules have mtqsVersion "0.1"', () => {
    for (const rule of schemaRules) {
      expect(rule.mtqsVersion).toBe('0.1');
    }
  });

  it('has rules S01 through S08', () => {
    const ids = schemaRules.map(r => r.id);
    for (let i = 1; i <= 8; i++) {
      expect(ids).toContain(`MTQS-S0${i}`);
    }
  });

  it('S01-S04 and S06 have defaultSeverity "error"', () => {
    const errorRules = ['MTQS-S01', 'MTQS-S02', 'MTQS-S03', 'MTQS-S04', 'MTQS-S06'];
    for (const id of errorRules) {
      expect(getRule(id).defaultSeverity).toBe('error');
    }
  });

  it('S05, S07, S08 have defaultSeverity "warning"', () => {
    const warningRules = ['MTQS-S05', 'MTQS-S07', 'MTQS-S08'];
    for (const id of warningRules) {
      expect(getRule(id).defaultSeverity).toBe('warning');
    }
  });

  it('all rules have a non-empty fixHint', () => {
    for (const rule of schemaRules) {
      expect(rule.fixHint.trim().length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// Negative tests: clean fixture fires ZERO schema findings
// ────────────────────────────────────────────────────────────────────

describe('schema-pass.json fires zero findings', () => {
  it('all 8 schema rules collectively produce zero findings on the clean fixture', () => {
    const allFindings = schemaRules.flatMap(rule => runRule(rule, passTool));
    expect(allFindings).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-S01: inputSchema Presence
// ────────────────────────────────────────────────────────────────────

describe('MTQS-S01: inputSchema presence', () => {
  it('fires when inputSchema is null (cast runtime scenario)', () => {
    // ToolSnapshot type says inputSchema is always present, but runtime tools can be null
    const tool = makeTool({ inputSchema: null as unknown as Record<string, unknown> });
    const findings = runRule(getRule('MTQS-S01'), tool);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S01');
    expect(findings[0].dimension).toBe('schema');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].location.path).toEqual(['inputSchema']);
    expect(findings[0].message).toContain('MTQS-S01');
    expect(findings[0].fixHint.trim().length).toBeGreaterThan(0);
  });

  it('fires when inputSchema is undefined (cast runtime scenario)', () => {
    const tool = makeTool({ inputSchema: undefined as unknown as Record<string, unknown> });
    const findings = runRule(getRule('MTQS-S01'), tool);
    expect(findings).toHaveLength(1);
  });

  it('fires on the schema-fail.json fixture entry for missing inputSchema', () => {
    const findings = runRule(getRule('MTQS-S01'), failTools['missingInputSchema']);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S01');
  });

  it('does not fire on a valid tool with inputSchema present', () => {
    const findings = runRule(getRule('MTQS-S01'), makeTool());
    expect(findings).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-S02: inputSchema Root Type
// ────────────────────────────────────────────────────────────────────

describe('MTQS-S02: inputSchema root type', () => {
  it('fires when inputSchema root type is "array"', () => {
    const tool = makeTool({ inputSchema: { type: 'array', items: { type: 'string' } } });
    const findings = runRule(getRule('MTQS-S02'), tool);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S02');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].message).toContain('array');
    expect(findings[0].location.path).toEqual(['inputSchema', 'type']);
  });

  it('fires when inputSchema root type is "string"', () => {
    const tool = makeTool({ inputSchema: { type: 'string' } });
    const findings = runRule(getRule('MTQS-S02'), tool);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('string');
  });

  it('fires with "absent" when type key is missing', () => {
    const tool = makeTool({ inputSchema: { properties: {} } });
    const findings = runRule(getRule('MTQS-S02'), tool);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('absent');
  });

  it('fires on the schema-fail.json fixture for array type', () => {
    const findings = runRule(getRule('MTQS-S02'), failTools['arrayTypeInputSchema']);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S02');
  });

  it('does not fire when S01 would fire (absent inputSchema)', () => {
    // S02 delegates to S01's domain — should not fire when inputSchema is absent
    const tool = makeTool({ inputSchema: null as unknown as Record<string, unknown> });
    const findings = runRule(getRule('MTQS-S02'), tool);
    expect(findings).toHaveLength(0);
  });

  it('does not fire when root type is "object"', () => {
    const findings = runRule(getRule('MTQS-S02'), makeTool());
    expect(findings).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-S03: inputSchema Structural Validity
// ────────────────────────────────────────────────────────────────────

describe('MTQS-S03: inputSchema structural validity', () => {
  it('fires when inputSchema has an invalid type field (type is a number)', () => {
    const tool = makeTool({
      inputSchema: { type: 42 as unknown as string, properties: {} },
    });
    const findings = runRule(getRule('MTQS-S03'), tool);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S03');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].location.path).toEqual(['inputSchema']);
  });

  it('preserves the greppable prefix and appends specific ajv failure detail', () => {
    const prefix = 'MTQS-S03 [error] inputSchema fails JSON Schema 2020-12 validation';
    const tool = makeTool({
      inputSchema: { type: 42 as unknown as string, properties: {} },
    });
    const findings = runRule(getRule('MTQS-S03'), tool);
    expect(findings[0].message.startsWith(prefix)).toBe(true);
    // Specifics appended after the prefix via the formatter's ': ' separator
    expect(findings[0].message.length).toBeGreaterThan(prefix.length);
    expect(findings[0].message).toContain(': ');
    expect(findings[0].message).toContain('type');
  });

  it('fires on the schema-fail.json fixture for invalid schema', () => {
    const findings = runRule(getRule('MTQS-S03'), failTools['invalidInputSchema']);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S03');
  });

  it('does not fire on a structurally valid 2020-12 schema', () => {
    const findings = runRule(getRule('MTQS-S03'), makeTool());
    expect(findings).toHaveLength(0);
  });

  it('does not fire when inputSchema is absent (S01 handles that)', () => {
    const tool = makeTool({ inputSchema: null as unknown as Record<string, unknown> });
    const findings = runRule(getRule('MTQS-S03'), tool);
    expect(findings).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-S04: No External $ref
// ────────────────────────────────────────────────────────────────────

describe('MTQS-S04: no external $ref', () => {
  it('fires when inputSchema contains an external $ref', () => {
    const tool = makeTool({
      inputSchema: {
        type: 'object',
        properties: {
          address: { $ref: 'https://example.com/schemas/address.json' },
        },
      },
    });
    const findings = runRule(getRule('MTQS-S04'), tool);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S04');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].location.path).toEqual(['inputSchema']);
  });

  it('fires when outputSchema contains an external $ref', () => {
    const tool = makeTool({
      outputSchema: {
        type: 'object',
        properties: {
          result: { $ref: 'https://example.com/result.json' },
        },
      },
    });
    const findings = runRule(getRule('MTQS-S04'), tool);
    expect(findings).toHaveLength(1);
    expect(findings[0].location.path).toEqual(['outputSchema']);
  });

  it('fires twice when both inputSchema and outputSchema have external $refs', () => {
    const tool = makeTool({
      inputSchema: {
        type: 'object',
        properties: { a: { $ref: 'https://example.com/a.json' } },
      },
      outputSchema: {
        type: 'object',
        properties: { b: { $ref: 'https://example.com/b.json' } },
      },
    });
    const findings = runRule(getRule('MTQS-S04'), tool);
    expect(findings).toHaveLength(2);
  });

  it('fires on the schema-fail.json fixture for external $ref', () => {
    const findings = runRule(getRule('MTQS-S04'), failTools['externalRefInputSchema']);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S04');
  });

  it('does not fire for local $refs starting with "#"', () => {
    const tool = makeTool({
      inputSchema: {
        type: 'object',
        properties: { item: { $ref: '#/$defs/Item' } },
        $defs: { Item: { type: 'string' } },
      },
    });
    const findings = runRule(getRule('MTQS-S04'), tool);
    expect(findings).toHaveLength(0);
  });

  it('does not fire when there are no $refs', () => {
    const findings = runRule(getRule('MTQS-S04'), makeTool());
    expect(findings).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-S05: Schema Nesting Depth
// ────────────────────────────────────────────────────────────────────

describe('MTQS-S05: schema nesting depth', () => {
  it('fires when inputSchema depth exceeds 5', () => {
    const tool = makeTool({ inputSchema: failTools['deepInputSchema'].inputSchema });
    const findings = runRule(getRule('MTQS-S05'), tool);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S05');
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].location.path).toEqual(['inputSchema']);
    expect(findings[0].message).toContain('MTQS-S05');
    expect(findings[0].message).toContain('[warning]');
  });

  it('fires on the schema-fail.json fixture for deep schema', () => {
    const findings = runRule(getRule('MTQS-S05'), failTools['deepInputSchema']);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S05');
  });

  it('message includes the measured depth and the limit', () => {
    const findings = runRule(getRule('MTQS-S05'), failTools['deepInputSchema']);
    expect(findings[0].message).toContain('exceeding MTQS-RECOMMENDED maximum of 5');
  });

  it('does not fire when depth is exactly 5 or less', () => {
    const findings = runRule(getRule('MTQS-S05'), makeTool());
    expect(findings).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-S06: outputSchema Structural Validity
// ────────────────────────────────────────────────────────────────────

describe('MTQS-S06: outputSchema structural validity', () => {
  it('fires when outputSchema is present and structurally invalid (required is a string)', () => {
    const tool = makeTool({
      outputSchema: {
        type: 'object',
        properties: {},
        required: 'must-be-array' as unknown as string[],
      },
    });
    const findings = runRule(getRule('MTQS-S06'), tool);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S06');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].location.path).toEqual(['outputSchema']);
  });

  it('preserves the greppable prefix and appends specific ajv failure detail', () => {
    const prefix = 'MTQS-S06 [error] outputSchema fails JSON Schema 2020-12 validation';
    const tool = makeTool({
      outputSchema: {
        type: 'object',
        properties: {},
        required: 'must-be-array' as unknown as string[],
      },
    });
    const findings = runRule(getRule('MTQS-S06'), tool);
    expect(findings[0].message.startsWith(prefix)).toBe(true);
    expect(findings[0].message.length).toBeGreaterThan(prefix.length);
    expect(findings[0].message).toContain(': ');
    // ajv reports the meta-schema failure as a `type` keyword violation at a
    // schemaPath (required:'must-be-array' must be an array) — assert on the
    // formatter's keyword token and the '#' schemaPath fragment it emits.
    expect(findings[0].message).toContain('type at #');
  });

  it('fires on the schema-fail.json fixture for invalid outputSchema', () => {
    const findings = runRule(getRule('MTQS-S06'), failTools['invalidOutputSchema']);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S06');
  });

  it('does not fire when outputSchema is absent', () => {
    const tool = makeTool({ outputSchema: undefined });
    const findings = runRule(getRule('MTQS-S06'), tool);
    expect(findings).toHaveLength(0);
  });

  it('does not fire when outputSchema is valid', () => {
    const tool = makeTool({
      outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
    });
    const findings = runRule(getRule('MTQS-S06'), tool);
    expect(findings).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-S07: Required Array Presence
// ────────────────────────────────────────────────────────────────────

describe('MTQS-S07: required array presence', () => {
  it('fires when properties is defined but required is absent', () => {
    const tool = makeTool({
      inputSchema: {
        type: 'object',
        properties: { userId: { type: 'string' } },
        // required is intentionally absent
      },
    });
    const findings = runRule(getRule('MTQS-S07'), tool);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S07');
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].location.path).toEqual(['inputSchema', 'required']);
  });

  it('fires on the schema-fail.json fixture for missing required', () => {
    const findings = runRule(getRule('MTQS-S07'), failTools['propertiesWithoutRequired']);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S07');
  });

  it('does not fire when required is present (including empty array)', () => {
    const tool = makeTool({
      inputSchema: {
        type: 'object',
        properties: { userId: { type: 'string' } },
        required: [],
      },
    });
    const findings = runRule(getRule('MTQS-S07'), tool);
    expect(findings).toHaveLength(0);
  });

  it('does not fire when properties is absent', () => {
    const tool = makeTool({
      inputSchema: { type: 'object', additionalProperties: false },
    });
    const findings = runRule(getRule('MTQS-S07'), tool);
    expect(findings).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// MTQS-S08: No Bare Untyped Properties
// ────────────────────────────────────────────────────────────────────

describe('MTQS-S08: no bare untyped properties', () => {
  it('fires once for each bare {} property', () => {
    const tool = makeTool({
      inputSchema: {
        type: 'object',
        properties: {
          user_id: {}, // bare
          name: { type: 'string' }, // typed — OK
          data: {}, // bare
        },
        required: ['user_id'],
      },
    });
    const findings = runRule(getRule('MTQS-S08'), tool);
    expect(findings).toHaveLength(2);
    const ruleIds = findings.map(f => f.ruleId);
    expect(ruleIds.every(id => id === 'MTQS-S08')).toBe(true);
  });

  it('fires on the schema-fail.json fixture for bare property', () => {
    const findings = runRule(getRule('MTQS-S08'), failTools['barePropertySchema']);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('MTQS-S08');
  });

  it('finding includes the property name in location.path', () => {
    const tool = makeTool({
      inputSchema: {
        type: 'object',
        properties: {
          user_id: {},
        },
        required: ['user_id'],
      },
    });
    const findings = runRule(getRule('MTQS-S08'), tool);
    expect(findings[0].location.path).toEqual(['inputSchema', 'properties', 'user_id']);
  });

  it('finding message includes the property name', () => {
    const tool = makeTool({
      inputSchema: {
        type: 'object',
        properties: { user_id: {} },
        required: ['user_id'],
      },
    });
    const findings = runRule(getRule('MTQS-S08'), tool);
    expect(findings[0].message).toContain('user_id');
  });

  it('does not fire when properties is absent', () => {
    const tool = makeTool({
      inputSchema: { type: 'object', required: [] },
    });
    const findings = runRule(getRule('MTQS-S08'), tool);
    expect(findings).toHaveLength(0);
  });

  it('does not fire for properties with type keyword', () => {
    const findings = runRule(getRule('MTQS-S08'), makeTool());
    expect(findings).toHaveLength(0);
  });

  it('does not fire for properties with $ref keyword', () => {
    const tool = makeTool({
      inputSchema: {
        type: 'object',
        properties: {
          item: { $ref: '#/$defs/Item' },
        },
        $defs: { Item: { type: 'string' } },
        required: ['item'],
      },
    });
    const findings = runRule(getRule('MTQS-S08'), tool);
    expect(findings).toHaveLength(0);
  });

  it('does not fire for properties with oneOf/anyOf/allOf composition keywords', () => {
    const tool = makeTool({
      inputSchema: {
        type: 'object',
        properties: {
          value: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        },
        required: ['value'],
      },
    });
    const findings = runRule(getRule('MTQS-S08'), tool);
    expect(findings).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Network-block integration: all rules run under blocked fetch
// ────────────────────────────────────────────────────────────────────

describe('network-block: all rules are pure (D-14)', () => {
  it('all rules run against all fixtures without throwing even with fetch blocked', () => {
    const allTools: ToolSnapshot[] = [
      passTool,
      ...Object.values(failTools) as ToolSnapshot[],
    ];

    for (const tool of allTools) {
      for (const rule of schemaRules) {
        expect(() => runRule(rule, tool)).not.toThrow();
      }
    }
  });

  it('results are identical with fetch blocked vs unblocked (pure function verification)', () => {
    const tool = makeTool();

    // Run with fetch blocked (beforeEach already set this up)
    const findingsBlocked = schemaRules.flatMap(rule => runRule(rule, tool));

    // Unblock fetch temporarily and re-run
    vi.unstubAllGlobals();
    const findingsUnblocked = schemaRules.flatMap(rule => runRule(rule, tool));

    expect(JSON.stringify(findingsBlocked)).toBe(JSON.stringify(findingsUnblocked));
  });
});
