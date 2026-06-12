import type { Severity } from '@voke/core';
import type { RuleDefinition } from './types.js';
import { allRules } from '../rules/index.js';

/**
 * RuleRegistry — the startup-time plugin boundary for the MTQS rule engine (ENG-03).
 *
 * Lifecycle:
 *   1. register() rules during module initialization
 *   2. seal() before the runner executes — rejects any further registration
 *   3. list() returns rules sorted deterministically by id for the runner
 *   4. applyOverrides() returns a NEW sealed RuleRegistry with adjusted severities —
 *      never mutates the original (D-ENG-03 no-mutation guarantee)
 *
 * Anti-Pattern guard: never create a module-level singleton RuleRegistry.
 * Use createDefaultRegistry() to get a fresh instance per run, preserving test isolation.
 */
export class RuleRegistry {
  private readonly rules = new Map<string, RuleDefinition>();
  private sealed = false;

  /**
   * Register a rule definition.
   * Throws if the registry is sealed or if the same id has already been registered.
   */
  register(def: RuleDefinition): void {
    if (this.sealed) {
      throw new Error(`Registry sealed; cannot register ${def.id}`);
    }
    if (this.rules.has(def.id)) {
      throw new Error(`Duplicate rule id: ${def.id}`);
    }
    this.rules.set(def.id, def);
  }

  /**
   * Seal the registry. After sealing, register() throws.
   * Returns `this` for fluent chaining: `const r = new RuleRegistry(); r.seal();`
   */
  seal(): this {
    this.sealed = true;
    return this;
  }

  /**
   * Return all registered rules sorted ascending by id.
   *
   * Sort uses localeCompare('en', {sensitivity:'variant'}) for determinism across
   * environments — avoids LC_ALL variation (RESEARCH.md Pitfall 2, ARCHITECTURE.md D-pt-#4).
   */
  list(): ReadonlyArray<RuleDefinition> {
    return [...this.rules.values()].sort((a, b) =>
      a.id.localeCompare(b.id, 'en', { sensitivity: 'variant' }),
    );
  }

  /**
   * Return a NEW sealed RuleRegistry with severity overrides applied.
   *
   * This method NEVER mutates the current registry — it constructs a fresh one
   * and registers cloned rule definitions with adjusted defaultSeverity where
   * an override exists. (ENG-03 / D-ENG-03)
   *
   * @param overrides - Map of ruleId → Severity. Unknown rule ids are silently ignored.
   */
  applyOverrides(overrides: Record<string, Severity>): RuleRegistry {
    const next = new RuleRegistry();
    for (const def of this.rules.values()) {
      const overridden = overrides[def.id];
      next.register(overridden ? { ...def, defaultSeverity: overridden } : def);
    }
    return next.seal();
  }
}

/**
 * createDefaultRegistry — factory that returns a fresh sealed RuleRegistry.
 *
 * In Phase 2, returns an empty sealed registry.
 * Phase 3 will import './rules/index.js' here to register all MTQS rules.
 *
 * Always use this factory rather than a module-level singleton to preserve test isolation.
 */
export const createDefaultRegistry = (): RuleRegistry => {
  const registry = new RuleRegistry();
  for (const def of allRules) {
    registry.register(def);
  }
  return registry.seal();
};
