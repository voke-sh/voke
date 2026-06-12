/**
 * JSON output formatter for voke lint (OUT-02 / D-10).
 *
 * formatJson produces the full LintReport serialized via canonicalJson.
 *
 * D-10: the full LintReport (including meta.generatedAt) is the consumption doc —
 * callers (e.g. CI scripts, dashboards) need the wall-clock timestamp for provenance.
 * The byte-identical determinism PROOF uses serializeReportBody (meta-stripped) — that
 * comparison lives in the e2e determinism test (Plan 03), not here.
 *
 * canonicalJson gives sorted-key stability so repeated formatJson on one report is
 * identical (same generatedAt → same output; different reports → different output only
 * where data actually differs).
 */
import { canonicalJson } from '../canonicalize/canonical-json.js';
import type { LintReport } from '../report/types.js';

/**
 * Serialize a LintReport to a canonical JSON string.
 *
 * The full report including meta.generatedAt is included (D-10: full consumption doc).
 * Keys are sorted for stability — repeated calls on the same object yield identical output.
 *
 * @param report - the LintReport to serialize
 * @returns a canonical JSON string representing the full report
 */
export const formatJson = (report: LintReport): string => canonicalJson(report);
