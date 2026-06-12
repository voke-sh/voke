/**
 * doc-registry-sync.test.ts — SPEC-01 gate
 *
 * Bidirectional check: every rule ID in the YAML registry has a matching
 * {#MTQS-XXX} anchor in spec/MTQS-v0.1.md, and every anchor in the doc
 * has a matching registry entry. No orphans in either direction.
 *
 * Also verifies that every rule section contains both a "**Passing example:**"
 * and a "**Failing example:**" marker, as required by the rubric template.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSpecDoc, loadRegistryFile } from '@voke/core';

// Resolve paths relative to the repo root (tests run from repo root via vitest)
const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const DOC_PATH = resolve(REPO_ROOT, 'spec', 'MTQS-v0.1.md');
const REGISTRY_PATH = resolve(REPO_ROOT, 'spec', 'mtqs-v0.1.yaml');

describe('doc↔registry sync (SPEC-01)', () => {
  const docText = readFileSync(DOC_PATH, 'utf8');
  const parsed = parseSpecDoc(docText);
  const registryEntries = loadRegistryFile(REGISTRY_PATH);
  const registryIds = registryEntries.map((entry) => entry.id);

  it('Test 1: doc anchors and registry IDs are identical sets — no orphans in either direction', () => {
    const docAnchorSet = new Set(parsed.anchors);
    const registryIdSet = new Set(registryIds);

    // Every registry entry has a matching doc anchor
    for (const id of registryIdSet) {
      expect(
        docAnchorSet.has(id),
        `Registry entry ${id} has no matching {#${id}} anchor in spec/MTQS-v0.1.md`,
      ).toBe(true);
    }

    // Every doc anchor has a matching registry entry
    for (const anchor of docAnchorSet) {
      expect(
        registryIdSet.has(anchor),
        `Doc anchor {#${anchor}} in spec/MTQS-v0.1.md has no matching registry entry`,
      ).toBe(true);
    }

    // Set sizes match (no duplicates)
    expect(docAnchorSet.size).toBe(registryIdSet.size);
  });

  it('Test 2: every rule section contains both a passing example and a failing example', () => {
    for (const id of registryIds) {
      const section = parsed.sections[id];
      expect(
        section,
        `No section found in doc for rule ${id} — rule heading regex may not match`,
      ).toBeDefined();

      expect(
        section?.hasGoodExample,
        `Rule ${id} section is missing "**Passing example:**" marker`,
      ).toBe(true);

      expect(
        section?.hasBadExample,
        `Rule ${id} section is missing "**Failing example:**" marker`,
      ).toBe(true);
    }
  });
});
