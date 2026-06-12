export { canonicalJson } from './canonicalize/canonical-json.js';
export { sha256, toolContentHash, surfaceContentHash } from './canonicalize/hash.js';
export { ingestLive, maskHeaders } from './ingestion/mcp-client.js';
export type { IngestLiveOptions } from './ingestion/mcp-client.js';
export type { ToolSnapshot, VokeSnapshot, ServerIdentity } from './ingestion/types.js';
export { readSnapshot } from './ingestion/snapshot-reader.js';
export { writeSnapshot } from './ingestion/snapshot-writer.js';

// Engine types (engine/types.ts)
export type {
  RuleTarget,
  FindingLocation,
  Finding,
  RuleContext,
  RuleFunction,
  RuleDefinition,
} from './engine/types.js';

// Config type stub (config/types.ts)
export type { VokeConfig } from './config/types.js';

// Engine registry (engine/registry.ts)
export { RuleRegistry, createDefaultRegistry } from './engine/registry.js';

// Engine runner (engine/runner.ts)
export { runRules, RuleExecutionError } from './engine/runner.js';

// Report types (report/types.ts)
export type { LintReport, ToolReport, Tier } from './report/types.js';

// Report builder (report/builder.ts)
export { buildReport, serializeReportBody } from './report/builder.js';
