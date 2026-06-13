#!/usr/bin/env node
/**
 * Voke CLI bin entrypoint (D-09).
 *
 * This is the executable entry point compiled by tsup to dist/cli/index.js.
 * The shebang on line 1 makes the built file directly executable without node prefix.
 *
 * D-13 exit-code map implemented in the catch handler:
 *   VokeError (ConnectError=2, PartialPageError=4, DepthExceededError=6, AuthError=3) -> err.exitCode
 *   UsageError -> 3
 *   anything else -> 70 (unexpected internal error)
 *
 * process.exitCode is set by runLint (exit 0/1 for score gate).
 * Hard process.exit is only called here on error.
 */
import { buildProgram } from './program.js';
import { VokeError } from '../errors.js';
import { UsageError } from './resolve-target.js';

const main = async (): Promise<void> => {
  // Pre-split process.argv at '--' (ING-06: stdio passthrough).
  // This must happen BEFORE commander parses so that -- and everything after it
  // is removed from argv (commander doesn't understand our use of --).
  // Reference: RESEARCH Open Question 4 — pre-split is simpler than passThroughOptions.
  const dashIdx = process.argv.indexOf('--');
  const stdioArgs = dashIdx !== -1 ? process.argv.slice(dashIdx + 1) : undefined;
  const cleanArgv = dashIdx !== -1 ? process.argv.slice(0, dashIdx) : process.argv;

  await buildProgram(stdioArgs).parseAsync(cleanArgv);
};

main().catch((err: unknown) => {
  // D-13 exit-code mapping
  let code: number;
  if (err instanceof VokeError) {
    code = err.exitCode;
  } else if (err instanceof UsageError) {
    code = 3;
  } else {
    code = 70;
  }

  // Print error message to stderr (token masking: maskHeaders is applied in resolveLintOpts
  // before any echoed line; errors from ingestion already exclude raw header values per D-09)
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(code);
});
