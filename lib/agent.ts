// What an agent (Claude, through mcp/server.ts) may read and change on a board. Pure: the background
// (lib/bridge.ts) loads storage and the folders, calls these, and writes the result back.
import type { BNode, Meta, Note, TrashEntry, Widget, Workspace } from './types.ts';

/** The port mcp/server.ts listens on, on 127.0.0.1 only. */
export const BRIDGE_PORT = 47615;

/** Bridge messages. The extension connects and says hello with its token; then the server sends ops. */
export type BridgeMessage =
  | { type: 'hello'; token: string; version: string } // extension → server
  | { type: 'ready' } // server → extension: the token matched
  | { type: 'ping' } // server → extension, keeps the service worker awake
  | { id: number; op: string; args: Record<string, unknown> } // server → extension
  | { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }; // extension → server

export interface LinkIn { title: string; url: string; comment?: string }
export interface BlockIn {
  key: string;
  /** 'note', or a widget type */
  type: string;
  /** a note's title or a widget's label */
  title?: string;
  text?: string;
  checklist?: { text: string; done?: boolean }[];
  /** other widget settings, e.g. a table's `note`, a countdown's `to`, a clock's `tz` */
  settings?: Record<string, string | number | boolean>;
}

/** One agent session's changes, kept so the user can undo them together (Settings → Agent access, or the toast).
 *  Each list holds what was there before the first change of the run. */
export interface AgentRun {
  at: number;
  last: number;
  /** names of the boards it changed */
  boards: string[];
  changes: number;
  blocks: { board: string; key: string; before: Note | Widget | null }[];
  /** bookmarks and folders it made (either tree) */
  created: string[];
  retitled: [id: string, title: string][];
  meta: Record<string, Meta | null>;
  trashed: TrashEntry[];
}

/** Changes this far apart are separate runs. */
export const RUN_GAP = 10 * 60e3;

/** The run a change at `now` belongs to: the last one if it is still going, else a new one. */
export function currentRun(last: AgentRun | undefined, now: number): AgentRun {
  if (last && now - last.last < RUN_GAP) return { ...last, last: now };
  return { at: now, last: now, boards: [], changes: 0, blocks: [], created: [], retitled: [], meta: {}, trashed: [] };
}

/** Counts a change on `board` and remembers a block's state from before the run, the first time it is touched. */
export function noteChange(r: AgentRun, board: string, block?: { id: string; key: string; before: Note | Widget | null }) {
  r.changes++;
  if (!r.boards.includes(board)) r.boards.push(board);
  if (block && !r.blocks.some((b) => b.board === block.id && b.key === block.key)) r.blocks.push({ board: block.id, key: block.key, before: block.before });
}

/** Puts the run's notes and widgets back as they were: changed ones restored, created ones removed, removed ones back. */
export function revertBlocks(workspaces: Record<string, Workspace>, r: AgentRun) {
  for (const b of [...r.blocks].reverse()) {
    const w = workspaces[b.board];
    if (!w) continue;
    const isNote = b.before ? 'checklist' in b.before : w.notes.some((n) => n.key === b.key);
    const list: (Note | Widget)[] = isNote ? w.notes : w.widgets;
    const i = list.findIndex((x) => x.key === b.key);
    if (!b.before) { if (i >= 0) list.splice(i, 1); }
    else if (i >= 0) list[i] = b.before; // in its place
    else list.push(b.before); // it was removed: back at the end
  }
}

const WEB_URL = /^https?:\/\//i;
const str = (v: unknown, max: number) => String(v ?? '').slice(0, max);

/** A board by id, or by name ignoring case. */
export function findBoard(workspaces: Record<string, Workspace>, ref: string): [string, Workspace] {
  if (workspaces[ref]) return [ref, workspaces[ref]];
  const hit = Object.entries(workspaces).find(([, w]) => w.name.toLowerCase() === ref.trim().toLowerCase());
  if (!hit) throw new Error(`No board "${ref}". Boards: ${Object.values(workspaces).map((w) => w.name).join(', ')}`);
  return hit;
}

/** A folder for the agent: its links (with comments) and subfolders, at most `depth` levels down. */
function folderView(n: BNode, meta: Record<string, Meta>, depth = 2): object {
  const kids = n.children ?? [];
  return {
    id: n.id, title: n.title,
    links: kids.filter((c) => c.url).map((c) => ({ id: c.id, title: c.title, url: c.url, ...(meta[c.id]?.comment && { comment: meta[c.id]!.comment }) })),
    ...(kids.some((c) => !c.url) && {
      folders: depth > 1 ? kids.filter((c) => !c.url).map((c) => folderView(c, meta, depth - 1)) : kids.filter((c) => !c.url).map((c) => c.title),
    }),
  };
}

