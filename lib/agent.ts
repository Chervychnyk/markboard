// What an agent (Claude, through mcp/server.ts) may read and change on a board. Pure: the background
// (lib/bridge.ts) loads storage and the folders, calls these, and writes the result back.
import type { BNode, Meta, Note, Widget, Workspace } from './types.ts';

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

/** Creates or replaces the note or widget with this key. A checklist item keeps its tick when its text stays. */
export function upsertBlock(w: Workspace, b: BlockIn, widgetTypes: string[]): 'created' | 'updated' {
  const key = str(b.key, 100).trim();
  if (!key) throw new Error('key is required');
  if (b.type !== 'note' && !widgetTypes.includes(b.type)) throw new Error(`Unknown type "${b.type}". Types: note, ${widgetTypes.join(', ')}`);
  const note = w.notes.find((n) => n.key === key), widget = w.widgets.find((x) => x.key === key);
  const old = note ? 'note' : widget?.type;
  if (old && old !== b.type) throw new Error(`"${key}" is a ${old}, not a ${b.type}; remove it first to change its type`);

  if (b.type === 'note') {
    const done = new Map(note?.checklist.map((c) => [c.text, c.done]));
    const next: Note = {
      id: note?.id ?? crypto.randomUUID(), key,
      title: b.title !== undefined ? str(b.title, 100) : note?.title ?? key,
      text: b.text !== undefined ? str(b.text, 20000) : note?.text ?? '',
      checklist: b.checklist ? b.checklist.slice(0, 200).map((c) => ({ text: str(c.text, 300), done: c.done ?? done.get(c.text) ?? false })) : note?.checklist ?? [],
    };
    if (note) Object.assign(note, next);
    else w.notes.push(next);
    return note ? 'updated' : 'created';
  }

  const settings = Object.fromEntries(Object.entries(b.settings ?? {})
    .filter(([k, v]) => !['id', 'key', 'type'].includes(k) && ['string', 'number', 'boolean'].includes(typeof v) && !String(v).startsWith('data:'))
    .map(([k, v]) => [k, typeof v === 'string' ? str(v, 20000) : v]));
  const next: Widget = {
    ...(widget ?? { id: crypto.randomUUID(), type: b.type }), key, ...settings,
    ...(b.title !== undefined && { label: str(b.title, 100) }),
    ...(b.text !== undefined && { text: str(b.text, 20000) }),
  };
  if (widget) Object.assign(widget, next);
  else w.widgets.push(next);
  return widget ? 'updated' : 'created';
}

export function removeBlock(w: Workspace, key: string): boolean {
  const before = w.notes.length + w.widgets.length;
  w.notes = w.notes.filter((n) => n.key !== key);
  w.widgets = w.widgets.filter((x) => x.key !== key);
  return w.notes.length + w.widgets.length < before;
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
