import type { RuleDefinition, Finding, RuleContext } from '../engine/types.js';

/**
 * namingRules — MTQS Naming dimension (N01-N03).
 *
 * N01, N02 are target: 'tool' (per-tool evaluation).
 * N03 is target: 'server' — the ONLY server-scoped rule in MTQS v0.1.
 *   The engine calls N03 fn ONCE with ctx.tool === null and ctx.surface = full sorted surface.
 *   N03 reads ctx.surface (not ctx.tool) to detect duplicate names across the server surface.
 *
 * All rules are pure functions — no IO, no Date.now, no Math.random, no fetch.
 * Severities and fixHints are verbatim from spec/mtqs-v0.1.yaml (authoritative registry).
 *
 * Primary source: SEP-986 "Specify Format for Tool Names" (Final, 2025-07-16)
 */

// Allowed character set for tool names per SEP-986: [A-Za-z0-9_\-./]
const ALLOWED_NAME_CHARS = /[^A-Za-z0-9_\-./]/;

/**
 * MTQS-N01: Tool Name Presence and Length
 * Fires when tool.name is absent/empty OR tool.name.length > 128.
 * Severity: error
 */
const n01: RuleDefinition = {
  id: 'MTQS-N01',
  description: 'Tool name must be present, non-empty, and between 1 and 128 characters; names over 128 characters violate the MCP spec (SEP-986 recommends 1-64).',
  dimension: 'naming',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint: 'Keep the tool name between 1 and 64 characters (SEP-986 recommendation) and at most 128 characters (MCP spec limit). Names over 128 chars will be rejected by clients.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    // Absent or empty name
    if (!tool.name || tool.name.length === 0) {
      return [
        {
          ruleId: 'MTQS-N01',
          dimension: 'naming',
          severity: 'error',
          message: 'MTQS-N01 [error] tool name is absent or empty: a tool name is required per MCP spec',
          location: { tool: tool.toolId, path: ['name'] },
          fixHint: n01.fixHint,
        },
      ];
    }
    // Name exceeds 128-character MCP spec limit
    const len = tool.name.length;
    if (len > 128) {
      return [
        {
          ruleId: 'MTQS-N01',
          dimension: 'naming',
          severity: 'error',
          message: `MTQS-N01 [error] tool name is ${len} characters: maximum is 128 per MCP spec (SEP-986 recommends 1-64)`,
          location: { tool: tool.toolId, path: ['name'] },
          fixHint: n01.fixHint,
        },
      ];
    }
    return [];
  },
};

/**
 * MTQS-N02: Tool Name Character Set
 * Fires when tool.name contains any character outside [A-Za-z0-9_\-./].
 * Severity: error
 */
const n02: RuleDefinition = {
  id: 'MTQS-N02',
  description: 'Tool name must contain only allowed characters: letters, digits, underscore, dash, dot, and forward-slash; no spaces or commas permitted.',
  dimension: 'naming',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint: 'Rename using only [A-Za-z0-9_\\-./] characters. Use underscore or dash as word separators. Spaces and commas cause parsing failures in many MCP clients.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (ALLOWED_NAME_CHARS.test(tool.name)) {
      return [
        {
          ruleId: 'MTQS-N02',
          dimension: 'naming',
          severity: 'error',
          message: `MTQS-N02 [error] tool name "${tool.name}" contains illegal characters: allowed: [A-Za-z0-9_\\-./]`,
          location: { tool: tool.toolId, path: ['name'] },
          fixHint: n02.fixHint,
        },
      ];
    }
    return [];
  },
};

/**
 * MTQS-N03: Tool Name Uniqueness (server-scoped)
 * Reads ctx.surface (NOT ctx.tool, which is null for server-scoped rules).
 * For each name shared by 2+ tools, emits ONE finding.
 * location.tool = '' (engine convention for server-scoped findings).
 * Findings emitted in sorted order by name (for determinism).
 * Severity: error
 */
const n03: RuleDefinition = {
  id: 'MTQS-N03',
  description: 'Tool names must be unique within a server; duplicate names cause non-deterministic tool dispatch and confuse agents.',
  dimension: 'naming',
  target: 'server',
  defaultSeverity: 'error',
  fixHint: 'Rename one of the colliding tools to uniquely identify it within the server. Use namespace prefixes (e.g., crm_search vs files_search) to avoid collisions.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    // ctx.tool is null for server-scoped rules — read ctx.surface
    const nameCounts = new Map<string, number>();
    for (const tool of ctx.surface) {
      nameCounts.set(tool.name, (nameCounts.get(tool.name) ?? 0) + 1);
    }

    const findings: Finding[] = [];
    // Iterate names in sorted order for deterministic output
    const sortedNames = [...nameCounts.keys()].sort();
    for (const name of sortedNames) {
      const count = nameCounts.get(name)!;
      if (count >= 2) {
        findings.push({
          ruleId: 'MTQS-N03',
          dimension: 'naming',
          severity: 'error',
          message: `MTQS-N03 [error] tool name "${name}" is duplicated: ${count} tools share this name, causing non-deterministic dispatch`,
          location: { tool: '', path: ['name'] },
          fixHint: n03.fixHint,
        });
      }
    }
    return findings;
  },
};

/**
 * namingRules — exported array of all Naming rules.
 * Order: N01, N02, N03 (alphabetical by ID, matching spec evaluation order §4.4).
 * N03 has target: 'server' — the engine routes it differently from N01/N02.
 */
export const namingRules: RuleDefinition[] = [n01, n02, n03];
