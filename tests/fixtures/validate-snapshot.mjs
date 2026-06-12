/**
 * Validates tests/fixtures/apideck-snapshot.json against the acceptance criteria:
 * - Valid JSON with required top-level fields
 * - tools.length >= 6
 * - tools sorted ascending by toolId
 * - no tool has score/findings/tier fields (D-01 — raw surface only)
 * - each tool has a non-empty contentHash (64-char hex)
 * - contains the expected toolIds: crm_search_contacts, search
 * - at least one tool has $ref with #/$defs/ (D-07)
 *
 * Exits non-zero on failure.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, 'apideck-snapshot.json');

let snapshot;
try {
  snapshot = JSON.parse(readFileSync(fixturePath, 'utf8'));
} catch (err) {
  console.error('FAIL: Cannot parse apideck-snapshot.json as JSON:', err.message);
  process.exit(1);
}

const errors = [];

// Required top-level fields
for (const field of ['snapshotVersion', 'mtqsVersion', 'server', 'tools']) {
  if (!(field in snapshot)) errors.push(`Missing required top-level field: ${field}`);
}

const tools = snapshot.tools;
if (!Array.isArray(tools)) {
  errors.push('tools must be an array');
} else {
  // Check minimum count
  if (tools.length < 6) {
    errors.push(`tools.length must be >= 6, got ${tools.length}`);
  }

  // Check sorted ascending by toolId
  for (let i = 1; i < tools.length; i++) {
    const prev = tools[i - 1].toolId;
    const curr = tools[i].toolId;
    if (prev.localeCompare(curr, 'en', { sensitivity: 'variant' }) >= 0) {
      errors.push(`tools not sorted: "${prev}" >= "${curr}" at index ${i}`);
    }
  }

  // Check no score/findings/tier fields (D-01)
  const forbiddenFields = ['score', 'findings', 'tier', 'dimensions'];
  for (const tool of tools) {
    for (const field of forbiddenFields) {
      if (field in tool) {
        errors.push(`Tool "${tool.toolId}" has forbidden field "${field}" (raw surface only, D-01)`);
      }
    }
  }

  // Check each tool has a valid 64-char hex contentHash
  const hexPattern = /^[0-9a-f]{64}$/;
  for (const tool of tools) {
    if (!tool.contentHash) {
      errors.push(`Tool "${tool.toolId}" is missing contentHash`);
    } else if (!hexPattern.test(tool.contentHash)) {
      errors.push(`Tool "${tool.toolId}" contentHash is not 64-char hex: "${tool.contentHash}"`);
    }
  }

  // Check required toolIds
  const toolIds = new Set(tools.map(t => t.toolId));
  for (const required of ['crm_search_contacts', 'search']) {
    if (!toolIds.has(required)) {
      errors.push(`Missing required toolId: ${required}`);
    }
  }

  // Check at least one tool has $ref with #/$defs/ (D-07)
  const fixtureStr = readFileSync(fixturePath, 'utf8');
  if (!fixtureStr.includes('#/$defs/')) {
    errors.push('No internal $ref to $defs found — D-07 test case missing');
  }
}

if (errors.length > 0) {
  console.error('FAIL: apideck-snapshot.json validation failed:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`OK: apideck-snapshot.json is valid (${tools.length} tools, sorted, no scores, all contentHashes present)`);
process.exit(0);
