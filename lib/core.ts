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
  name, look, notes: [], widgets: [{ id: crypto.randomUUID(), type: 'clock' }], hiddenCols: [], widths: {}, order: [], colNames: {}, colColors: {}, collapsed: [],
});

export const DEFAULTS: Data = {
  meta: {}, showHidden: false, galleryMode: 'extended',
  workspaces: { default: { ...newWorkspace('Personal'), widgets: [{ id: 'clock', type: 'clock' }] } }, ws: 'default',
  sessions: [], trash: [], autoBackup: false, backupToDownloads: false, backups: [], lang: 'auto', hiddenTools: [], onboarded: false,
};

/** Fills fields old or imported workspaces lack, and turns a v0.3 single-string note into a note list. */
export function normalizeWorkspace(w: Omit<Partial<Workspace>, 'notes'> & { notes?: Note[] | string; checklist?: Note['checklist'] }, notesTitle: string): Workspace {
  const out = { ...newWorkspace(''), widgets: [], ...w } as Workspace;
  if (typeof w.notes === 'string') out.notes = [{ id: crypto.randomUUID(), title: notesTitle, text: w.notes, checklist: w.checklist ?? [] }];
  out.name ||= notesTitle;
  return out;
}

const TYPES: Record<keyof Omit<Data, 'backups'>, 'object' | 'array' | 'boolean' | 'string'> = {
  meta: 'object', showHidden: 'boolean', galleryMode: 'string', workspaces: 'object', ws: 'string',
  sessions: 'array', trash: 'array', autoBackup: 'boolean', backupToDownloads: 'boolean', lang: 'string', hiddenTools: 'array', onboarded: 'boolean',
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
  return out as Partial<Data>;
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

export const clamp = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || 0));
