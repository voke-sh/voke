/**
 * Snapshot writer (ING-03, D-01).
 *
 * Writes a VokeSnapshot to disk in a canonical form.
 * The tool surface body is serialized via canonicalJson (sorted keys) to ensure
 * that two writes of the same surface are byte-identical (D-12 / determinism point #6).
 * meta.capturedAt is kept as written (it is provenance, D-02) and does NOT affect the
 * canonical body comparison.
 *
 * Note: This module is intentionally separate from snapshot-reader.ts (read-vs-write
 * separation). Both are imported by the CLI --save-snapshot flag (Phase 4).
 */
import { writeFileSync } from 'node:fs';
import { canonicalJson } from '../canonicalize/canonical-json.js';
import type { VokeSnapshot } from './types.js';

/**
 * Serializes a VokeSnapshot to disk.
 *
 * The output uses canonicalJson (sorted keys) on the entire snapshot object
 * to ensure byte-identical re-writes of the same surface.
 * meta.capturedAt is preserved as written (D-02 provenance).
 *
 * @param path - destination file path (will overwrite if exists)
 * @param snapshot - the VokeSnapshot to write
 */
export const writeSnapshot = (path: string, snapshot: VokeSnapshot): void => {
  // canonicalJson ensures sorted object keys → byte-identical for same surface (D-12)
  const serialized = canonicalJson(snapshot as unknown);
  writeFileSync(path, serialized, 'utf8');
};
