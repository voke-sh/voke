import { scoreTool, applyCaps, tierFor, serverScore as coreServerScore } from '@voke/core';
import type { Finding as CoreFinding } from '@voke/core';
import type { VokeSnapshot } from '../ingestion/types.js';
import type { Finding } from '../engine/types.js';
import { canonicalJson } from '../canonicalize/canonical-json.js';
import { surfaceContentHash } from '../canonicalize/hash.js';
import type { LintReport, Tier, ToolReport } from './types.js';

/**
 * buildReport — assembles a LintReport from a VokeSnapshot + engine findings.
 *
 * Scoring is entirely delegated to @voke/core (scoreTool, applyCaps, tierFor, serverScore).
 * No scoring arithmetic is reimplemented here.
 *
 * Determinism guarantees:
 * 1. snapshot.tools assumed already sorted ascending by toolId (ingestion guarantees this)
 * 2. findings grouped by location.tool; CoreFinding map strips location/message/fixHint
 * 3. snapshotContentHash = surfaceContentHash(snapshot.tools) — surface hash, sort-stable
 * 4. serverScore = coreServerScore(toolScores) — mean of toolId-sorted scores
 * 5. meta.generatedAt = new Date().toISOString() — the ONLY wall-clock call (D-02)
 *
 * @param snapshot - the VokeSnapshot (tools already sorted ascending by toolId)
 * @param findings - all runtime findings from runRules (sorted toolId→ruleId→path)
 * @param opts - optional vokeVersion override (defaults to '0.0.0')
 */
export const buildReport = (
  snapshot: VokeSnapshot,
  findings: Finding[],
  opts?: { vokeVersion?: string },
): LintReport => {
  // Group runtime findings by location.tool (toolId)
  const findingsByToolId = new Map<string, Finding[]>();
  for (const finding of findings) {
    const toolId = finding.location.tool;
    if (!findingsByToolId.has(toolId)) {
      findingsByToolId.set(toolId, []);
    }
    findingsByToolId.get(toolId)!.push(finding);
  }

  // Build per-tool reports — snapshot.tools already sorted by toolId (D-03)
  const toolReports: ToolReport[] = snapshot.tools.map(tool => {
    const toolFindings = findingsByToolId.get(tool.toolId) ?? [];

    // Map runtime findings to CoreFinding shape for @voke/core scoring
    // (strip location, message, fixHint — scoring only needs ruleId, severity, dimension)
    const coreFindings: CoreFinding[] = toolFindings.map(f => ({
      ruleId: f.ruleId,
      severity: f.severity,
      dimension: f.dimension,
    }));

    const raw = scoreTool(coreFindings);
    const ruleIds = toolFindings.map(f => f.ruleId);
    const score = applyCaps(raw, ruleIds);
    const tier: Tier = tierFor(score);

    return {
      toolId: tool.toolId,
      contentHash: tool.contentHash,
      findings: toolFindings,
      score,
      tier,
    };
  });

  // Server-level aggregate: mean of per-tool scores (toolId-sorted — determinism #3)
  const toolScores = toolReports.map(t => t.score);
  const computedServerScore = coreServerScore(toolScores);
  const serverTier: Tier = tierFor(computedServerScore);

  return {
    vokeVersion: opts?.vokeVersion ?? '0.0.0',
    mtqsVersion: snapshot.mtqsVersion,
    // D-02: generatedAt lives in meta — excluded from serializeReportBody
    meta: {
      generatedAt: new Date().toISOString(),
    },
    server: snapshot.server,
    snapshotContentHash: surfaceContentHash(snapshot.tools),
    tools: toolReports,
    serverScore: computedServerScore,
    serverTier,
  };
};

/**
 * serializeReportBody — produces the canonical, meta-stripped string that the
 * byte-identical determinism test (ENG-04 / D-12) compares.
 *
 * D-02: strips `meta` (which contains generatedAt, the only wall-clock value)
 * before serializing. The compared body is deterministic because it contains no
 * wall-clock or provenance data.
 *
 * Uses canonicalJson for sorted-key, locale-stable serialization (Pitfall 1/2 guard).
 */
export const serializeReportBody = (report: LintReport): string => {
  // Destructure meta out — it contains generatedAt (the wall-clock) which must be
  // excluded from the determinism proof body (D-02/D-12)
  const { meta, ...body } = report;
  // Suppress unused variable warning — meta is intentionally excluded
  void meta;
  return canonicalJson(body);
};
