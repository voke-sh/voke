/**
 * parameters.ts — MTQS Parameter Semantics rules (dimension: 'parameters', weight: 1.2×)
 *
 * Exports `parameterRules: RuleDefinition[]` containing P01 and P02.
 * Both rules operate per-tool, are pure synchronous functions, and perform zero IO.
 *
 * Sources:
 *   - Anthropic "Writing effective tools for agents" (Sep 2025)
 *   - arxiv:2602.14878 — Opaque Parameters smell at 84.3% prevalence
 *   - spec/MTQS-v0.1.md §3 MTQS-P01 and MTQS-P02
 *   - spec/mtqs-v0.1.yaml (fixHints copied VERBATIM)
 */

import type { RuleDefinition, RuleContext, Finding } from '../engine/types.js';

// ─── P02 closed-set heuristic patterns (SCOPE.md §4 mechanical-checkability) ──
//
// A property fires P02 when ALL of:
//   1. sub-schema.type === 'string'
//   2. sub-schema has no 'enum' key
//   3. sub-schema.description is a non-empty string matching any of these patterns:
//
// Pattern A: "one of" followed by optional colon and list
//   Matches: "One of: active, inactive, pending", "one of active or inactive",
//            "One of the following: ..."
//   Regex: /\bone of\b/i
//
// Pattern B: closed-set label keywords followed by colon
//   Matches: "values: asc, desc", "allowed: json, xml", "options: json, yaml, toml"
//   Regex: /\b(values|options|allowed)\s*:/i
//
// These patterns are conservative to avoid false positives. A property that mentions
// "one of" in a natural-language context (e.g., "One of the best tools") will not
// necessarily be actionable — but the canonical MTQS spec failing example
// "Filter by status. One of: active, inactive, pending." MUST fire.
//
// The heuristic is deterministic: same input always produces same output.
// Pure deterministic functions only — no model calls, no network IO, no randomness.

const CLOSED_SET_PATTERNS: ReadonlyArray<RegExp> = [
  /\bone\s+of\b/i,
  /\b(values|options|allowed)\s*:/i,
];

/**
 * Returns true if the description text signals a closed, finite set of values.
 * Pure, deterministic, no IO.
 */
const isClosedSetDescription = (description: string): boolean =>
  CLOSED_SET_PATTERNS.some(pattern => pattern.test(description));

// ─── Type narrowing helpers ───────────────────────────────────────────────────

/**
 * Narrow the inputSchema.properties value to a plain object dict.
 * Returns undefined if properties is absent or not a plain object.
 */
const getProperties = (
  inputSchema: Record<string, unknown>,
): Record<string, Record<string, unknown>> | undefined => {
  const props = inputSchema['properties'];
  if (props === null || typeof props !== 'object' || Array.isArray(props)) {
    return undefined;
  }
  return props as Record<string, Record<string, unknown>>;
};

/**
 * Get a string value from an object by key, or undefined if not a non-empty string.
 */
const getStringField = (obj: Record<string, unknown>, key: string): string | undefined => {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
};

/**
 * Returns true if the property sub-schema has a non-empty description string.
 */
const hasNonEmptyDescription = (propSchema: Record<string, unknown>): boolean => {
  const desc = getStringField(propSchema, 'description');
  return desc !== undefined && desc.length > 0;
};

// ─── MTQS-P01: Parameter Descriptions ────────────────────────────────────────

/**
 * P01 fires once per property in inputSchema.properties that has no non-empty description.
 *
 * Guard: if inputSchema.properties is absent or not a plain object, returns [].
 * A property with description: "" or no description key fires P01.
 * A property with a non-empty description is silent.
 */
