/**
 * Extensible target resolver for the voke CLI (D-04 / D-05 / D-06).
 *
 * Dispatches a target string to a transport kind (live | file) via a SCHEME_HANDLERS
 * registry. This is the extension seam: Phase 5 stdio support adds an 'stdio:' entry
 * here without requiring a resolver rewrite (D-05 extensibility guarantee).
 *
 * D-06: schemeless host:port strings (e.g. "localhost:3000/mcp") are REJECTED with
 * a did-you-mean hint rather than silently treated as file paths.
 *
 * Exit codes:
 *   UsageError.exitCode = 3 (D-13: usage / argument error)
 */

/** The kind of transport to use for the resolved target. */
export type TransportKind = 'live' | 'file' | 'stdio';

/** Resolved target with its transport kind. */
export interface ResolvedTarget {
  kind: TransportKind;
  target: string;
  /** Only present when kind === 'stdio'. Contains the command + args for StdioClientTransport. */
  stdioArgs?: string[];
}

/**
 * Thrown when the target string is malformed (bad scheme, schemeless host:port, etc.).
 * Exit code 3 per D-13 (usage / argument error).
 *
 * Kept in this file for Phase 4 Wave 1 to avoid editing errors.ts in a parallel wave.
 * Plan 02 may re-home this to errors.ts if a shared UsageError is needed.
 */
export class UsageError extends Error {
  readonly exitCode = 3;

  constructor(msg: string) {
    super(msg);
    this.name = 'UsageError';
  }
}

/**
 * Extension seam: maps URL scheme (with trailing colon, no slashes) to a transport
 * factory. To add stdio support in Phase 5: add `'stdio:': r => ({kind:'stdio',target:r})`.
 *
 * Only http and https are supported in L1 (live server linting).
 */
const SCHEME_HANDLERS: Record<string, (raw: string) => ResolvedTarget> = {
  'http:': (raw: string) => ({ kind: 'live', target: raw }),
  'https:': (raw: string) => ({ kind: 'live', target: raw }),
};

/** Matches a leading URL scheme followed by "://". Group 1 = scheme with colon. */
const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//;

/**
 * Matches a schemeless host:port string (D-06).
 * Catches patterns like: "localhost:3000/mcp", "example.com:8080/"
 * These must be rejected — silently treating them as file paths would be wrong.
 */
const SCHEMELESS_HOST_PORT_PATTERN = /^[^/\s]+:\d+(\/|$)/;

/**
 * Resolves a target string to a transport kind and canonical target.
 *
 * Dispatch order:
 * 1. URL with scheme ("https://...") → look up in SCHEME_HANDLERS
 *    - Known scheme: dispatch to handler (live for http/https)
 *    - Unknown scheme: throw UsageError listing supported schemes
 * 2. Schemeless host:port pattern ("localhost:3000/mcp") → throw UsageError with did-you-mean
 * 3. Everything else → treat as a local file path
 *
 * @param raw - the target string provided by the user
 * @returns ResolvedTarget with kind and canonical target string
 * @throws UsageError (exitCode=3) for invalid/unsupported targets
 */
export const resolveTarget = (raw: string): ResolvedTarget => {
  // Step 1: check for a URL scheme
  const schemeMatch = SCHEME_PATTERN.exec(raw);
  if (schemeMatch !== null) {
    const scheme = schemeMatch[1].toLowerCase() + ':';
    const handler = SCHEME_HANDLERS[scheme];
    if (handler !== undefined) {
      return handler(raw);
    }
    const supported = Object.keys(SCHEME_HANDLERS).join(', ');
    throw new UsageError(
      `Unsupported scheme '${scheme}'. Supported: ${supported}, or a local snapshot file path.`,
    );
  }

  // Step 2: reject schemeless host:port (D-06 — must not silently become a file path)
  if (SCHEMELESS_HOST_PORT_PATTERN.test(raw)) {
    throw new UsageError(
      `Missing URL scheme: '${raw}'. Did you mean http://${raw}?`,
    );
  }

  // Step 3: treat as a local file path
  return { kind: 'file', target: raw };
};
