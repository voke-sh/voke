import type { ServerIdentity } from '../ingestion/types.js';
import type { Finding } from '../engine/types.js';

/**
 * Tier — A-F quality tier assigned to a tool or server score.
 * Cuts: A>=90, B>=80, C>=70, D>=60, F<60 (from @voke/core tierFor).
 */
export type Tier = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * ToolReport — scored result for a single tool in a LintReport.
 *
 * contentHash: from the ToolSnapshot (ING-04 / D-03) — enables L2 delta detection.
 * findings: the runtime findings for this tool (includes message, location, fixHint).
 * score: capped integer score (0-100) using @voke/core applyCaps.
 * tier: A-F from @voke/core tierFor.
 */
export interface ToolReport {
  toolId: string;
  contentHash: string;
  findings: Finding[];
  score: number;
  tier: Tier;
}

/**
 * LintReport — the top-level scored artifact produced by buildReport.
 *
 * D-01: LintReport is a separate artifact from VokeSnapshot. The raw surface
 * (VokeSnapshot) stays independent of rule/score changes; this is the scored output.
 *
 * D-02: meta.generatedAt is wall-clock provenance — excluded from serializeReportBody
 * and the byte-identical determinism test. The canonical hashed/compared body covers
 * only server identity, snapshotContentHash, tool scores, and server aggregate.
 */
export interface LintReport {
  vokeVersion: string;
  mtqsVersion: string;
  /** D-02: provenance block excluded from serializeReportBody / determinism test */
  meta: {
    generatedAt: string; // ISO-8601 UTC — the ONLY wall-clock value in the report
  };
  server: ServerIdentity;
  /** SHA-256 of canonical sorted tools surface (surfaceContentHash) */
  snapshotContentHash: string;
  tools: ToolReport[];
  serverScore: number;
  serverTier: Tier;
}
