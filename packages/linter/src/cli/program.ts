/**
 * Commander v15 program definition for the voke CLI (CLI-01/02/03, D-07/08/13/15/16).
 *
 * Exports:
 * - buildProgram(): builds a fresh Command instance (used by bin entrypoint and tests)
 * - resolveLintOpts(): pure flag-resolution helper (unit-testable; no network, no IO)
 *
 * Design:
 * - Flag resolution and validation is isolated in resolveLintOpts so program.test.ts
 *   can test color-disabling, NO_COLOR, and invalid-flag rejection without invoking runLint.
 * - The lint action handler calls resolveLintOpts then runLint and then sets process.exitCode.
 *   It does NOT call process.exit on success — the bin entrypoint's main().catch handles errors.
 *
 * Token masking (D-15/16):
 * - maskHeaders is called in any echoed diagnostic line that would include header values.
 * - Raw header values must NEVER appear in stderr (injected via buildHeaders/maskHeaders).
 */
import { Command } from 'commander';
import { versionString } from '../version.js';
import { runLint } from './run-lint.js';
import { UsageError } from './resolve-target.js';
import { maskHeaders, buildHeaders } from '../ingestion/mcp-client.js';
import type { RunLintOpts } from './run-lint.js';

// ---------------------------------------------------------------------------
// resolveLintOpts — pure flag-resolution + validation (D-07, D-15/16)
// ---------------------------------------------------------------------------

/**
 * Resolves and validates the raw commander-parsed options into a RunLintOpts object.
 *
 * Validates:
 * - --output must be 'human' or 'json' (throws UsageError on unknown format)
 * - --min-score must be an integer 0-100 (throws UsageError if out of range)
 * - --timeout must be a positive integer (throws UsageError if invalid)
 * - color: disabled if --ci, NO_COLOR env var, or --no-color flag is set (D-03/D-16)
 *
 * This function has no side effects and performs no IO. It is the unit-testable
 * boundary between commander's parsed options and the runLint pipeline.
 *
 * @param target - the positional <target> argument
 * @param opts - the raw commander option object (typed loosely for test flexibility)
 * @returns validated RunLintOpts ready for runLint
 * @throws UsageError (exitCode=3) on invalid flag values
 */
export const resolveLintOpts = (
  target: string,
  opts: Record<string, unknown>,
): RunLintOpts => {
  // Validate --output
  const output = opts['output'] as string | undefined;
  if (output !== 'human' && output !== 'json') {
    throw new UsageError(`--output must be 'human' or 'json', got: '${output ?? ''}'`);
  }

  // Validate --timeout: must be a positive integer
  const rawTimeout = opts['timeout'] as string | undefined;
  const timeout = parseInt(rawTimeout ?? '30000', 10);
  if (isNaN(timeout) || timeout <= 0) {
    throw new UsageError(`--timeout must be a positive integer in milliseconds, got: '${rawTimeout ?? ''}'`);
  }

  // Validate --min-score: if present, must be integer 0-100
  let minScore: number | undefined;
  const rawMinScore = opts['minScore'] as string | undefined;
  if (rawMinScore !== undefined) {
    const parsed = parseInt(rawMinScore, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      throw new UsageError(`--min-score must be an integer between 0 and 100, got: '${rawMinScore}'`);
    }
    minScore = parsed;
  }

  // Resolve color: disabled if --ci flag, NO_COLOR env var (non-empty), or --no-color
  // D-03: deterministic plain-text output in CI; NO_COLOR is the POSIX standard
  const ciFlag = Boolean(opts['ci']);
  const noColorFlag = opts['color'] === false; // commander's --no-color sets opts.color=false
  const noColorEnv = Boolean(process.env['NO_COLOR'] && process.env['NO_COLOR'].length > 0);
  const color = !ciFlag && !noColorFlag && !noColorEnv;

  // Headers: commander variadic option; default to []
  const headers = (opts['header'] as string[] | undefined) ?? [];

  return {
    target,
    output,
    headers,
    timeout,
    minScore,
    verbose: Boolean(opts['verbose']),
    color,
    saveSnapshot: opts['saveSnapshot'] as string | undefined,
  };
};

// ---------------------------------------------------------------------------
// buildProgram — factory for the commander program instance
// ---------------------------------------------------------------------------

/**
 * Build a fresh commander v15 Command instance for the voke CLI.
 *
 * Always returns a NEW instance (test isolation — no module-level singleton).
 *
 * The program is structured as:
 *   voke [options]
 *     --version / -v: print "voke X.Y.Z (MTQS v0.1)" (D-08)
 *   voke lint <target> [flags...]
 *     D-07 flags: --output, -H/--header, --timeout, --min-score, --ci, --no-color, --save-snapshot, --verbose
 */
export const buildProgram = (): Command => {
  const program = new Command();

  program
    .name('voke')
    .description('Deterministic MCP tool quality linter (MTQS v0.1)')
    .version(versionString(), '-v, --version', 'Print voke version and MTQS version');

  program
    .command('lint')
    .description('Lint an MCP server (live URL or saved snapshot file)')
    .argument('<target>', 'MCP server URL (http/https) or path to a saved snapshot JSON file')
    .option('--output <format>', 'output format: human | json', 'human')
    .option('-H, --header <header...>', 'HTTP header "Key: Value" (repeatable); used for bearer auth', [])
    .option('--timeout <ms>', 'per-request timeout in milliseconds', '30000')
    .option('--min-score <n>', 'fail (exit 1) if server score is below this threshold (0-100)')
    .option('--ci', 'CI mode: disable color (deterministic plain-text output)', false)
    .option('--no-color', 'disable color output')
    .option('--save-snapshot <path>', 'also write the raw VokeSnapshot (re-lint input) to this path')
    .option('--verbose', 'print full per-finding detail under each failing tool', false)
    .action(async (target: string, opts: Record<string, unknown>) => {
      // Resolve and validate options (throws UsageError on invalid flags)
      const runLintOpts = resolveLintOpts(target, opts);

      // Diagnostic: if headers are provided, only echo masked values (D-15/16)
      // (No actual echo in the happy path — this is a hook for future --verbose diagnostic)

      // Run the full pipeline
      const result = await runLint(runLintOpts);

      // Print output to stdout
      process.stdout.write(result.text + '\n');

      // Set process.exitCode (does not hard-exit; main().catch handles errors)
      process.exitCode = result.exitCode;
    });

  return program;
};

// ---------------------------------------------------------------------------
// maskHeaders re-export for easy test access (D-15/16)
// ---------------------------------------------------------------------------
export { maskHeaders, buildHeaders };
