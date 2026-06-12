/**
 * Tests for the live MCP client (ING-01, ING-02, D-08..D-11).
 *
 * The SDK Client is mocked so no real network occurs.
 * fetch is stubbed to throw to prove no accidental real network calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ingestLive, maskHeaders } from '../../packages/linter/src/ingestion/mcp-client.js';
import { PartialPageError, DepthExceededError } from '../../packages/linter/src/errors.js';

// ---------------------------------------------------------------------------
// Stub fetch globally in ALL tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('network blocked in tests');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Mock the MCP SDK modules with constructors that return plain objects
// ---------------------------------------------------------------------------

// We track what the test wants to use as the mock client
let currentMockClient: ReturnType<typeof buildMockClient> | null = null;
let currentMockTransport: Record<string, unknown> = {};

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class MockClient {
      connect = vi.fn().mockImplementation(async () => {
        if (currentMockClient) await currentMockClient.connect();
      });
      close = vi.fn().mockResolvedValue(undefined);
      getServerVersion = vi.fn().mockImplementation(() => {
        return currentMockClient?.getServerVersion() ?? null;
      });
      listTools = vi.fn().mockImplementation(async (params: unknown, _opts: unknown) => {
        if (!currentMockClient) throw new Error('no mock client set');
        return currentMockClient.listTools(params, _opts);
      });
    },
  };
});

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => {
  return {
    StreamableHTTPClientTransport: class MockStreamableTransport {
      constructor(_url: unknown, _opts: unknown) {
        // Record construction for test assertions if needed
      }
    },
  };
});

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => {
  return {
    SSEClientTransport: class MockSSETransport {
      constructor(_url: unknown, _opts: unknown) {
        // Record construction for test assertions if needed
      }
    },
  };
});

// ---------------------------------------------------------------------------
// Helper to build a mock client
// ---------------------------------------------------------------------------
function buildMockClient(
  pages: Array<{ tools: Array<{ name: string; inputSchema: unknown; description?: string }>; nextCursor?: string }>,
  opts: { connectThrows?: boolean } = {},
) {
  let pageIndex = 0;
  return {
    connect: vi.fn().mockImplementation(async () => {
      if (opts.connectThrows) throw new Error('connection refused');
    }),
    close: vi.fn().mockResolvedValue(undefined),
    getServerVersion: vi.fn().mockReturnValue({
      name: 'test-server',
      version: '1.0.0',
      protocolVersion: '2026-07-28',
    }),
    listTools: vi.fn().mockImplementation(async () => {
      if (pageIndex >= pages.length) {
        return { tools: [], nextCursor: undefined };
      }
      const page = pages[pageIndex++];
      return { tools: page.tools, nextCursor: page.nextCursor };
    }),
  };
}

function buildFailingClient() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getServerVersion: vi.fn().mockReturnValue({ name: 's', version: '1', protocolVersion: 'p' }),
    listTools: vi.fn().mockRejectedValue(new Error('network timeout')),
  };
}

// ---------------------------------------------------------------------------
// maskHeaders
// ---------------------------------------------------------------------------
describe('maskHeaders', () => {
  it('replaces all header values with [MASKED]', () => {
    const headers = {
      Authorization: 'Bearer secret-token',
      'X-Custom': 'custom-value',
    };
    const masked = maskHeaders(headers);
    expect(masked).toEqual({
      Authorization: '[MASKED]',
      'X-Custom': '[MASKED]',
    });
  });

  it('returns a copy — does not mutate the original', () => {
    const headers = { Authorization: 'Bearer secret' };
    const masked = maskHeaders(headers);
    expect(headers.Authorization).toBe('Bearer secret');
    expect(masked.Authorization).toBe('[MASKED]');
  });

  it('handles empty headers object', () => {
    expect(maskHeaders({})).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// ingestLive — pagination
// ---------------------------------------------------------------------------
describe('ingestLive — pagination', () => {
  it('collects tools from multiple pages when nextCursor is present', async () => {
    currentMockClient = buildMockClient([
      {
        tools: [{ name: 'tool_b', inputSchema: { type: 'object', properties: {} } }],
        nextCursor: 'cursor-1',
      },
      {
        tools: [{ name: 'tool_a', inputSchema: { type: 'object', properties: {} } }],
        nextCursor: undefined,
      },
    ]);

    const snapshot = await ingestLive({ url: 'http://localhost:3000/mcp' });

    expect(snapshot.tools).toHaveLength(2);
    // Tools must be sorted ascending by toolId
    expect(snapshot.tools[0].toolId).toBe('tool_a');
    expect(snapshot.tools[1].toolId).toBe('tool_b');
  });

  it('collects a single page when no nextCursor is returned', async () => {
    currentMockClient = buildMockClient([
      { tools: [{ name: 'alpha_tool', inputSchema: { type: 'object' } }], nextCursor: undefined },
    ]);

    const snapshot = await ingestLive({ url: 'http://localhost:3000/mcp' });
    expect(snapshot.tools).toHaveLength(1);
    expect(snapshot.tools[0].toolId).toBe('alpha_tool');
  });
});

// ---------------------------------------------------------------------------
// ingestLive — partial page failure aborts (D-10)
// ---------------------------------------------------------------------------
describe('ingestLive — partial page abort', () => {
  it('throws PartialPageError when a listTools page rejects', async () => {
    currentMockClient = buildFailingClient();

    await expect(ingestLive({ url: 'http://localhost:3000/mcp' })).rejects.toThrow(
      PartialPageError,
    );
  });

  it('PartialPageError has exitCode 4', async () => {
    currentMockClient = buildFailingClient();

    await expect(ingestLive({ url: 'http://localhost:3000/mcp' })).rejects.toMatchObject({
      exitCode: 4,
    });
  });
});

// ---------------------------------------------------------------------------
// ingestLive — tool sorting
// ---------------------------------------------------------------------------
describe('ingestLive — tool sorting', () => {
  it('sorts output tools ascending by toolId (localeCompare determinism)', async () => {
    currentMockClient = buildMockClient([
      {
        tools: [
          { name: 'z_tool', inputSchema: { type: 'object' } },
          { name: 'a_tool', inputSchema: { type: 'object' } },
          { name: 'm_tool', inputSchema: { type: 'object' } },
        ],
        nextCursor: undefined,
      },
    ]);

    const snapshot = await ingestLive({ url: 'http://localhost:3000/mcp' });
    const ids = snapshot.tools.map(t => t.toolId);
    expect(ids).toEqual(['a_tool', 'm_tool', 'z_tool']);
  });
});

// ---------------------------------------------------------------------------
// ingestLive — header masking (D-09)
// ---------------------------------------------------------------------------
describe('ingestLive — header masking', () => {
  it('does not include raw header values in the serialized VokeSnapshot', async () => {
    currentMockClient = buildMockClient([
      { tools: [{ name: 'tool_a', inputSchema: { type: 'object' } }], nextCursor: undefined },
    ]);

    const SECRET_TOKEN = 'super-secret-api-key-12345';

    const snapshot = await ingestLive({
      url: 'http://localhost:3000/mcp',
      rawHeaders: [`Authorization: Bearer ${SECRET_TOKEN}`],
    });

    // Serialize and confirm the raw token is nowhere in the output
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain(SECRET_TOKEN);
  });
});

// ---------------------------------------------------------------------------
// ingestLive — depth exceeded (D-04)
// ---------------------------------------------------------------------------
describe('ingestLive — depth exceeded', () => {
  it('throws DepthExceededError when a tool inputSchema exceeds DEPTH_HARD_CAP', async () => {
    // Build a schema that nests >32 levels deep
    const buildDeep = (levels: number): Record<string, unknown> => {
      if (levels === 0) return { type: 'string' };
      return { type: 'object', properties: { nested: buildDeep(levels - 1) } };
    };
    const deepSchema = buildDeep(40);

    currentMockClient = buildMockClient([
      {
        tools: [{ name: 'deep_tool', inputSchema: deepSchema }],
        nextCursor: undefined,
      },
    ]);

    await expect(ingestLive({ url: 'http://localhost:3000/mcp' })).rejects.toThrow(
      DepthExceededError,
    );
  });

  it('DepthExceededError has exitCode 6', async () => {
    const buildDeep = (levels: number): Record<string, unknown> => {
      if (levels === 0) return { type: 'string' };
      return { type: 'object', properties: { nested: buildDeep(levels - 1) } };
    };

    currentMockClient = buildMockClient([
      {
        tools: [{ name: 'deep_tool', inputSchema: buildDeep(40) }],
        nextCursor: undefined,
      },
    ]);

    await expect(ingestLive({ url: 'http://localhost:3000/mcp' })).rejects.toMatchObject({
      exitCode: 6,
    });
  });
});

// ---------------------------------------------------------------------------
// ingestLive — snapshot shape
// ---------------------------------------------------------------------------
describe('ingestLive — VokeSnapshot shape', () => {
  it('returns a VokeSnapshot with correct snapshotVersion and mtqsVersion', async () => {
    currentMockClient = buildMockClient([
      { tools: [{ name: 'tool_a', inputSchema: { type: 'object' } }], nextCursor: undefined },
    ]);

    const snapshot = await ingestLive({ url: 'http://localhost:3000/mcp' });

    expect(snapshot.snapshotVersion).toBe('1');
    expect(snapshot.mtqsVersion).toBe('0.1');
    expect(snapshot.server.url).toBe('http://localhost:3000/mcp');
    expect(snapshot.meta.capturedAt).toBeTruthy();
    expect(new Date(snapshot.meta.capturedAt).toISOString()).toBe(snapshot.meta.capturedAt);
  });

  it('sets toolId = tool.name and contentHash is a 64-char hex string', async () => {
    currentMockClient = buildMockClient([
      {
        tools: [
          {
            name: 'my_tool',
            inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
          },
        ],
        nextCursor: undefined,
      },
    ]);

    const snapshot = await ingestLive({ url: 'http://localhost:3000/mcp' });
    const tool = snapshot.tools[0];

    expect(tool.toolId).toBe('my_tool');
    expect(tool.name).toBe('my_tool');
    expect(tool.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
