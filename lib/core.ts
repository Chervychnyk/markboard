// Pure helpers and defaults (no browser APIs), shared by the pages and the background.
import type { BNode, Data, Look, Note, Workspace } from './types.ts';

export const favicon = (url: string) => `/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;

/** All bookmarks and folders below the root, depth-first. */
export function flatten(nodes: BNode[], out: BNode[] = []): BNode[] {
  for (const n of nodes) {
    if (n.parentId) out.push(n);
    if (n.children) flatten(n.children, out);
  }
  return out;
}

/** Every term must appear in title, URL or keywords; title-prefix matches rank first. */
export function search<T extends { title: string; url?: string; keywords?: string }>(items: T[], q: string, limit = 20): T[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const rank = (n: T) => {
    const t = n.title.toLowerCase();
    return t.startsWith(terms[0]!) ? 2 : t.includes(terms[0]!) ? 1 : 0;
  };
  return items
    .filter((n) => terms.every((t) => `${n.title} ${n.url ?? ''} ${n.keywords ?? ''}`.toLowerCase().includes(t)))
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, limit);
}

// Look is per workspace.
export const LOOK_DEFAULTS: Look = {
  theme: 'system', accent: '', font: 'system', compact: false, columns: 0, panelOpacity: 100,
  bgKind: 'none', bgPreset: 'custom', bgColor: '#1e293b', bgColor2: '#0f766e', bgImage: '', intensity: 100, grain: false, parallax: false,
};

export const newWorkspace = (name: string, look: Partial<Look> = {}): Workspace => ({
  name, look, notes: [], widgets: [{ id: crypto.randomUUID(), type: 'clock' }], hiddenCols: [], widths: {}, order: [], colNames: {}, colColors: {}, collapsed: [], hidden: [], favs: [], cols: [],
});

// --- Markboard's own tree: folders and links kept in storage, shaped like browser bookmarks ---

/** Root of the local tree; its parent '0' is the browser's root, so it sits beside Bookmarks bar and Other bookmarks. */
export const LOCAL_ROOT = 'mb';
export const isLocal = (id: string | undefined) => id === LOCAL_ROOT || !!id?.startsWith('mb:');
export const emptyLocal = (): BNode => ({ id: LOCAL_ROOT, parentId: '0', title: 'Markboard', children: [], syncing: false });

export function findNode(n: BNode, id: string): BNode | undefined {
  if (n.id === id) return n;
  for (const c of n.children ?? []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
}

/** Keeps `parentId` and `index` true after a change, as the browser does for its own nodes. */
export function reindex(n: BNode) {
  n.children?.forEach((c, i) => { c.parentId = n.id; c.index = i; reindex(c); });
}

/** Adds a link (with `url`) or folder under `parentId`; throws if that is not a local folder. */
export function insertNode(root: BNode, parentId: string, node: { title?: string; url?: string }, index?: number): BNode {
  const parent = findNode(root, parentId);
  if (!parent?.children) throw new Error(`No folder ${parentId}`);
  const made: BNode = {
    id: `mb:${crypto.randomUUID()}`, parentId, title: node.title ?? '', dateAdded: Date.now(), syncing: false,
    ...(node.url ? { url: node.url } : { children: [] }),
  };
  parent.children.splice(index ?? parent.children.length, 0, made);
  reindex(parent);
  return made;
}

/** Takes a node (and what is inside it) out of the tree and returns it. */
export function detachNode(root: BNode, id: string): BNode | undefined {
  const n = findNode(root, id);
  const parent = n?.parentId ? findNode(root, n.parentId) : undefined;
  if (!n || !parent?.children || n === root) return;
  parent.children.splice(parent.children.indexOf(n), 1);
  reindex(parent);
  return n;
}

/** Moves within the local tree with browser semantics: `index` counts the node still in its old place. */
export function moveNode(root: BNode, id: string, parentId: string, index?: number) {
  const n = findNode(root, id), parent = findNode(root, parentId);
  if (!n || !parent?.children || n === root) throw new Error(`No folder ${parentId}`);
  if (findNode(n, parentId)) throw new Error("Can't move a folder into itself");
  const from = n.parentId === parentId ? parent.children.indexOf(n) : -1;
  detachNode(root, id);
  const at = index === undefined ? parent.children.length : Math.min(index - (from >= 0 && from < index ? 1 : 0), parent.children.length);
  parent.children.splice(at, 0, n);
  reindex(parent);
}

/** A new workspace that starts as a copy of `w`: same layout and look, its own notes and widgets (fresh ids). */
export function copyWorkspace(w: Workspace, name: string): Workspace {
  const ids = new Map<string, string>();
  const fresh = <T extends { id: string }>(x: T): T => {
    const id = crypto.randomUUID();
    ids.set(x.id, id);
    return { ...structuredClone(x), id };
  };
  const notes = w.notes.map(fresh), widgets = w.widgets.map(fresh);
  // Layout keys name notes and widgets by id ("note:<id>", "widget:<id>"); point them at the copies.
  const key = (k: string) => k.replace(/^(note|widget):(.+)$/, (all, kind, id) => (ids.has(id) ? `${kind}:${ids.get(id)}` : all));
  const keyed = <V>(r: Record<string, V>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [key(k), v]));
  return {
    ...structuredClone(w), name, notes, widgets,
    order: w.order.map(key), hiddenCols: w.hiddenCols.map(key), collapsed: w.collapsed.map(key),
    widths: keyed(w.widths), colNames: keyed(w.colNames), colColors: keyed(w.colColors),
  };
}

export const DEFAULTS: Data = {
  meta: {}, showHidden: false, galleryMode: 'extended',
  workspaces: { default: { ...newWorkspace('Personal'), widgets: [{ id: 'clock', type: 'clock' }] } }, ws: 'default',
  sessions: [], trash: [], autoBackup: false, backupToDownloads: false, backups: [], lang: 'auto', hiddenTools: [], onboarded: false, local: emptyLocal(),
  sync: true, syncStatus: null,
};

/** Fills fields old or imported workspaces lack, and turns a v0.3 single-string note into a note list. */
export function normalizeWorkspace(w: Omit<Partial<Workspace>, 'notes'> & { notes?: Note[] | string; checklist?: Note['checklist'] }, notesTitle: string): Workspace {
  const out = { ...newWorkspace(''), widgets: [], ...w } as Workspace;
  if (typeof w.notes === 'string') out.notes = [{ id: crypto.randomUUID(), title: notesTitle, text: w.notes, checklist: w.checklist ?? [] }];
  out.name ||= notesTitle;
  return out;
}

const TYPES: Record<keyof Omit<Data, 'backups' | 'syncStatus'>, 'object' | 'array' | 'boolean' | 'string'> = {
  meta: 'object', showHidden: 'boolean', galleryMode: 'string', workspaces: 'object', ws: 'string',
  sessions: 'array', trash: 'array', autoBackup: 'boolean', backupToDownloads: 'boolean', lang: 'string', hiddenTools: 'array', onboarded: 'boolean', local: 'object', sync: 'boolean',
};

/** Validates an imported/restored backup at the trust boundary; throws on bad shape. */
export function sanitize(d: unknown): Partial<Data> {
  if (typeof d !== 'object' || d === null) throw new Error('not an object');
  const out: Record<string, unknown> = {};
  for (const [k, t] of Object.entries(TYPES)) {
    const v = (d as Record<string, unknown>)[k];
    if (v === undefined) continue;
    const ok = t === 'array' ? Array.isArray(v) : t === 'object' ? typeof v === 'object' && v && !Array.isArray(v) : typeof v === t;
    if (!ok) throw new Error(`bad ${k}`);
    out[k] = v;
  }
  if (out.workspaces && !Object.keys(out.workspaces).length) delete out.workspaces;
  if (out.local && !validLocal(out.local as BNode, true)) throw new Error('bad local');
  return out as Partial<Data>;
}

/** A local tree from a backup: folders and http(s) links only, under the `mb` root. */
function validLocal(n: BNode, root = false): boolean {
  if (typeof n !== 'object' || !n || typeof n.title !== 'string' || (root ? n.id !== LOCAL_ROOT : !isLocal(n.id))) return false;
  if (n.url !== undefined) return !root && typeof n.url === 'string' && /^https?:\/\//.test(n.url) && n.children === undefined;
  return Array.isArray(n.children) && n.children.every((c) => validLocal(c));
}

const pad = (n: number) => String(n).padStart(2, '0'); // taste-skill-ignore: clock/timer digits
export function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${hh}h ${m}m` : hh ? `${hh}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** Identifies the current day/week (Monday start)/month, so a counter knows when to reset. */
export function periodKey(reset: string | undefined, d = new Date()) {
  if (reset === 'day') return d.toDateString();
  if (reset === 'month') return `${d.getFullYear()}-${d.getMonth() + 1}`;
  if (reset === 'week') {
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    return 'week of ' + monday.toDateString();
  }
  return '';
}

/** A schedule widget's text: one "Label | when" per line, `when` anything Date parses (ISO with a zone is best). */
export function parseSchedule(text: string): { label: string; at: number }[] {
  return text.split('\n').map((l) => l.split('|').map((s) => s.trim()))
    .map(([label = '', when = '']) => ({ label, at: when ? new Date(when).getTime() : NaN }))
    .filter((s) => s.label && !Number.isNaN(s.at));
}

/** A table widget's text: rows of cells split by "|", the first row the header. Markdown tables read the same. */
export function parseTable(text: string): string[][] {
  return text.split('\n').map((l) => l.trim().replace(/^\||\|$/g, ''))
    .filter((l) => l.trim() && !/^[\s|:-]+$/.test(l))
    .map((l) => l.split('|').map((c) => c.trim()));
}

/** "2 hours ago", "yesterday", "now" in `locale`. */
export function ago(at: number, locale: string, now = Date.now()) {
  const s = Math.round((at - now) / 1000), rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, sec] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const)
    if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), unit);
  return rtf.format(0, 'second');
}

export const clamp = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || 0));
