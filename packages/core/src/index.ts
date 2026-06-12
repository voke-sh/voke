export { loadRegistry, loadRegistryFile } from './loadRegistry.js';
export { parseSpecDoc } from './parseSpecDoc.js';
export type { ParsedSpecDoc, SpecDocSection } from './parseSpecDoc.js';
export { penaltyFor, scoreTool, tierFor, applyCaps, serverScore } from './scoring.js';
export type { Finding } from './scoring.js';
export {
  SeveritySchema,
  DimensionSchema,
  ScopeSchema,
  RuleRegistryEntrySchema,
  RuleRegistrySchema,
} from './registry-types.js';
export type { Severity, DimensionId, RuleScope, RuleRegistryEntry } from './registry-types.js';
