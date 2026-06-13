/**
 * Tests for ingestStdio (ING-06).
 *
 * Uses the REAL fixture server (tests/fixtures/stdio-server.mjs) as a subprocess.
 * No mocking — tests the actual StdioClientTransport wiring end-to-end.
 *
 * Test behaviors:
 * 1. Real launch: resolves to a 2-tool sorted VokeSnapshot
 * 2. Determinism: two runs produce deepEqual meta-stripped snapshots
 * 3. Bad command: rejects with StdioLaunchError (exitCode 8)
 * 4. Masking: StdioLaunchError message never contains extraEnv values
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { ingestStdio } from '../../packages/linter/src/ingestion/stdio-client.js';
import { StdioLaunchError } from '../../packages/linter/src/errors.js';

const FIXTURE = join(import.meta.dirname, '../fixtures/stdio-server.mjs');

describe('ingestStdio — real subprocess launch', () => {
  it('resolves to a VokeSnapshot with 2 sorted tools', async () => {
    const snapshot = await ingestStdio({ command: 'node', args: [FIXTURE] });

    expect(snapshot.snapshotVersion).toBe('1');
    expect(snapshot.mtqsVersion).toBe('0.1');
    expect(snapshot.server.url).toBeNull();
    expect(snapshot.meta.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(snapshot.tools).toHaveLength(2);

    // Tools must be sorted ascending by toolId
    expect(snapshot.tools[0].toolId).toBe('alpha_tool');
    expect(snapshot.tools[1].toolId).toBe('beta_tool');

    // Each tool must have a non-empty contentHash
    expect(snapshot.tools[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.tools[1].contentHash).toMatch(/^[a-f0-9]{64}$/);
  }, 15000);
});

describe('ingestStdio — determinism (D-12)', () => {
  it('two runs produce deepEqual meta-stripped snapshots', async () => {
    const snap1 = await ingestStdio({ command: 'node', args: [FIXTURE] });
    const snap2 = await ingestStdio({ command: 'node', args: [FIXTURE] });

    // Strip meta (capturedAt differs by wall-clock, by design D-02)
    const { meta: _meta1, ...body1 } = snap1;
    const { meta: _meta2, ...body2 } = snap2;

    expect(body1).toEqual(body2);
  }, 30000);
});

describe('ingestStdio — launch failure (exit 8)', () => {
  it('rejects with StdioLaunchError for a non-existent command', async () => {
    await expect(
      ingestStdio({ command: 'definitely-not-a-real-binary-xyz', args: [] }),
    ).rejects.toThrow(StdioLaunchError);
  }, 10000);

  it('StdioLaunchError has exitCode 8', async () => {
    await expect(
      ingestStdio({ command: 'definitely-not-a-real-binary-xyz', args: [] }),
    ).rejects.toMatchObject({ exitCode: 8 });
  }, 10000);
});

describe('ingestStdio — env masking (D-09/Pitfall 4)', () => {
  it('StdioLaunchError message does NOT contain extraEnv values', async () => {
    const SECRET = 'my-top-secret-env-value-xyz123';
    let caught: Error | undefined;
    try {
      await ingestStdio({
        command: 'definitely-not-a-real-binary-xyz',
        args: [],
        extraEnv: { MY_SECRET: SECRET },
      });
    } catch (err) {
      caught = err as Error;
    }
    expect(caught).toBeInstanceOf(StdioLaunchError);
    expect(caught!.message).not.toContain(SECRET);
  }, 10000);
});
