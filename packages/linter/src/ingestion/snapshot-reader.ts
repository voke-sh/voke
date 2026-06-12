/**
 * Offline snapshot reader (ING-03).
 *
 * Reads a VokeSnapshot JSON file from disk and validates it with Zod.
 * Makes ZERO network calls — no SDK import, no fetch, no HTTP.
 * This guarantees ING-03: offline lint mode reaches the same surface as live mode.
 *
 * Zod schema mirrors the VokeSnapshot TS interface (types.ts).
 * Validation on read catches corrupt/partial snapshot files early with clear messages.
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { VokeSnapshot } from './types.js';

// ---------------------------------------------------------------------------
// Zod schemas mirroring the VokeSnapshot TS interfaces
// ---------------------------------------------------------------------------

const ServerIdentitySchema = z.object({
  url: z.string().nullable(),
  name: z.string(),
  version: z.string(),
  protocolVersion: z.string(),
});

const ToolSnapshotSchema = z.object({
  toolId: z.string().min(1),
  contentHash: z.string().min(1),
  name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  annotations: z.record(z.string(), z.unknown()).optional(),
});

const VokeSnapshotSchema = z.object({
  snapshotVersion: z.literal('1'),
  mtqsVersion: z.string(),
  server: ServerIdentitySchema,
  meta: z.object({
    capturedAt: z.string(),
  }),
  tools: z.array(ToolSnapshotSchema),
});

// ---------------------------------------------------------------------------
// readSnapshot — synchronous, node:fs only, NO network, NO SDK import
// ---------------------------------------------------------------------------

/**
 * Reads a VokeSnapshot JSON file from disk.
 * Validates the parsed JSON against VokeSnapshotSchema (Zod).
 * Throws a ZodError with a clear message if the file is malformed.
 *
 * Guarantees ING-03: no network, no MCP SDK, no fetch.
 *
 * @param path - absolute or relative path to the .json snapshot file
 * @returns Validated VokeSnapshot
 * @throws ZodError if the snapshot fails validation
 * @throws Error if the file cannot be read or parsed as JSON
 */
export const readSnapshot = (path: string): VokeSnapshot => {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return VokeSnapshotSchema.parse(parsed) as VokeSnapshot;
};
