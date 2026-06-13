/**
 * Voke typed exit-coded errors for the ingestion layer.
 *
 * Exit codes per failure class (RESEARCH.md Pattern 12):
 *   2 = connect failure (StreamableHTTP + SSE both failed)
 *   3 = auth failure / 401
 *   4 = partial pagination (a page failed; ingest aborted per D-10)
 *   5 = rule execution threw (RuleExecutionError — belongs to engine, Plan 03)
 *   6 = depth exceeded (inputSchema exceeded hard safety cap, D-04)
 *   7 = config parse error (ConfigError — belongs to config, Plan 03)
 *   8 = stdio subprocess launch failure
 *   9 = stdio teardown failure
 *
 * These are distinct exit codes so CI scripts can distinguish "server unreachable"
 * from "score too low" from "linter bug" — directly actionable.
 */

/** Base error class for all Voke errors. Carries a numeric exitCode for process exit. */
export class VokeError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = 'VokeError';
  }
}

/**
 * Thrown when both StreamableHTTPClientTransport and SSEClientTransport fail to connect.
 * Exit code 2. D-08: fail fast, no retry.
 */
export class ConnectError extends VokeError {
  constructor(url: string, cause: unknown) {
    super(
      `Failed to connect to ${url}: ${String(cause)}. ` +
        `Check the server URL is reachable and the server is running.`,
      2,
    );
    this.name = 'ConnectError';
  }
}

/**
 * Thrown when the server returns 401 Unauthorized after a successful connect.
 * Exit code 3. Use --header 'Authorization: Bearer <token>' to authenticate.
 */
export class AuthError extends VokeError {
  constructor(url: string, cause: unknown) {
    super(
      `Authentication failed for ${url}: ${String(cause)}. ` +
        `Provide a valid token via --header 'Authorization: Bearer <token>'.`,
      3,
    );
    this.name = 'AuthError';
  }
}

/**
 * Thrown when any tools/list pagination page fails.
 * Exit code 4. D-10: abort whole ingest — never score incomplete data.
 */
export class PartialPageError extends VokeError {
  constructor(cause: unknown) {
    super(
      `tools/list page failed: ${String(cause)}. ` +
        `Ingest aborted — partial surfaces produce incorrect scores.`,
      4,
    );
    this.name = 'PartialPageError';
  }
}

/**
 * Thrown when a tool's inputSchema exceeds the hard safety cap (DEPTH_HARD_CAP = 32).
 * Exit code 6. D-04: reject at ingestion — prevents OOM/hang on pathological schemas.
 */
export class DepthExceededError extends VokeError {
  constructor(toolName: string, depth: number, cap: number) {
    super(
      `Tool '${toolName}' inputSchema exceeds the hard depth cap: ` +
        `depth ${depth} > ${cap}. ` +
        `Simplify the schema or split nested definitions into separate $defs.`,
      6,
    );
    this.name = 'DepthExceededError';
  }
}

/**
 * Thrown when the stdio subprocess fails to launch (e.g. command not found).
 * Exit code 8. Check the command exists and is executable.
 */
export class StdioLaunchError extends VokeError {
  constructor(command: string, cause: unknown) {
    super(
      `Failed to launch stdio server '${command}': ${String(cause)}. ` +
        `Check the command exists and is executable.`,
      8,
    );
    this.name = 'StdioLaunchError';
  }
}

/**
 * Thrown when the stdio subprocess fails to tear down cleanly after ingestion.
 * Exit code 9. The subprocess may have already exited or is unresponsive.
 */
export class StdioTeardownError extends VokeError {
  constructor(command: string, cause: unknown) {
    super(
      `Failed to cleanly stop stdio server '${command}': ${String(cause)}.`,
      9,
    );
    this.name = 'StdioTeardownError';
  }
}
