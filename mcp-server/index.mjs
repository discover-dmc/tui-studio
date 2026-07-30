#!/usr/bin/env node
// Standalone MCP server for sTUIdio (AI integration Phase 1 — see todo.md).
//
// Spawned over stdio by an MCP client (Claude Code, Claude Desktop, etc.).
// Bridges tool calls to the live sTUIdio browser tab over a local WebSocket:
// the tab must have Settings > Agent Bridge enabled. Only one connected tab
// is supported — the most recently connected one wins (see README.md).
//
// IMPORTANT: stdout is the MCP JSON-RPC channel. Never console.log — use
// console.error for anything diagnostic, it goes to stderr instead.

import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const PORT = 5175;

const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
let activeSocket = null;
const pending = new Map(); // id -> { resolve, reject, timer }

// A second instance (another MCP client reconnect, a stray health check, a
// manually-started copy per the README) colliding on this port must not take
// the whole MCP stdio connection down with it — an unhandled 'error' event
// on an EventEmitter is fatal by default. Degrade instead: the MCP tools
// still register and respond, they just report "no browser tab connected"
// until the port frees up, since this instance can never receive one.
wss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `sTUIdio bridge: port ${PORT} is already in use (likely another mcp-server ` +
        'instance already running) — this MCP connection stays up, but its own ' +
        'bridge can\'t bind, so tool calls will report "no browser tab connected."'
    );
  } else {
    console.error(`sTUIdio bridge: WebSocket server error: ${err.message}`);
  }
});

wss.on('connection', (socket) => {
  activeSocket = socket;
  console.error(`sTUIdio bridge: browser tab connected (${wss.clients.size} total)`);

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(msg.id);
    if (msg.ok) entry.resolve(msg.result);
    else entry.reject(new Error(msg.error || 'Unknown browser-side error'));
  });

  socket.on('close', () => {
    if (activeSocket === socket) activeSocket = null;
    console.error('sTUIdio bridge: browser tab disconnected');
  });
});

/** Sends { id, action, payload } to the connected tab and awaits its reply. */
function callBrowser(action, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!activeSocket || activeSocket.readyState !== activeSocket.OPEN) {
      reject(
        new Error(
          'No sTUIdio browser tab connected — open the app and enable Agent Bridge in Settings.'
        )
      );
      return;
    }
    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Browser tab did not respond in time.'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    activeSocket.send(JSON.stringify({ id, action, payload }));
  });
}

const server = new McpServer({ name: 'stuidio', version: '1.0.0' });

/** Wraps a handler so every tool call returns a well-formed result, error or not. */
function tool(name, config, handler) {
  server.registerTool(name, config, async (args) => {
    try {
      const result = await handler(args ?? {});
      // render_preview returns a raw string meant to be read as-is; everything
      // else is structured data that needs stringifying.
      const text = typeof result === 'string' ? result : JSON.stringify(result ?? null);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });
}

const record = () => z.record(z.string(), z.unknown()).optional();
const dryRun = () =>
  z
    .boolean()
    .optional()
    .describe(
      'If true, computes the change but does not commit it — returns a unified diff of the would-be tree instead.'
    );

tool(
  'get_tree',
  { title: 'Get component tree', description: 'Returns the current full sTUIdio component tree as JSON.', inputSchema: {} },
  () => callBrowser('get_tree', {})
);

tool(
  'render_preview',
  {
    title: 'Render preview',
    description:
      'Renders the current design to text — the same output the app\'s own Export panel Preview/Text tab produces. Call this after making changes to see the actual result and self-correct, instead of relying on get_tree alone.',
    inputSchema: { format: z.enum(['text', 'ansi']).optional() },
  },
  ({ format }) => callBrowser('render_preview', { format: format ?? 'text' })
);

tool(
  'list_component_types',
  {
    title: 'List component types',
    description: 'Lists every available component type with its name, description, and category.',
    inputSchema: {},
  },
  () => callBrowser('list_component_types', {})
);

tool(
  'get_component_schema',
  {
    title: 'Get component schema',
    description: 'Returns the default props/layout/style/events for one component type.',
    inputSchema: { type: z.string() },
  },
  ({ type }) => callBrowser('get_component_schema', { type })
);

tool(
  'add_component',
  {
    title: 'Add component',
    description: 'Adds a new component as a child of an existing node, using its library defaults merged with any overrides. Supports dryRun.',
    inputSchema: {
      parentId: z.string(),
      type: z.string(),
      props: record(),
      layout: record(),
      style: record(),
      events: record(),
      index: z.number().int().min(0).optional(),
      dryRun: dryRun(),
    },
  },
  (args) => callBrowser('add_component', args)
);

tool(
  'update_props',
  {
    title: 'Update component props',
    description: 'Merges the given props into an existing component. Supports dryRun.',
    inputSchema: { id: z.string(), props: z.record(z.string(), z.unknown()), dryRun: dryRun() },
  },
  (args) => callBrowser('update_props', args)
);

tool(
  'update_layout',
  {
    title: 'Update component layout',
    description: 'Merges the given layout fields into an existing component. Supports dryRun.',
    inputSchema: { id: z.string(), layout: z.record(z.string(), z.unknown()), dryRun: dryRun() },
  },
  (args) => callBrowser('update_layout', args)
);

tool(
  'move_component',
  {
    title: 'Move component',
    description: 'Moves an existing component to a new parent, optionally at a specific index. Supports dryRun.',
    inputSchema: {
      id: z.string(),
      newParentId: z.string(),
      index: z.number().int().min(0).optional(),
      dryRun: dryRun(),
    },
  },
  (args) => callBrowser('move_component', args)
);

tool(
  'remove_component',
  {
    title: 'Remove component',
    description: 'Removes a component (and its children) from the tree. Supports dryRun.',
    inputSchema: { id: z.string(), dryRun: dryRun() },
  },
  ({ id, dryRun: isDryRun }) => callBrowser('remove_component', { id, dryRun: isDryRun })
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`sTUIdio MCP server ready. Bridge listening on ws://127.0.0.1:${PORT}`);