const p01Fn = (ctx: RuleContext): Finding[] => {
  if (ctx.tool === null) return [];
  const { tool } = ctx;

  const properties = getProperties(tool.inputSchema);
  if (properties === undefined) return [];

  const findings: Finding[] = [];

  for (const [propName, propSchema] of Object.entries(properties)) {
    if (!hasNonEmptyDescription(propSchema)) {
      findings.push({
        ruleId: 'MTQS-P01',
        dimension: 'parameters',
        severity: 'warning',
        message: `MTQS-P01 [warning] inputSchema.properties.${propName} has no description: agents cannot determine its meaning or constraints`,
        location: {
          tool: tool.toolId,
          path: ['inputSchema', 'properties', propName],
        },
        // fixHint VERBATIM from spec/mtqs-v0.1.yaml
        fixHint:
          'Add a "description" to each parameter explaining its meaning, type constraints, and valid values. Use descriptive names like user_id instead of bare user.',
      });
    }
  }

  return findings;
};

// ─── MTQS-P02: Enum for Constrained Strings ──────────────────────────────────

/**
 * P02 fires once per property that appears to describe a finite string value set in prose
 * without using an enum.
 *
 * Conditions for firing (ALL must be true):
 *   1. sub-schema.type === 'string'
 *   2. sub-schema has no 'enum' key (a property already using enum NEVER fires P02)
 *   3. sub-schema.description is a non-empty string matching a closed-set pattern
 *
 * Guard: if inputSchema.properties is absent or not a plain object, returns [].
 * Properties without a description do not fire P02 (P01 covers those).
 *
 * Heuristic is pure and deterministic — see CLOSED_SET_PATTERNS above for the
 * exact regex set. No model, no IO, no randomness.
 */
const p02Fn = (ctx: RuleContext): Finding[] => {
  if (ctx.tool === null) return [];
  const { tool } = ctx;

  const properties = getProperties(tool.inputSchema);
  if (properties === undefined) return [];

  const findings: Finding[] = [];

  for (const [propName, propSchema] of Object.entries(properties)) {
    // Condition 1: must be type string
    const typeValue = getStringField(propSchema, 'type');
    if (typeValue !== 'string') continue;

    // Condition 2: must NOT already have an enum key
    if ('enum' in propSchema) continue;

    // Condition 3: description must be a non-empty string matching a closed-set pattern
    const description = getStringField(propSchema, 'description');
    if (!description || description.length === 0) continue;
    if (!isClosedSetDescription(description)) continue;

    findings.push({
      ruleId: 'MTQS-P02',
      dimension: 'parameters',
      severity: 'warning',
      message: `MTQS-P02 [warning] inputSchema.properties.${propName} appears to have a finite value set described in text: consider using "enum" to enforce valid values`,
      location: {
        tool: tool.toolId,
        path: ['inputSchema', 'properties', propName],
      },
      // fixHint VERBATIM from spec/mtqs-v0.1.yaml
      fixHint:
        'Replace free-text string parameters like "status" or "format" with "enum": ["value1", "value2", ...] to constrain the valid value set.',
    });
  }

  return findings;
};

// ─── Exported rule definitions ────────────────────────────────────────────────

export const parameterRules: RuleDefinition[] = [
  {
    id: 'MTQS-P01',
    description:
      'Every property in inputSchema.properties must have a non-empty description; opaque parameters are the most prevalent smell at 84.3% of tools.',
    dimension: 'parameters',
    target: 'tool',
    defaultSeverity: 'warning',
    // fixHint VERBATIM from spec/mtqs-v0.1.yaml
    fixHint:
      'Add a "description" to each parameter explaining its meaning, type constraints, and valid values. Use descriptive names like user_id instead of bare user.',
    mtqsVersion: '0.1',
    fn: p01Fn,
  },
  {
    id: 'MTQS-P02',
    description:
      'Properties whose values are drawn from a finite known set of strings should use an enum; free-text strings cause agents to hallucinate invalid values.',
    dimension: 'parameters',
    target: 'tool',
    defaultSeverity: 'warning',
    // fixHint VERBATIM from spec/mtqs-v0.1.yaml
    fixHint:
      'Replace free-text string parameters like "status" or "format" with "enum": ["value1", "value2", ...] to constrain the valid value set.',
    mtqsVersion: '0.1',
    fn: p02Fn,
  },
];
