import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { loadRegistryFile } from '../../spec/helpers/loadRegistry.js';
import type { RuleRegistryEntry } from '../../spec/registry-types.js';

// Resolve the registry path relative to the repo root (process.cwd() under vitest run)
const REGISTRY_PATH = resolve(process.cwd(), 'spec/mtqs-v0.1.yaml');

// The exact set of 22 v0.1 P1 rule IDs — locked by MTQS-v0.1 registry authoring
const EXPECTED_IDS: string[] = [
  // Schema dimension (Tier 1, weight 1.5)
  'MTQS-S01',
  'MTQS-S02',
  'MTQS-S03',
  'MTQS-S04',
  'MTQS-S05',
  'MTQS-S06',
  'MTQS-S07',
  'MTQS-S08',
  // Description dimension (Tier 2, weight 1.2)
  'MTQS-D01',
  'MTQS-D02',
  'MTQS-D03',
  // Naming dimension (Tier 3, weight 1.0)
  'MTQS-N01',
  'MTQS-N02',
  'MTQS-N03',
  // Parameters dimension (Tier 2, weight 1.2)
  'MTQS-P01',
  'MTQS-P02',
  // Annotations dimension (Tier 1, weight 1.5)
  'MTQS-A01',
  'MTQS-A02',
  'MTQS-A03',
  'MTQS-A04',
  'MTQS-A05',
  'MTQS-A06',
];

// Weight-by-dimension lookup matching D-09 tier ordering
const WEIGHT_BY_DIMENSION: Record<string, number> = {
  schema: 1.5,
  annotations: 1.5,
  description: 1.2,
  parameters: 1.2,
  naming: 1.0,
};

let rules: RuleRegistryEntry[];

beforeAll(() => {
  rules = loadRegistryFile(REGISTRY_PATH);
});

describe('registry.rules — SPEC-03 completeness / uniqueness / source checks', () => {
  it('Test 2: registry has exactly the right number of entries (one per v0.1 rule)', () => {
    expect(rules).toHaveLength(EXPECTED_IDS.length);
  });

  it('Test 3: the set of ids equals the exact EXPECTED_IDS set (no missing, no extra)', () => {
    const actualIds = new Set(rules.map((r) => r.id));
    const expectedSet = new Set(EXPECTED_IDS);

    // Every expected ID must be present
    for (const id of EXPECTED_IDS) {
      expect(actualIds.has(id), `Expected ID ${id} to be present in registry`).toBe(true);
    }

    // No extra IDs beyond the expected set
    for (const id of actualIds) {
      expect(expectedSet.has(id), `Unexpected ID ${id} found in registry`).toBe(true);
    }
  });

  it('Test 4: no duplicate ids', () => {
    const ids = rules.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('Test 5: every id matches /^MTQS-[SDNPA]\\d{2}$/ (only valid v0.1 dimension letters)', () => {
    const idPattern = /^MTQS-[SDNPA]\d{2}$/;
    for (const rule of rules) {
      expect(
        idPattern.test(rule.id),
        `Rule id "${rule.id}" does not match /^MTQS-[SDNPA]\\d{2}$/`
      ).toBe(true);
    }
  });

  it('Test 6: every entry source is a non-empty string and does not contain "glama" (case-insensitive) — SPEC-01 anti-Glama guard', () => {
    for (const rule of rules) {
      expect(rule.source.length, `Rule ${rule.id} has empty source`).toBeGreaterThan(0);
      expect(
        rule.source.toLowerCase().includes('glama'),
        `Rule ${rule.id} source contains "glama": ${rule.source}`
      ).toBe(false);
    }
  });

  it('Test 7: every entry has a non-empty fixHint (>= 10 characters)', () => {
    for (const rule of rules) {
      expect(
        rule.fixHint.length,
        `Rule ${rule.id} fixHint is too short (${rule.fixHint.length} chars)`
      ).toBeGreaterThanOrEqual(10);
    }
  });

  it('Test 8: weights match the dimension tier (schema & annotations → 1.5, description & parameters → 1.2, naming → 1.0)', () => {
    for (const rule of rules) {
      const expectedWeight = WEIGHT_BY_DIMENSION[rule.dimension];
      expect(
        rule.weight,
        `Rule ${rule.id} (dimension: ${rule.dimension}) has weight ${rule.weight}, expected ${expectedWeight}`
      ).toBe(expectedWeight);
    }
  });
});
