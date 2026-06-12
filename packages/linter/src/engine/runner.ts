import type { ToolSnapshot } from '../ingestion/types.js';
import type { Finding, RuleContext } from './types.js';
import type { VokeConfig } from '../config/types.js';
import { RuleRegistry } from './registry.js';

/**
 * RuleExecutionError — thrown when a rule's fn() call throws (D-13: fail-fast).
 *
 * This is the exit-code-5 failure class (RESEARCH.md Pattern 12).
 * The numeric exit code mapping lives in the CLI layer (Phase 4);
 * the error type is defined here in the engine.
 *
 * Carries ruleId + toolId so CI output can pinpoint exactly which rule
 * and which tool caused the failure — directly actionable.
 */
export class RuleExecutionError extends Error {
  constructor(
    public readonly ruleId: string,
    public readonly toolId: string,
    public readonly cause: unknown,
  ) {
    super(`Rule ${ruleId} threw on tool ${toolId}: ${String(cause)}`);
    this.name = 'RuleExecutionError';
  }
}

/**
 * runRules — the pure runner that executes all registered rules against a tool surface.
 *
 * Determinism guarantees (RESEARCH.md Pattern 9):
 * 1. surface sorted ascending by toolId (localeCompare 'en' variant) before iteration
 * 2. rules iterated in registry.list() order (sorted ascending by id)
 * 3. each RuleContext is Object.freeze'd to prevent mutation (D-14)
 * 4. returned findings sorted toolId → ruleId → path.join('.') (spec §4.4 fixed evaluation order)
 * 5. severity resolved via config.severityOverrides[id] ?? defaultSeverity; 'off' → skip
 *
 * Fail-fast (D-13): any rule fn() that throws is wrapped in RuleExecutionError and
 * rethrown immediately — no silent swallow, no partial finding set.
 *
 * @param surface - the tool surface (will be sorted internally; does not mutate the array)
 * @param registry - sealed RuleRegistry (from createDefaultRegistry or applyOverrides)
 * @param config - resolved VokeConfig (severityOverrides applied upstream or default {})
 * @returns Finding[] sorted deterministically per spec
 */
export const runRules = (
  surface: ReadonlyArray<ToolSnapshot>,
  registry: RuleRegistry,
  config: VokeConfig,
): Finding[] => {
  const rules = registry.list(); // already sorted by id (determinism point #4)
  const sortedSurface = [...surface].sort((a, b) =>
    a.toolId.localeCompare(b.toolId, 'en', { sensitivity: 'variant' }),
  );

  const findings: Finding[] = [];

  for (const rule of rules) {
    // Resolve severity: config override wins; fall back to rule default
    const resolvedSeverity = config.severityOverrides?.[rule.id] ?? rule.defaultSeverity;
    // 'off' is a special sentinel — skip this rule entirely
    if ((resolvedSeverity as string) === 'off') continue;

    if (rule.target === 'tool') {
      // Per-tool rule: call fn once per tool in the sorted surface
      for (const tool of sortedSurface) {
        const ctx: RuleContext = Object.freeze({
          tool,
          surface: sortedSurface,
          config,
        });
        let raw: Finding[];
        try {
          raw = rule.fn(ctx);
        } catch (err) {
          // D-13: fail fast — surface which rule + which tool caused the throw
          throw new RuleExecutionError(rule.id, tool.toolId, err);
        }
        // Stamp each finding with the resolved severity
        findings.push(...raw.map(f => ({ ...f, severity: resolvedSeverity })));
      }
    } else {
      // Server-scoped rule (ENG-02): call fn once with tool: null
      const ctx: RuleContext = Object.freeze({
        tool: null,
        surface: sortedSurface,
        config,
      });
      let raw: Finding[];
      try {
        raw = rule.fn(ctx);
      } catch (err) {
        // D-13: server rules tag toolId as 'SERVER' for identifiability
        throw new RuleExecutionError(rule.id, 'SERVER', err);
      }
      findings.push(...raw.map(f => ({ ...f, severity: resolvedSeverity })));
    }
  }

  // Sort findings for deterministic output per spec §4.4 fixed evaluation order:
  // toolId asc → ruleId asc → path.join('.') asc
  // All comparisons use localeCompare('en', {sensitivity:'variant'}) (determinism point #4)
  return findings.sort(
    (a, b) =>
      a.location.tool.localeCompare(b.location.tool, 'en', { sensitivity: 'variant' }) ||
      a.ruleId.localeCompare(b.ruleId, 'en', { sensitivity: 'variant' }) ||
      a.location.path.join('.').localeCompare(b.location.path.join('.'), 'en', { sensitivity: 'variant' }),
  );
};
