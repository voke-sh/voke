/**
 * Deterministic 2-tool stdio MCP fixture server for subprocess tests.
 *
 * Uses McpServer + StdioServerTransport from @modelcontextprotocol/sdk.
 * Registers exactly TWO tools with FIXED names/descriptions/inputSchemas —
 * never depends on a real server so the surface is identical on every connection.
 *
 * No timestamps, no random values in tool metadata.
 * Emits nothing to stdout except MCP protocol traffic.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'voke-stdio-fixture',
  version: '1.0.0',
});

// Tool 1: alpha_tool — sorts first alphabetically
server.tool(
  'alpha_tool',
  'Retrieves an item by its unique identifier. Returns the item data as a structured object.',
  {
    item_id: z.string().describe('The unique identifier of the item to retrieve'),
  },
  async ({ item_id }) => ({
    content: [{ type: 'text', text: `item:${item_id}` }],
  }),
);

// Tool 2: beta_tool — sorts second alphabetically
server.tool(
  'beta_tool',
  'Searches for items matching the provided query string. Returns a list of matching results.',
  {
    query: z.string().describe('The search query string to match against item names and descriptions'),
    limit: z.number().int().min(1).max(100).optional().describe('Maximum number of results to return (1-100)'),
  },
  async ({ query, limit = 10 }) => ({
    content: [{ type: 'text', text: `results:${query}:${limit}` }],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
