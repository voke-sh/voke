/**
 * annotations.ts — MTQS Annotation Transparency rules (A01–A06), dimension 'annotations' (weight 1.5x).
 *
 * These rules evaluate the MCP tool annotations object and its four hint booleans:
 * readOnlyHint, destructiveHint, idempotentHint, openWorldHint.
 *
 * All rule functions are pure: no IO, no Date.now(), no Math.random(), no fetch.
 * Network-blocked test (D-14) enforces this at test time.
 *
 * Rule coverage:
 *   A01 (info)    — annotations object absent → tool defaults to riskiest posture
 *   A02 (warning) — readOnlyHint not a boolean within annotations
 *   A03 (warning) — destructiveHint not a boolean within annotations
 *   A04 (info)    — idempotentHint not a boolean within annotations
 *   A05 (info)    — openWorldHint not a boolean within annotations
 *   A06 (error)   — readOnlyHint:true AND destructiveHint:true contradiction
 */

import type { RuleDefinition, RuleContext, Finding } from '../engine/types.js';

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

/** Returns true when the tool has a non-null annotations object. */
const annotationsPresent = (t: NonNullable<RuleContext['tool']>): boolean =>
  typeof t.annotations === 'object' && t.annotations !== null;

/** Returns true when the specified hint key is a boolean within annotations. */
const hintIsBool = (ann: Record<string, unknown>, key: string): boolean =>
  typeof ann[key] === 'boolean';

// ────────────────────────────────────────────────────────────────────────────
// Rule definitions
// ────────────────────────────────────────────────────────────────────────────

const a01: RuleDefinition = {
  id: 'MTQS-A01',
  description:
    'annotations object should be present; unannotated tools default to the most-risky posture (readOnly=false, destructive=true, idempotent=false).',
  dimension: 'annotations',
  target: 'tool',
  defaultSeverity: 'info',
  fixHint:
    'Add "annotations": {} and set at minimum readOnlyHint and destructiveHint. Unannotated tools default to the most restrictive risk posture.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (annotationsPresent(tool)) return [];
    return [
      {
        ruleId: 'MTQS-A01',
        dimension: 'annotations',
        severity: 'info',
        message:
          'MTQS-A01 [info] annotations object is absent: tool defaults to the most-risky posture (readOnly=false, destructive=true, idempotent=false)',
        location: { tool: tool.toolId, path: ['annotations'] },
        fixHint: a01.fixHint,
      },
    ];
  },
};

const a02: RuleDefinition = {
  id: 'MTQS-A02',
  description:
    'readOnlyHint should be explicitly set as a boolean; the default is false, so an unset field signals the tool may modify its environment.',
  dimension: 'annotations',
  target: 'tool',
  defaultSeverity: 'warning',
  fixHint:
    'Set "readOnlyHint": true if the tool only reads data; false if it writes. Do not leave the agent to assume the worst (default is false = may modify).',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (!annotationsPresent(tool)) return [];
    const ann = tool.annotations as Record<string, unknown>;
    if (hintIsBool(ann, 'readOnlyHint')) return [];
    return [
      {
        ruleId: 'MTQS-A02',
        dimension: 'annotations',
        severity: 'warning',
        message:
          'MTQS-A02 [warning] readOnlyHint is not set: default is false (tool may modify environment), which may cause unnecessary confirmation prompts for read-only tools',
        location: { tool: tool.toolId, path: ['annotations', 'readOnlyHint'] },
        fixHint: a02.fixHint,
      },
    ];
  },
};

const a03: RuleDefinition = {
  id: 'MTQS-A03',
  description:
    'destructiveHint should be explicitly set as a boolean; the default is true, so an unset field signals the tool may perform destructive updates.',
  dimension: 'annotations',
  target: 'tool',
  defaultSeverity: 'warning',
  fixHint:
    'Set "destructiveHint": false for additive operations (create/append); true for delete/overwrite. Default is true, meaning destructive assumed.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (!annotationsPresent(tool)) return [];
    const ann = tool.annotations as Record<string, unknown>;
    if (hintIsBool(ann, 'destructiveHint')) return [];
    return [
      {
        ruleId: 'MTQS-A03',
        dimension: 'annotations',
        severity: 'warning',
        message:
          'MTQS-A03 [warning] destructiveHint is not set: default is true (tool may perform destructive updates), which causes unnecessary confirmation prompts for additive tools',
        location: { tool: tool.toolId, path: ['annotations', 'destructiveHint'] },
        fixHint: a03.fixHint,
      },
    ];
  },
};

const a04: RuleDefinition = {
  id: 'MTQS-A04',
  description:
    'idempotentHint should be explicitly set as a boolean to inform agents whether it is safe to retry the tool with the same arguments.',
  dimension: 'annotations',
  target: 'tool',
  defaultSeverity: 'info',
  fixHint:
    'Set "idempotentHint": true if repeated calls with the same args produce no additional effect (safe to retry on failure). Default is false.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (!annotationsPresent(tool)) return [];
    const ann = tool.annotations as Record<string, unknown>;
    if (hintIsBool(ann, 'idempotentHint')) return [];
    return [
      {
        ruleId: 'MTQS-A04',
        dimension: 'annotations',
        severity: 'info',
        message:
          'MTQS-A04 [info] idempotentHint is not set: agents cannot determine if retrying this tool is safe',
        location: { tool: tool.toolId, path: ['annotations', 'idempotentHint'] },
        fixHint: a04.fixHint,
      },
    ];
  },
};

const a05: RuleDefinition = {
  id: 'MTQS-A05',
  description:
    'openWorldHint should be explicitly set as a boolean to clarify whether the tool interacts with external entities beyond its local environment.',
  dimension: 'annotations',
  target: 'tool',
  defaultSeverity: 'info',
  fixHint:
    'Set "openWorldHint": false for closed-domain tools (local file, internal DB); true for tools touching external APIs or the internet. Default is true.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (!annotationsPresent(tool)) return [];
    const ann = tool.annotations as Record<string, unknown>;
    if (hintIsBool(ann, 'openWorldHint')) return [];
    return [
      {
        ruleId: 'MTQS-A05',
        dimension: 'annotations',
        severity: 'info',
        message:
          'MTQS-A05 [info] openWorldHint is not set: default is true (tool may interact with external entities)',
        location: { tool: tool.toolId, path: ['annotations', 'openWorldHint'] },
        fixHint: a05.fixHint,
      },
    ];
  },
};

const a06: RuleDefinition = {
  id: 'MTQS-A06',
  description:
    'When readOnlyHint is true, destructiveHint must not also be true; a read-only tool cannot be destructive.',
  dimension: 'annotations',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint:
    'Set destructiveHint: false (or omit it) when readOnlyHint: true. The MCP schema notes destructiveHint is only meaningful when readOnlyHint == false.',
  mtqsVersion: '0.1',
  fn: (ctx: RuleContext): Finding[] => {
    const tool = ctx.tool!;
    if (!annotationsPresent(tool)) return [];
    const ann = tool.annotations as Record<string, unknown>;
    if (ann['readOnlyHint'] !== true || ann['destructiveHint'] !== true) return [];
    return [
      {
        ruleId: 'MTQS-A06',
        dimension: 'annotations',
        severity: 'error',
        message:
          'MTQS-A06 [error] annotations.readOnlyHint is true and annotations.destructiveHint is true: a read-only tool cannot be destructive',
        location: { tool: tool.toolId, path: ['annotations', 'destructiveHint'] },
        fixHint: a06.fixHint,
      },
    ];
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────────────────────────────────

export const annotationRules: RuleDefinition[] = [a01, a02, a03, a04, a05, a06];
