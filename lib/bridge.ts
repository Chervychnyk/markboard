// The background's end of the agent bridge: while Settings → Agent access holds a token, it connects to
// mcp/server.ts on localhost and runs the server's ops on storage and bookmarks. Board tabs take the writes
// (they carry `agentAt`, which a visible tab adopts like a sync), and sync pushes them on as usual.
import { boardView, BRIDGE_PORT, type BlockIn, type BridgeMessage, findBoard, type LinkIn, planLinks, removeBlock, upsertBlock } from './agent.ts';
import { DEFAULTS, detachNode, emptyLocal, findNode, insertNode, isLocal, LOCAL_ROOT, normalizeWorkspace, reindex } from './core.ts';
import type { BNode, Data, Meta, TrashEntry } from './types.ts';
import { WIDGETS } from './widgets.ts';

type State = Pick<Data, 'workspaces' | 'ws' | 'local' | 'meta' | 'trash'>;
const KEYS = ['workspaces', 'ws', 'local', 'meta', 'trash'] as const;

let sock: WebSocket | undefined;
let queue: Promise<unknown> = Promise.resolve();

/** Connects unless connected or switched off. Called when the worker wakes, on the 'bridge' alarm and on a new token. */
export async function connectBridge() {
  if (sock && sock.readyState <= WebSocket.OPEN) return;
  const { bridgeToken } = await browser.storage.local.get('bridgeToken');
  // Claude's MCP server may start at any time; while access is on, the alarm wakes the worker to look every 30 s.
  if (typeof bridgeToken !== 'string' || !bridgeToken) return void browser.alarms.clear('bridge');
  if (!(await browser.alarms.get('bridge'))) browser.alarms.create('bridge', { periodInMinutes: 0.5 });
  const ws = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}`);
  sock = ws;
  const send = (m: BridgeMessage) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
  ws.onopen = () => send({ type: 'hello', token: bridgeToken, version: browser.runtime.getManifest().version });
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data)) as BridgeMessage;
    if ('type' in m && m.type === 'ready') return void browser.storage.local.set({ bridgeConnected: true });
    if (!('op' in m)) return;
    // One op at a time: each reads storage, changes it and writes it back.
    queue = queue.then(() => run(m.op, m.args)).then(
      (result) => send({ id: m.id, ok: true, result }),
      (err: unknown) => send({ id: m.id, ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
  };
  ws.onclose = () => {
    if (sock === ws) sock = undefined;
    browser.storage.local.set({ bridgeConnected: false });
  };
}

export function disconnectBridge() {
  sock?.close();
  sock = undefined;
}

async function load(): Promise<State> {
  const d = { ...structuredClone(DEFAULTS), ...(await browser.storage.local.get([...KEYS])) } as Data;
  for (const [id, w] of Object.entries(d.workspaces)) d.workspaces[id] = normalizeWorkspace(w, 'Notes');
  if (d.local?.id !== LOCAL_ROOT) d.local = emptyLocal();
  return d;
}

const commit = (s: State, ...keys: (keyof State)[]) =>
  browser.storage.local.set({ ...Object.fromEntries(keys.map((k) => [k, s[k]])), agentAt: Date.now() });

/** A subtree from either tree: Markboard's own (in `s.local`) or the browser's. */
async function subtree(s: State, id: string): Promise<BNode | undefined> {
  if (isLocal(id)) return findNode(s.local, id);
  return (await browser.bookmarks.getSubTree(id).catch(() => []))[0];
}

/** The board's folder columns, as the board shows them: the root's subfolders, then the board's own `cols`. */
async function boardFolders(s: State, w: State['workspaces'][string]) {
  const root = (await subtree(s, w.root ?? '1'))!;
  const own = (root.children ?? []).filter((n) => !n.url);
  const extra: BNode[] = [];
  for (const id of w.cols) {
    const n = await subtree(s, id);
    if (n && !n.url && !own.some((o) => o.id === n.id)) extra.push(n);
  }
  return { root, folders: [...own, ...extra] };
}

type Args = Record<string, unknown>;
const OPS: Record<string, (s: State, a: Args) => Promise<unknown>> = {
  async list_boards(s) {
    return {
      boards: Object.entries(s.workspaces).map(([id, w]) => ({ id, name: w.name, current: id === s.ws, notes: w.notes.length, widgets: w.widgets.length })),
      blockTypes: ['note', ...Object.keys(WIDGETS)],
    };
  },

  async read_board(s, a) {
    const [id, w] = findBoard(s.workspaces, String(a.board));
    return boardView(id, w, id === s.ws, (await boardFolders(s, w)).folders, s.meta);
  },

  async update_block(s, a) {
    const [, w] = findBoard(s.workspaces, String(a.board));
    const done = upsertBlock(w, a.block as BlockIn, Object.keys(WIDGETS));
    await commit(s, 'workspaces');
    return { [done]: (a.block as BlockIn).key };
  },

  async remove_block(s, a) {
    const [, w] = findBoard(s.workspaces, String(a.board));
    if (!removeBlock(w, String(a.key))) throw new Error(`No note or widget with key "${a.key}"`);
    await commit(s, 'workspaces');
    return { removed: a.key };
  },

  /** Makes a board folder hold these links, in this order (creating the folder if needed). Removed links go to the trash. */
  async set_links(s, a) {
    const [, w] = findBoard(s.workspaces, String(a.board));
    const { root, folders } = await boardFolders(s, w);
    const ref = String(a.folder).trim();
    let folder = folders.find((f) => f.id === ref) ?? folders.find((f) => f.title.toLowerCase() === ref.toLowerCase());
    if (!folder) {
      folder = isLocal(root.id)
        ? insertNode(s.local, root.id, { title: ref.slice(0, 100) })
        : await browser.bookmarks.create({ parentId: root.id, title: ref.slice(0, 100) });
    }
    const local = isLocal(folder.id);
    const plan = planLinks(folder.children ?? [], (a.links ?? []) as LinkIn[], a.mode !== 'append');
    const trashed: TrashEntry[] = [];
    for (const id of plan.remove) {
      const node = await subtree(s, id);
      if (!node) continue;
      if (local) detachNode(s.local, id);
      else await browser.bookmarks.removeTree(id);
      trashed.push({ node: structuredClone(node), at: Date.now() });
    }
    const ids: string[] = [];
    for (const [i, l] of plan.links.entries()) {
      let id = l.id;
      if (local) {
        const n = id && findNode(s.local, id);
        if (n) n.title = l.title;
        else id = insertNode(s.local, folder.id, { title: l.title, url: l.url }).id;
      } else if (id) {
        await browser.bookmarks.update(id, { title: l.title });
        await browser.bookmarks.move(id, { parentId: folder.id, index: i });
      } else {
        id = (await browser.bookmarks.create({ parentId: folder.id, index: i, title: l.title, url: l.url })).id;
      }
      if (l.comment !== undefined) {
        const m: Meta = { ...s.meta[id!], comment: l.comment };
        if (!l.comment) delete m.comment;
        s.meta[id!] = m;
      }
      ids.push(id!);
    }
    if (local) {
      // Links in the order given, then whatever else the folder holds (subfolders, links kept by 'append').
      const f = findNode(s.local, folder.id)!;
      f.children = [...ids.map((id) => f.children!.find((c) => c.id === id)!), ...f.children!.filter((c) => !ids.includes(c.id))];
      reindex(f);
    }
    s.trash.unshift(...trashed);
    await commit(s, 'local', 'meta', 'trash');
    return { folder: folder.title, links: ids.length, trashed: trashed.length };
  },
};

async function run(op: string, args: Args) {
  const fn = OPS[op];
  if (!fn) throw new Error(`Unknown op "${op}"`);
  return fn(await load(), args ?? {});
}
