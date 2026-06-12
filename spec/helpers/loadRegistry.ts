import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { RuleRegistrySchema } from '../registry-types.js';
import type { RuleRegistryEntry } from '../registry-types.js';

/**
 * Parse a YAML string and return validated typed registry entries.
 * Throws a Zod validation error if any entry is malformed or missing required fields.
 * Does not perform any IO — pure function over a string.
 */
export const loadRegistry = (yamlText: string): RuleRegistryEntry[] => {
  const parsed = load(yamlText);
  const validated = RuleRegistrySchema.parse(parsed);
  return validated.rules;
};

/**
 * Read a YAML file from disk and return validated typed registry entries.
 * Uses synchronous file I/O — appropriate for build-time tooling, not rule functions.
 * Throws on missing file or invalid registry content.
 */
export const loadRegistryFile = (path: string): RuleRegistryEntry[] => {
  const yamlText = readFileSync(path, 'utf8');
  return loadRegistry(yamlText);
};
