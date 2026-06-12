import type { Severity } from '@voke/core';

/**
 * VokeConfig — the resolved configuration object passed into every RuleContext.
 *
 * Full Zod loader + ConfigError (exit 7) are deferred to Phase 4.
 * Phase 2 only needs the type so RuleContext.config typechecks.
 */
export interface VokeConfig {
  severityOverrides?: Record<string, Severity>;
  minScore?: number;
}
