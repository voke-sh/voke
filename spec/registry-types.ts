import { z } from 'zod';

export const SeveritySchema = z.enum(['error', 'warning', 'info', 'hint']);

export const DimensionSchema = z.enum([
  'schema',
  'description',
  'naming',
  'parameters',
  'annotations',
]);

export const ScopeSchema = z.enum(['per-tool', 'server']);

export const RuleRegistryEntrySchema = z.object({
  // Tightened to [SDNPA] — only valid v0.1 dimension letters; typos fail the build (Pitfall 5 guard)
  id: z.string().regex(/^MTQS-[SDNPA]\d{2}$/),
  severity: SeveritySchema,
  dimension: DimensionSchema,
  scope: ScopeSchema,
  weight: z.number().min(0.1).max(3.0),
  description: z.string().min(10),
  fixHint: z.string().min(10),
  source: z.string().url(),
  mtqsVersion: z.string().regex(/^\d+\.\d+$/),
});

export const RuleRegistrySchema = z.object({
  rules: z.array(RuleRegistryEntrySchema),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type DimensionId = z.infer<typeof DimensionSchema>;
export type RuleScope = z.infer<typeof ScopeSchema>;
export type RuleRegistryEntry = z.infer<typeof RuleRegistryEntrySchema>;
