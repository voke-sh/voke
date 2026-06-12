/**
 * registry-coverage.test.ts — bidirectional doc<->registry coverage test.
 *
 * Proves that every rule id in spec/mtqs-v0.1.yaml has exactly one registered
 * RuleDefinition, and no extra ids are registered (set equality in both directions).
 *
 * Also asserts per-id parity: severity, dimension, fixHint (trimmed), and target
 * all match the YAML. This is the RULE-06 closure test for MTQS v0.1.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadRegistryFile } from '../../packages/core/dist/index.js';
import { createDefaultRegistry } from '../../packages/linter/src/engine/registry.js';

// ────────────────────────────────────────────────────────────────────────────
// Load both sources of truth
// ────────────────────────────────────────────────────────────────────────────

const YAML_PATH = resolve(process.cwd(), 'spec/mtqs-v0.1.yaml');
const yamlEntries = loadRegistryFile(YAML_PATH);
const registryRules = createDefaultRegistry().list();

// ────────────────────────────────────────────────────────────────────────────
// Basic count assertions
// ────────────────────────────────────────────────────────────────────────────

describe('registry coverage — count assertions', () => {
  it('YAML has exactly 22 entries', () => {
    expect(yamlEntries).toHaveLength(22);
  });

  it('createDefaultRegistry().list() has exactly 22 rules', () => {
    expect(registryRules).toHaveLength(22);
  });

  it('YAML entry count equals registry rule count', () => {
    expect(registryRules).toHaveLength(yamlEntries.length);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Direction A: every YAML id appears in the registry (no missing)
// ────────────────────────────────────────────────────────────────────────────

describe('registry coverage — Direction A: YAML -> registry (no missing rules)', () => {
  const registeredIds = new Set(registryRules.map(r => r.id));

  for (const entry of yamlEntries) {
    it(`YAML id ${entry.id} is registered in the default registry`, () => {
      expect(registeredIds.has(entry.id)).toBe(true);
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Direction B: every registry id appears in the YAML (no extra ids)
// ────────────────────────────────────────────────────────────────────────────

describe('registry coverage — Direction B: registry -> YAML (no extra rules)', () => {
  const yamlIds = new Set(yamlEntries.map(e => e.id));

  for (const rule of registryRules) {
    it(`registered id ${rule.id} appears in the YAML`, () => {
      expect(yamlIds.has(rule.id)).toBe(true);
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Set equality: YAML ids === registry ids
// ────────────────────────────────────────────────────────────────────────────

describe('registry coverage — set equality', () => {
  it('the set of YAML ids exactly equals the set of registered ids', () => {
    const yamlIds = new Set(yamlEntries.map(e => e.id));
    const registeredIds = new Set(registryRules.map(r => r.id));
    expect(registeredIds).toEqual(yamlIds);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// PARITY: per-id severity, dimension, fixHint, target
// ────────────────────────────────────────────────────────────────────────────

describe('registry coverage — per-rule parity (severity, dimension, fixHint, target)', () => {
  const registeredById = new Map(registryRules.map(r => [r.id, r]));
  const yamlById = new Map(yamlEntries.map(e => [e.id, e]));

  for (const entry of yamlEntries) {
    const registered = registeredById.get(entry.id);
    if (!registered) continue; // Direction A already asserts this — skip on missing

    it(`${entry.id}: defaultSeverity matches YAML severity`, () => {
      expect(registered.defaultSeverity).toBe(entry.severity);
    });

    it(`${entry.id}: dimension matches YAML dimension`, () => {
      expect(registered.dimension).toBe(entry.dimension);
    });

    it(`${entry.id}: fixHint (trimmed) matches YAML fixHint (trimmed)`, () => {
      expect(registered.fixHint.trim()).toBe(entry.fixHint.trim());
    });

    it(`${entry.id}: target matches YAML scope (per-tool -> 'tool', server -> 'server')`, () => {
      const expectedTarget = entry.scope === 'server' ? 'server' : 'tool';
      expect(registered.target).toBe(expectedTarget);
    });
  }

  it('exactly one rule has target === "server" and its id is MTQS-N03', () => {
    const serverRules = registryRules.filter(r => r.target === 'server');
    expect(serverRules).toHaveLength(1);
    expect(serverRules[0].id).toBe('MTQS-N03');
  });

  it('the only YAML entry with scope === "server" is MTQS-N03', () => {
    const serverEntries = yamlEntries.filter(e => e.scope === 'server');
    expect(serverEntries).toHaveLength(1);
    expect(serverEntries[0].id).toBe('MTQS-N03');
  });

  it('all remaining 21 rules have target === "tool"', () => {
    const toolRules = registryRules.filter(r => r.target === 'tool');
    expect(toolRules).toHaveLength(21);
  });

  it('per-id target parity covers all registered rules (no target undefined)', () => {
    for (const rule of registryRules) {
      const yamlEntry = yamlById.get(rule.id);
      if (!yamlEntry) continue;
      const expectedTarget = yamlEntry.scope === 'server' ? 'server' : 'tool';
      expect(rule.target).toBe(expectedTarget);
    }
  });
});
