/**
 * rules/index.ts — MTQS v0.1 rule aggregator.
 *
 * Combines all five dimension rule arrays into a single `allRules` export
 * that is consumed by createDefaultRegistry() to populate the sealed registry.
 *
 * Wave 1 dimension modules:
 *   schemaRules      — 8 rules (03-01)
 *   descriptionRules — 3 rules (03-02)
 *   namingRules      — 3 rules (03-02)
 *   parameterRules   — 2 rules (03-03)
 *   annotationRules  — 6 rules (03-04)
 *
 * Total: 22 rules.
 */

import type { RuleDefinition } from '../engine/types.js';
import { schemaRules } from './schema.js';
import { descriptionRules } from './description.js';
import { namingRules } from './naming.js';
import { parameterRules } from './parameters.js';
import { annotationRules } from './annotations.js';

/**
 * allRules — the complete ordered set of 22 MTQS v0.1 rule definitions.
 *
 * Order: schema, description, naming, parameters, annotations.
 * The registry sorts by id internally on list() — insertion order does not
 * affect determinism, but a stable source order aids review.
 */
export const allRules: RuleDefinition[] = [
  ...schemaRules,
  ...descriptionRules,
  ...namingRules,
  ...parameterRules,
  ...annotationRules,
];

// Re-export dimension arrays for direct consumption when a caller only needs
// a single dimension's rules without importing the full aggregated set.
export { schemaRules } from './schema.js';
export { descriptionRules } from './description.js';
export { namingRules } from './naming.js';
export { parameterRules } from './parameters.js';
export { annotationRules } from './annotations.js';
