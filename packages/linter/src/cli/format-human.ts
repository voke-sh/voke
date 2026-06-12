/**
 * Human-readable output formatter for voke lint (OUT-01 / D-01 / D-02 / D-03).
 *
 * formatHuman produces a plain-text report suitable for terminal output. Key constraints:
 *
 * D-01: Server score+tier banner; per-dimension weight breakdown (fixed order); table of
 *       below-A tools sorted by score ascending (tier-A tools are omitted as they pass).
 * D-02: verbose mode adds per-finding details (ruleId, path, message, fixHint).
 * D-03: the score line is NEVER colorized — it must be machine-parseable under any terminal.
 *       ANSI codes are conditional on opts.color and are NEVER applied to the score line.
 *
 * Determinism: no Date, no Math.random(), no sorting by keys. The dimension order is
 * fixed (not Object.keys-derived) so the breakdown is reproducible across JS engines.
 */
import chalk from 'chalk';
import { MULT } from '@voke/core';
import type { LintReport } from '../report/types.js';
import type { Finding } from '../engine/types.js';

/** Options controlling human output rendering. */
export interface HumanFormatOpts {
  /** Whether to emit ANSI color codes for severity labels. The score line is NEVER colored. */
  color: boolean;
  /** Whether to print per-finding detail lines under each below-A tool. */
  verbose: boolean;
}

// Fixed dimension order — deterministic; do NOT use Object.keys(MULT)
const DIMENSION_ORDER = ['schema', 'annotations', 'description', 'parameters', 'naming'] as const;
type DimKey = (typeof DIMENSION_ORDER)[number];

/** Pad a string to a minimum width. */
const pad = (s: string, width: number): string => s.padEnd(width);

/** Colorize a severity label when color is enabled. Score line is never passed here. */
const colorSeverity = (severity: Finding['severity'], color: boolean): string => {
  if (!color) return severity;
  switch (severity) {
    case 'error':
      return chalk.red(severity);
    case 'warning':
      return chalk.yellow(severity);
    case 'info':
      return chalk.blue(severity);
    case 'hint':
      return chalk.gray(severity);
    default:
      return severity;
  }
};

/**
 * Format a LintReport as a human-readable string.
 *
 * The output is a newline-joined string of lines:
 *   1. Score banner (never colored, D-03)
 *   2. Dimension weight breakdown (fixed order, D-01)
 *   3. Table of below-A tools sorted by score ascending (D-01)
 *   4. [verbose] Per-finding detail lines for each below-A tool (D-02)
 *
 * @param report - the LintReport to format
 * @param opts - rendering options (color, verbose)
 * @returns a newline-joined string; never empty
 */
export const formatHuman = (report: LintReport, opts: HumanFormatOpts): string => {
  const lines: string[] = [];

  // --- 1. Score banner (D-03: never colorized) --------------------------------
  lines.push(`Server score: ${report.serverScore}/100  Tier ${report.serverTier}`);
  lines.push('');

  // --- 2. Dimension weight breakdown (D-01, fixed order) ----------------------
  lines.push('Dimension weights:');
  for (const dim of DIMENSION_ORDER) {
    const weight = (MULT as Record<DimKey, number>)[dim];
    // Always format to one decimal place for consistent output (1.0x, 1.2x, 1.5x)
    const weightStr = weight.toFixed(1);
    lines.push(`  ${pad(dim, 12)}  ${weightStr}x`);
  }
  lines.push('');

  // --- 3. Below-A tool table (D-01) -------------------------------------------
  const belowA = report.tools
    .filter(t => t.tier !== 'A')
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.toolId.localeCompare(b.toolId, 'en', { sensitivity: 'variant' }),
    );

  if (belowA.length === 0) {
    lines.push('All tools pass (tier A). No issues found.');
    return lines.join('\n');
  }

  // Column header
  lines.push(
    `${pad('Tool', 32)}  ${pad('Score', 6)}  ${pad('Tier', 5)}  Findings`,
  );
  lines.push('-'.repeat(64));

  for (const tool of belowA) {
    const findingCount = tool.findings.length;
    lines.push(
      `${pad(tool.toolId, 32)}  ${pad(String(tool.score), 6)}  ${pad(tool.tier, 5)}  ${findingCount}`,
    );

    // --- 4. Verbose finding detail (D-02) -------------------------------------
    if (opts.verbose) {
      for (const finding of tool.findings) {
        const severityLabel = colorSeverity(finding.severity, opts.color);
        const path =
          finding.location.path.length > 0
            ? finding.location.path.join('.')
            : '(root)';
        lines.push(`    ${severityLabel} ${finding.ruleId} at ${path}: ${finding.message} -> ${finding.fixHint}`);
      }
    }
  }

  return lines.join('\n');
};
