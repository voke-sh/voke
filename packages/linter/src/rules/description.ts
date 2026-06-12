import type { RuleDefinition, Finding, RuleContext } from '../engine/types.js';

/**
 * descriptionRules — MTQS Description-as-Prompt dimension (D01-D03).
 *
 * All three rules are:
 *   - target: 'tool' (per-tool evaluation)
 *   - dimension: 'description'
 *   - mtqsVersion: '0.1'
 *   - Pure functions of ctx.tool only — no IO, no Date.now, no Math.random, no fetch.
 *
 * Primary source: Anthropic "Writing effective tools for agents" (Sep 2025)
 * Severities and fixHints are verbatim from spec/mtqs-v0.1.yaml (authoritative registry).
 */

/**
 * MTQS-D01: Description Presence
 * Fires when tool.description is absent, null, or empty string.
 * Severity: error
 */
const d01: RuleDefinition = {
  id: 'MTQS-D01',
  description: 'description field must be present and non-empty; without a description agents cannot determine what the tool does or when to invoke it.',
  dimension: 'description',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint: 'Add a description explaining what the tool does, when to use it, and what it returns. Prompt-engineering tool descriptions dramatically reduces agent error rates.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (!tool.description || tool.description.length === 0) {
      return [
        {
          ruleId: 'MTQS-D01',
          dimension: 'description',
          severity: 'error',
          message: 'MTQS-D01 [error] description is absent or empty: agents cannot determine what this tool does',
          location: { tool: tool.toolId, path: ['description'] },
          fixHint: d01.fixHint,
        },
      ];
    }
    return [];
  },
};

/**
 * MTQS-D02: Description Minimum Length
 * Fires when tool.description is present and its length < 20.
 * Fires INDEPENDENTLY of D03 — no suppression logic.
 * Severity: warning
 */
const d02: RuleDefinition = {
  id: 'MTQS-D02',
  description: 'Tool description must be at least 20 characters long.',
  dimension: 'description',
  target: 'tool',
  defaultSeverity: 'warning',
  fixHint: 'Expand the description to cover what the tool does, when to use it, and what it returns. Single-word or single-phrase descriptions rarely provide agents enough context for correct selection.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    // D02 only fires when description is present and non-empty (D01 handles absent/empty case)
    if (!tool.description || tool.description.length === 0) {
      return [];
    }
    const len = tool.description.length;
    if (len < 20) {
      return [
        {
          ruleId: 'MTQS-D02',
          dimension: 'description',
          severity: 'warning',
          message: `MTQS-D02 [warning] description is ${len} characters: minimum is 20 characters for a meaningful description`,
          location: { tool: tool.toolId, path: ['description'] },
          fixHint: d02.fixHint,
        },
      ];
    }
    return [];
  },
};

/**
 * MTQS-D03: Description Not a Name Copy
 * Fires when tool.description is a byte-for-byte equal to tool.name (strict ===).
 * Fires INDEPENDENTLY of D02 — no suppression logic.
 * Hard tier cap: C (<=79). Applied by the scoring module, not here.
 * Severity: error
 */
const d03: RuleDefinition = {
  id: 'MTQS-D03',
  description: 'description must not be a byte-for-byte copy of the tool name; copying the name adds no information and prevents agents from understanding the tool.',
  dimension: 'description',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint: 'Replace the name-copy with a real description of what the tool does and returns. A description equal to the name is the Unclear Purpose smell.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    // D03 only fires when description is present (D01 handles absent/empty case)
    if (tool.description === undefined || tool.description === null) {
      return [];
    }
    if (tool.description === tool.name) {
      return [
        {
          ruleId: 'MTQS-D03',
          dimension: 'description',
          severity: 'error',
          message: `MTQS-D03 [error] description is a byte-for-byte copy of the tool name "${tool.name}": adds no information`,
          location: { tool: tool.toolId, path: ['description'] },
          fixHint: d03.fixHint,
        },
      ];
    }
    return [];
  },
};

/**
 * descriptionRules — exported array of all Description-as-Prompt rules.
 * Order: D01, D02, D03 (alphabetical by ID, matching spec evaluation order §4.4).
 */
export const descriptionRules: RuleDefinition[] = [d01, d02, d03];
