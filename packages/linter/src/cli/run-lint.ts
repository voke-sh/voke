/**
 * runLint orchestrator — the full CLI pipeline (CLI-01, CLI-03, SCORE-01).
 *
 * Pipeline:
 *   resolveTarget → ingest (live | file) → runRules(createDefaultRegistry())
 *   → buildReport → format → { report, text, exitCode }
 *
 * Responsibilities:
 * - resolveTarget: dispatches to ingestLive (http/https) or readSnapshot (file)
 * - timeoutMs: threaded from opts.timeout into ingestLive (W1 — not dropped)
 * - saveSnapshot: optionally writes a raw VokeSnapshot (distinct from LintReport, D-11/D-12)
 * - exit code: D-13 min-score gate (exitCode=1 only; ingestion errors propagate as thrown errors)
 *
 * This function does NOT call process.exit or console.log — it is unit-testable.
 * The CLI program layer (program.ts / cli/index.ts) handles printing and process exit.
 */
import { resolveTarget } from './resolve-target.js';
import { ingestLive } from '../ingestion/mcp-client.js';
import { ingestStdio } from '../ingestion/stdio-client.js';
import { readSnapshot } from '../ingestion/snapshot-reader.js';
import { writeSnapshot } from '../ingestion/snapshot-writer.js';
import { createDefaultRegistry } from '../engine/registry.js';
import { runRules } from '../engine/runner.js';
import { buildReport } from '../report/builder.js';
import { formatHuman } from './format-human.js';
import { formatJson } from './format-json.js';
import { VOKE_VERSION } from '../version.js';
import type { LintReport } from '../report/types.js';

/**
 * Options for a single lint run.
 */
export interface RunLintOpts {
  /** MCP server URL (http/https) or path to a saved snapshot JSON file. */
  target: string;
  /** Output format: 'human' for terminal display; 'json' for parseable LintReport. */
  output: 'human' | 'json';
  /** Raw header strings "Key: Value" passed to ingestLive (ignored for file targets). */
  headers: string[];
  /** Per-request timeout in ms for live targets (threaded to ingestLive.timeoutMs). */
  timeout: number;
  /** If set: exit 1 when serverScore < minScore; exit 0 otherwise (D-13). */
  minScore?: number;
  /** Print per-finding detail lines under each below-A tool. */
  verbose: boolean;
  /** Enable ANSI color codes in human output. Score line is never colored (D-03). */
  color: boolean;
  /** If set: also write the raw VokeSnapshot to this path (D-11 — distinct from LintReport). */
  saveSnapshot?: string;
  /**
   * If set and non-empty: launch an MCP subprocess via StdioClientTransport instead of
   * resolveTarget. stdioArgs[0] is the command; the rest are args. Bypasses resolveTarget.
   */
  stdioArgs?: string[];
  /**
   * Extra environment variables for the stdio subprocess (from --env KEY=VAL).
   * Values are NEVER echoed in output (D-09/Pitfall 4).
   */
  extraEnv?: Record<string, string>;
  /** If set: write a deterministic SVG score badge to this path AFTER stdout (D-06/08/10). */
  badgePath?: string;
}

/**
 * Result from a lint run.
 */
export interface RunLintResult {
  /** The assembled LintReport with per-tool + server scores. */
  report: LintReport;
  /** Formatted output string (human or JSON depending on opts.output). */
  text: string;
  /** Process exit code: 0 = pass; 1 = minScore not met; errors throw (not exit code here). */
  exitCode: number;
}

/**
 * Run the full lint pipeline for a target.
 *
 * For file targets: readSnapshot (sync, no network).
 * For live targets: ingestLive with opts.timeout threaded as timeoutMs.
 *
 * If opts.saveSnapshot is set, writes the raw VokeSnapshot to that path before linting.
 * The VokeSnapshot is the re-lint input artifact (has snapshotVersion, tools[].toolId,
 * meta.capturedAt) — it does NOT contain serverScore or per-tool scores (D-11).
 *
 * @throws UsageError (exitCode=3) — bad target string
 * @throws ConnectError (exitCode=2) — both transports failed
 * @throws PartialPageError (exitCode=4) — pagination page failed
 * @throws DepthExceededError (exitCode=6) — schema too deep
 * @throws RuleExecutionError — rule fn threw (internal error)
 */
export const runLint = async (opts: RunLintOpts): Promise<RunLintResult> => {
  let snapshot;

  if (opts.stdioArgs !== undefined && opts.stdioArgs.length > 0) {
    // Stdio path: bypass resolveTarget — launch subprocess directly
    snapshot = await ingestStdio({
      command: opts.stdioArgs[0],
      args: opts.stdioArgs.slice(1),
      extraEnv: opts.extraEnv,
      timeoutMs: opts.timeout,
    });
  } else {
    // 1. Resolve target (throws UsageError on bad target — propagates to program catch)
    const resolved = resolveTarget(opts.target);

    // 2. Ingest: live or file
    //    Live: timeout threaded as timeoutMs (W1 — opts.timeout is never dropped)
    //    File: readSnapshot is synchronous and makes no network calls
    snapshot =
      resolved.kind === 'live'
        ? await ingestLive({
            url: resolved.target,
            rawHeaders: opts.headers,
            timeoutMs: opts.timeout,
          })
        : readSnapshot(resolved.target);
  }

  // 3. Optionally write raw VokeSnapshot (D-11 — distinct artifact from LintReport)
  //    VokeSnapshot has: snapshotVersion, mtqsVersion, server, meta.capturedAt, tools[]
  //    It does NOT have: serverScore, per-tool scores, findings (those live in LintReport)
  if (opts.saveSnapshot !== undefined) {
    writeSnapshot(opts.saveSnapshot, snapshot);
  }

  // 4. Run rules with the default registry (all 22 MTQS v0.1 rules)
  const registry = createDefaultRegistry();
  const findings = runRules(snapshot.tools, registry, {});

  // 5. Build report (vokeVersion threaded for SCORE-02 / D-08 version surfacing)
  const report = buildReport(snapshot, findings, { vokeVersion: VOKE_VERSION });

  // 6. Format output
  const text =
    opts.output === 'json'
      ? formatJson(report)
      : formatHuman(report, { color: opts.color, verbose: opts.verbose });

  // 7. Compute exit code (D-13 min-score gate)
  //    Only exits 1 when minScore is explicitly set AND not met.
  //    Findings alone (even all errors) never set exit 1 — minScore is the CI gate.
  const exitCode =
    opts.minScore !== undefined && report.serverScore < opts.minScore ? 1 : 0;

  return { report, text, exitCode };
};
