import { describe, it, expect, beforeEach } from 'vitest';
import { RuleRegistry, createDefaultRegistry } from '../../packages/linter/src/engine/registry.js';
import type { RuleDefinition } from '../../packages/linter/src/engine/types.js';
import type { RuleFunction } from '../../packages/linter/src/engine/types.js';

// Minimal no-op RuleFunction for testing
const noopFn: RuleFunction = () => [];

const makeRule = (id: string, overrides?: Partial<RuleDefinition>): RuleDefinition => ({
  id,
  description: `Test rule ${id}`,
  dimension: 'schema',
  target: 'tool',
  defaultSeverity: 'error',
  fixHint: `Fix hint for ${id}`,
  mtqsVersion: '0.1',
  fn: noopFn,
  ...overrides,
});

describe('RuleRegistry', () => {
  let registry: RuleRegistry;

  beforeEach(() => {
    registry = new RuleRegistry();
  });

  describe('register', () => {
    it('accepts a valid rule definition', () => {
      expect(() => registry.register(makeRule('MTQS-S01'))).not.toThrow();
    });

    it('throws "Duplicate rule id" when registering the same id twice', () => {
      registry.register(makeRule('MTQS-S01'));
      expect(() => registry.register(makeRule('MTQS-S01'))).toThrow('Duplicate rule id');
    });

    it('throws "Registry sealed" when registering after seal()', () => {
      registry.seal();
      expect(() => registry.register(makeRule('MTQS-S01'))).toThrow('Registry sealed');
    });

    it('allows registering multiple distinct rule ids', () => {
      registry.register(makeRule('MTQS-S01'));
      registry.register(makeRule('MTQS-S02'));
      registry.register(makeRule('MTQS-D01'));
      expect(registry.list()).toHaveLength(3);
    });
  });

  describe('seal', () => {
    it('returns the registry instance (fluent API)', () => {
      const result = registry.seal();
      expect(result).toBe(registry);
    });

    it('prevents registration after sealing', () => {
      registry.seal();
      expect(() => registry.register(makeRule('MTQS-S01'))).toThrow('Registry sealed');
    });

    it('allows list() to be called after sealing', () => {
      registry.register(makeRule('MTQS-S01'));
      registry.seal();
      expect(registry.list()).toHaveLength(1);
    });
  });

  describe('list', () => {
    it('returns rules sorted ascending by id via localeCompare', () => {
      // Register in non-alphabetical order to verify sort
      registry.register(makeRule('MTQS-S03'));
      registry.register(makeRule('MTQS-D01'));
      registry.register(makeRule('MTQS-N02'));
      registry.register(makeRule('MTQS-S01'));

      const ids = registry.list().map(r => r.id);
      expect(ids).toEqual(['MTQS-D01', 'MTQS-N02', 'MTQS-S01', 'MTQS-S03']);
    });

    it('returns an empty array for an empty registry', () => {
      expect(registry.list()).toEqual([]);
    });

    it('returns rules in consistent sorted order regardless of registration order', () => {
      registry.register(makeRule('MTQS-Z01'));
      registry.register(makeRule('MTQS-A01'));
      registry.register(makeRule('MTQS-M01'));

      const ids = registry.list().map(r => r.id);
      expect(ids).toEqual(['MTQS-A01', 'MTQS-M01', 'MTQS-Z01']);
    });

    it('returns a ReadonlyArray (list() result is sorted, not the insertion order)', () => {
      registry.register(makeRule('MTQS-S02'));
      registry.register(makeRule('MTQS-S01'));
      const result = registry.list();
      expect(result[0].id).toBe('MTQS-S01');
      expect(result[1].id).toBe('MTQS-S02');
    });
  });

  describe('applyOverrides', () => {
    it('returns a NEW RuleRegistry instance (not the same reference)', () => {
      registry.register(makeRule('MTQS-S01'));
      const overridden = registry.applyOverrides({ 'MTQS-S01': 'warning' });
      expect(overridden).not.toBe(registry);
    });

    it('the new registry has the overridden severity for the specified rule', () => {
      registry.register(makeRule('MTQS-S01', { defaultSeverity: 'error' }));
      const overridden = registry.applyOverrides({ 'MTQS-S01': 'warning' });
      const rule = overridden.list().find(r => r.id === 'MTQS-S01');
      expect(rule?.defaultSeverity).toBe('warning');
    });

    it('does NOT mutate the original registry (ENG-03: original severity unchanged)', () => {
      registry.register(makeRule('MTQS-S01', { defaultSeverity: 'error' }));
      registry.applyOverrides({ 'MTQS-S01': 'warning' });
      // Original registry must still have 'error' severity
      const originalRule = registry.list().find(r => r.id === 'MTQS-S01');
      expect(originalRule?.defaultSeverity).toBe('error');
    });

    it('the returned registry is sealed (cannot register more rules)', () => {
      registry.register(makeRule('MTQS-S01'));
      const overridden = registry.applyOverrides({ 'MTQS-S01': 'warning' });
      expect(() => overridden.register(makeRule('MTQS-S02'))).toThrow('Registry sealed');
    });

    it('preserves rules without overrides unchanged', () => {
      registry.register(makeRule('MTQS-S01', { defaultSeverity: 'error' }));
      registry.register(makeRule('MTQS-S02', { defaultSeverity: 'warning' }));
      const overridden = registry.applyOverrides({ 'MTQS-S01': 'info' });
      const s02 = overridden.list().find(r => r.id === 'MTQS-S02');
      expect(s02?.defaultSeverity).toBe('warning');
    });

    it('applies multiple overrides at once', () => {
      registry.register(makeRule('MTQS-S01', { defaultSeverity: 'error' }));
      registry.register(makeRule('MTQS-S02', { defaultSeverity: 'error' }));
      const overridden = registry.applyOverrides({
        'MTQS-S01': 'warning',
        'MTQS-S02': 'info',
      });
      const s01 = overridden.list().find(r => r.id === 'MTQS-S01');
      const s02 = overridden.list().find(r => r.id === 'MTQS-S02');
      expect(s01?.defaultSeverity).toBe('warning');
      expect(s02?.defaultSeverity).toBe('info');
    });

    it('ignores override keys that do not match any registered rule', () => {
      registry.register(makeRule('MTQS-S01'));
      // 'MTQS-X99' is not registered — should not cause errors
      expect(() => registry.applyOverrides({ 'MTQS-X99': 'info' })).not.toThrow();
    });
  });
});

describe('createDefaultRegistry', () => {
  it('returns a RuleRegistry instance', () => {
    const reg = createDefaultRegistry();
    expect(reg).toBeInstanceOf(RuleRegistry);
  });

  it('returns a sealed registry — register throws', () => {
    const reg = createDefaultRegistry();
    expect(() => reg.register(makeRule('MTQS-S01'))).toThrow('Registry sealed');
  });

  it('returns a registry with all 22 MTQS v0.1 rules (Phase 3)', () => {
    const reg = createDefaultRegistry();
    expect(reg.list()).toHaveLength(22);
  });
});
