import type { Severity, DimensionId } from '@voke/core';
import type { ToolSnapshot } from '../ingestion/types.js';
import type { VokeConfig } from '../config/types.js';

/**
 * RuleTarget — whether a rule fires per-tool or once for the full server surface (ENG-02).
 * The only server-scoped rule in MTQS v0.1 is MTQS-N03 (duplicate name check).
 */
export type RuleTarget = 'tool' | 'server';

/**
 * FindingLocation — points to the exact location in the tool definition that triggered the finding.
 *
 * tool: toolId of the tool (or '' for server-scoped findings)
 * path: JSON path within the tool definition, e.g. ['inputSchema', 'properties', 'user']
 */
export interface FindingLocation {
  tool: string;
  path: string[];
}

/**
 * Finding — the runtime finding produced by rule functions.
 *
 * NOTE: This intentionally extends the scoring-facing @voke/core Finding ({ruleId, severity, dimension})
 * with location, message, and fixHint. Do NOT re-export this under the same name from the engine
 * barrel as @voke/core's Finding — they serve different purposes and must remain distinguishable.
 *
 * severity: the RESOLVED severity (after config.severityOverrides) — scoring uses resolved values.
 */
export interface Finding {
  ruleId: string;
  dimension: DimensionId;
  severity: Severity;
  message: string;
  location: FindingLocation;
  fixHint: string;
}

/**
 * RuleContext — the frozen object passed to every rule function (D-14).
 *
 * tool: the ToolSnapshot being evaluated (null for server-scoped rules — ENG-02)
 * surface: the full sorted server surface (ReadonlyArray for type-level purity enforcement)
 * config: resolved VokeConfig including any severity overrides (Readonly for compile-time safety)
 *
 * Object.freeze in the runner provides the runtime immutability guarantee on top of TypeScript
 * readonly annotations (RESEARCH.md Pattern 11).
 */
export interface RuleContext {
  readonly tool: ToolSnapshot | null;
  readonly surface: ReadonlyArray<ToolSnapshot>;
  readonly config: Readonly<VokeConfig>;
}

/**
 * RuleFunction — the pure synchronous contract every MTQS rule must satisfy (ENG-01).
 *
 * Rules MUST NOT: call Date.now(), Math.random(), fetch(), fs.*,
 * or mutate the context. All such violations are caught at test time by the
 * frozen context + network-blocked test infrastructure (D-14).
 */
export type RuleFunction = (ctx: RuleContext) => Finding[];

/**
 * RuleDefinition — the full descriptor for a single MTQS rule registered in the RuleRegistry.
 */
export interface RuleDefinition {
  id: string;
  description: string;
  dimension: DimensionId;
  target: RuleTarget;
  defaultSeverity: Severity;
  fixHint: string;
  mtqsVersion: string;
  fn: RuleFunction;
}
