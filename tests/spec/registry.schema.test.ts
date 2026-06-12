import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadRegistryFile } from '@voke/core';

// Resolve the registry path relative to the repo root (process.cwd() under vitest run)
const REGISTRY_PATH = resolve(process.cwd(), 'spec/mtqs-v0.1.yaml');

describe('registry.schema — SPEC-04 Zod validation gate', () => {
  it('Test 1: loadRegistryFile parses spec/mtqs-v0.1.yaml without throwing (every entry satisfies RuleRegistryEntrySchema)', () => {
    expect(() => loadRegistryFile(REGISTRY_PATH)).not.toThrow();
  });
});
