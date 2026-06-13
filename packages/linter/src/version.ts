/**
 * Version source-of-truth for Voke and MTQS (SCORE-02 / D-08).
 *
 * VOKE_VERSION: the current linter package version (hardcoded; build-time injection
 * from package.json is out of scope for Phase 4 — a plain const keeps the value
 * deterministic and import-cheap).
 *
 * MTQS_VERSION: the MTQS spec version this linter implements (matches spec/mtqs-v0.1.yaml
 * and the existing snapshot mtqsVersion field).
 *
 * versionString(): returns the canonical CLI --version string.
 */

/** The current linter package version. Update when package.json version changes. */
export const VOKE_VERSION = '0.1.0';

/** The MTQS spec version implemented by this linter. */
export const MTQS_VERSION = '0.1';

/**
 * Returns the canonical version string used by the CLI --version flag.
 * Format: "voke {VOKE_VERSION} (MTQS v{MTQS_VERSION})"
 * Example: "voke 0.0.0 (MTQS v0.1)"
 */
export const versionString = (): string => `voke ${VOKE_VERSION} (MTQS v${MTQS_VERSION})`;