const widgetView = (w: Widget) =>
  Object.fromEntries(Object.entries(w).filter(([k, v]) => k !== 'id' && !(typeof v === 'string' && v.startsWith('data:'))));

/** What read_board returns: the board's folder columns, notes and widgets (photos left out). */
export function boardView(id: string, w: Workspace, current: boolean, folders: BNode[], meta: Record<string, Meta>) {
  return {
    id, name: w.name, current,
    folders: folders.map((f) => folderView(f, meta)),
    notes: w.notes.map((n) => Object.fromEntries(Object.entries(n).filter(([k]) => k !== 'id'))),
    widgets: w.widgets.map(widgetView),
  };
}

/** Creates or replaces the note or widget with this key, stamped `agentAt`. A checklist item keeps its tick when its
 *  text stays. Returns the block as it was before, or null. */
export function upsertBlock(w: Workspace, b: BlockIn, widgetTypes: string[], now = Date.now()): Note | Widget | null {
  const key = str(b.key, 100).trim();
  if (!key) throw new Error('key is required');
  if (b.type !== 'note' && !widgetTypes.includes(b.type)) throw new Error(`Unknown type "${b.type}". Types: note, ${widgetTypes.join(', ')}`);
  const note = w.notes.find((n) => n.key === key), widget = w.widgets.find((x) => x.key === key);
  const old = note ? 'note' : widget?.type;
  if (old && old !== b.type) throw new Error(`"${key}" is a ${old}, not a ${b.type}; remove it first to change its type`);

  const before = structuredClone(note ?? widget ?? null);
  if (b.type === 'note') {
    const done = new Map(note?.checklist.map((c) => [c.text, c.done]));
    const next: Note = {
      id: note?.id ?? crypto.randomUUID(), key, agentAt: now,
      title: b.title !== undefined ? str(b.title, 100) : note?.title ?? key,
      text: b.text !== undefined ? str(b.text, 20000) : note?.text ?? '',
      checklist: b.checklist ? b.checklist.slice(0, 200).map((c) => ({ text: str(c.text, 300), done: c.done ?? done.get(c.text) ?? false })) : note?.checklist ?? [],
    };
    if (note) Object.assign(note, next);
    else w.notes.push(next);
    return before;
  }

  const settings = Object.fromEntries(Object.entries(b.settings ?? {})
    .filter(([k, v]) => !['id', 'key', 'type'].includes(k) && ['string', 'number', 'boolean'].includes(typeof v) && !String(v).startsWith('data:'))
    .map(([k, v]) => [k, typeof v === 'string' ? str(v, 20000) : v]));
  const next: Widget = {
    ...(widget ?? { id: crypto.randomUUID(), type: b.type }), key, ...settings, agentAt: now,
    ...(b.title !== undefined && { label: str(b.title, 100) }),
    ...(b.text !== undefined && { text: str(b.text, 20000) }),
  };
  if (widget) Object.assign(widget, next);
  else w.widgets.push(next);
  return before;
}

/** Takes out the note or widget with this key and returns it. */
export function removeBlock(w: Workspace, key: string): Note | Widget | undefined {
  const gone = w.notes.find((n) => n.key === key) ?? w.widgets.find((x) => x.key === key);
  w.notes = w.notes.filter((n) => n.key !== key);
  w.widgets = w.widgets.filter((x) => x.key !== key);
  return gone;
}

/** How to make a folder's links match `want`, matched by URL: keep (and retitle), add, or remove. Subfolders stay. */
export function planLinks(have: BNode[], want: LinkIn[], replace: boolean) {
  const links = want.filter((l) => WEB_URL.test(l?.url ?? '')).slice(0, 200)
    .map((l) => ({ title: str(l.title, 300) || l.url, url: l.url, comment: l.comment === undefined ? undefined : str(l.comment, 2000) }));
  const byUrl = new Map(have.filter((n) => n.url).map((n) => [n.url!, n]));
  const seen = new Set<string>();
  const out = links.filter((l) => !seen.has(l.url) && seen.add(l.url))
    .map((l) => ({ ...l, id: byUrl.get(l.url)?.id }));
  const remove = replace ? have.filter((n) => n.url && !seen.has(n.url)).map((n) => n.id) : [];
  return { links: out, remove };
}
