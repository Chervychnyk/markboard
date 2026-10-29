#!/usr/bin/env node
// Lets Claude read and update Markboard boards. Claude Code starts this over stdio; the Markboard extension
// connects to it on ws://127.0.0.1 (lib/bridge.ts) and runs each tool call on its own storage.
import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';
import { BRIDGE_PORT, type BridgeMessage } from '../lib/agent.ts';

const TOKEN = process.env.MARKBOARD_TOKEN ?? '';
const WAIT = 35_000; // the extension looks for this server every 30 s
const SETUP = 'In Markboard: Settings → Agent access, turn it on and add the server with the command shown there.';

let ext: WebSocket | undefined;
let listenError = '';
const waiting = new Set<() => void>();
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let nextId = 1;

const sameToken = (t: unknown) =>
  typeof t === 'string' && !!TOKEN && t.length === TOKEN.length && timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN));

// Only an extension page may connect (web pages send their own origin), and only with the token.
const wss = new WebSocketServer({ host: '127.0.0.1', port: BRIDGE_PORT, verifyClient: ({ origin }: { origin?: string }) => !!origin?.startsWith('chrome-extension://') });
wss.on('error', (e: NodeJS.ErrnoException) => {
  listenError = e.code === 'EADDRINUSE'
    ? `Port ${BRIDGE_PORT} is taken, most likely by the Markboard server of another Claude session. Only one session at a time can drive Markboard; close the other one and restart this server (/mcp).`
    : `Markboard bridge failed: ${e.message}`;
});
wss.on('connection', (ws) => {
  let authed = false;
  const hello = setTimeout(() => ws.close(4401, 'no hello'), 5000);
  ws.on('message', (raw) => {
    let m: BridgeMessage;
    try { m = JSON.parse(String(raw)); } catch { return; }
    if (!authed) {
      clearTimeout(hello);
      if (!('type' in m) || m.type !== 'hello' || !sameToken(m.token)) return ws.close(4401, 'bad token');
      authed = true;
      if (ext && ext !== ws) ext.close(4000, 'replaced');
      ext = ws;
      ws.send(JSON.stringify({ type: 'ready' } satisfies BridgeMessage));
      for (const go of waiting) go();
      return;
    }
    if ('ok' in m) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.ok) p?.resolve(m.result);
      else p?.reject(new Error(m.error));
    }
  });
  ws.on('close', () => { if (ext === ws) ext = undefined; });
});
setInterval(() => ext?.send(JSON.stringify({ type: 'ping' } satisfies BridgeMessage)), 20_000).unref();

function connected(): Promise<WebSocket> {
  if (ext) return Promise.resolve(ext);
  return new Promise((resolve, reject) => {
    const go = () => { clearTimeout(timer); waiting.delete(go); resolve(ext!); };
    const timer = setTimeout(() => {
      waiting.delete(go);
      reject(new Error(`Markboard did not connect within ${WAIT / 1000} s. Is the browser open, and is Settings → Agent access on with this token?`));
    }, WAIT);
    waiting.add(go);
  });
}

async function call(op: string, args: Record<string, unknown> = {}): Promise<unknown> {
  if (listenError) throw new Error(listenError);
  if (!TOKEN) throw new Error(`MARKBOARD_TOKEN is not set. ${SETUP}`);
  const ws = await connected();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Markboard did not answer "${op}"`)); }, 30_000);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    ws.send(JSON.stringify({ id, op, args } satisfies BridgeMessage));
  });
}

/** Runs an op and hands its result (or error) back to Claude as JSON text. */
const tool = (op: string, args?: Record<string, unknown>) => call(op, args).then(
  (r) => ({ content: [{ type: 'text' as const, text: JSON.stringify(r, null, 2) }] }),
  (e: Error) => ({ content: [{ type: 'text' as const, text: e.message }], isError: true }),
);

const server = new McpServer({ name: 'markboard', version: '0.1.0' }, {
  instructions: `Markboard is the user's browser new-tab page: boards (workspaces) of bookmark folders shown as columns, plus notes and widgets.
Read a board before changing it. Notes and widgets carry a "key"; update_block with an existing key replaces that block in place, so reuse the keys a board already has (templates set them, e.g. "schedule", "drivers", "plan") and pick stable new ones, rather than adding duplicates.
Block text formats:
- schedule: one session per line, "Label | ISO date-time with zone", e.g. "Race | 2026-11-08T17:00:00Z". The board shows them in the viewer's time zone with a countdown to the next.
- table: one row per line, cells split by "|", first row is the header (a markdown table also works). settings.note is a footnote, e.g. "After round 20".
- snippet: free text, or "Label: value" lines that become copy buttons.
- countdown: settings.to is the target date-time. clock: settings.tz is an IANA time zone.
- note: title, text, and an optional checklist (ticks are kept for items whose text stays the same).
Links go into the board's folders with set_links; links it removes go to Markboard's trash, where the user can restore them.`,
});

const board = z.string().describe('Board name (case-insensitive) or id, from list_boards');

server.registerTool('list_boards', {
  description: "Lists the user's Markboard boards and the block types update_block accepts.",
  annotations: { readOnlyHint: true },
}, () => tool('list_boards'));

server.registerTool('read_board', {
  description: "A board's folder columns with their links and comments, its notes and its widgets (with their keys and settings).",
  inputSchema: { board },
  annotations: { readOnlyHint: true },
}, (a) => tool('read_board', a));

server.registerTool('update_block', {
  description: 'Creates or replaces the note or widget with this key on a board. Fields left out keep their current value.',
  inputSchema: {
    board,
    key: z.string().describe('Stable name of the block, e.g. "schedule" or "drivers"'),
    type: z.string().describe('"note" or a widget type: schedule, table, snippet, countdown, clock, counter, timer, pomodoro'),
    title: z.string().optional().describe("Note title or widget label"),
    text: z.string().optional().describe('Note text, or the widget text (schedule, table, snippet); see the formats in the server instructions'),
    checklist: z.array(z.object({ text: z.string(), done: z.boolean().optional() })).optional().describe('Notes only: replaces the checklist'),
    settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
      .describe('Other widget settings, e.g. {"note": "After round 20"} for a table, {"to": "2026-11-08T17:00:00Z"} for a countdown'),
  },
}, ({ board, ...block }) => tool('update_block', { board, block }));

server.registerTool('remove_block', {
  description: 'Removes the note or widget with this key from a board.',
  inputSchema: { board, key: z.string() },
  annotations: { destructiveHint: true },
}, (a) => tool('remove_block', a));

server.registerTool('set_links', {
  description: 'Makes a folder column on a board hold these links, in this order, creating the folder if the board has none by that name. ' +
    'Links are matched by URL, so existing ones keep their colour, tags and favorite. With mode "replace" (the default) links not listed go to the trash; "append" keeps them.',
  inputSchema: {
    board,
    folder: z.string().describe('Folder title (case-insensitive) or id, e.g. "This weekend"'),
    links: z.array(z.object({
      title: z.string(),
      url: z.string().describe('http(s) URL'),
      comment: z.string().optional().describe('Shown under the link; "" clears it'),
    })),
    mode: z.enum(['replace', 'append']).optional(),
  },
}, (a) => tool('set_links', a));

await server.connect(new StdioServerTransport());
