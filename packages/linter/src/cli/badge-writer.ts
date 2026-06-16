import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { UsageError } from './resolve-target.js';
import { formatBadge } from './badge.js';
import type { LintReport } from '../report/types.js';

/**
 * Write a deterministic MTQS score badge SVG to `path` (side output, D-08/09/10).
 * Creates missing parent directories (mkdir -p). Overwrites silently.
 * On any write failure throws UsageError (-> exit 3) naming the path; the caller
 * invokes this AFTER stdout is written so the lint result is never masked (D-10).
 */
export const writeBadge = (path: string, report: LintReport): void => {
  const svg = formatBadge(report);
  try {
    mkdirSync(dirname(path), { recursive: true }); // dirname('badge.svg') === '.' is a safe no-op
    writeFileSync(path, svg, 'utf8');
  } catch (err) {
    throw new UsageError(
      `Failed to write badge to '${path}': ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};
