// State, persistence and actions. Components read `app`/`data`/`ui` and re-render on change.
import { SvelteSet } from 'svelte/reactivity';
import {
  copyWorkspace, DEFAULTS, detachNode, emptyLocal, findNode, flatten, insertNode, isLocal, LOCAL_ROOT, LOOK_DEFAULTS, moveNode, newWorkspace, normalizeWorkspace, sanitize,
} from './core.ts';
import NewItem from '@/components/NewItem.svelte';
import { form, modal, toast } from './dialogs.svelte.ts';
import { initLang, locale, t } from './i18n.ts';
import { type AgentRun, revertBlocks } from './agent.ts';
import type { BNode, Data, Look, Meta, Row, TrashEntry, Workspace } from './types.ts';
import { WIDGETS } from './widgets.ts';

export const COLORS = ['', 'red', 'orange', 'amber', 'lime', 'green', 'teal', 'blue', 'purple', 'pink'];
export const THEMES = ['system', 'light', 'dark', 'black'];
export const ACCENTS = ['#1d5fbf', '#0f766e', '#2f7d4f', '#b45309', '#b42318'];
export const FONTS: Record<string, string> = { system: '"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif', serif: 'Georgia, serif', mono: 'ui-monospace, Menlo, monospace', rounded: 'ui-rounded, system-ui, sans-serif' }; // taste-skill-ignore: user typeface choice
export const FONT_NAMES: Record<string, string> = { system: 'Sans', serif: 'Serif', mono: 'Mono', rounded: 'Rounded' };
export const PRESET_NAMES: Record<string, string> = { dusk: 'Dusk', ocean: 'Ocean', forest: 'Forest', ember: 'Ember', carbon: 'Carbon' };
export const PRESETS: Record<string, [string, string]> = { dusk: ['#1e1b4b', '#be185d'], ocean: ['#0c4a6e', '#14b8a6'], forest: ['#052e16', '#65a30d'], ember: ['#0c0a09', '#9f1239'], carbon: ['#09090b', '#3f3f46'] };
export const TRASH_DAYS = 7;
export const HEX = /^#[0-9a-f]{6}$/i;
export const DATA_IMG = /^data:image\/[\w+.-]+;base64,[\w+/=]+$/;

/** Persisted state; mutate in place, then save()/saveWs(). */
export const app = $state<Data>(structuredClone(DEFAULTS));

class Bookmarks {
  tree = $state.raw<BNode>({ id: '0', title: '', children: [] } as unknown as BNode);
  bar = $state.raw<BNode>({ id: '1', title: '', children: [] } as unknown as BNode);
  flat = $state.raw<BNode[]>([]);
  byId = $state.raw(new Map<string, BNode>());
  recent = $state.raw<BNode[]>([]);
  top = $state.raw<Row[]>([]);
}
/** The browser's bookmarks, re-read on every change. */
export const data = new Bookmarks();

/** Per-tab UI state. `view` is the folder id shown as a gallery (the URL hash). */
export const ui = $state({
  view: location.hash.slice(1) || null,
  sort: 'manual' as 'manual' | 'name' | 'date',
  selecting: false,
  selected: new SvelteSet<string>(),
  filterFav: false,
  filterColor: '',
  filterTag: '',
  menuId: null as string | null,
  menuRect: null as { top: number; left: number; right: number; bottom: number } | null,
  aside: true,
  /** set when a column's search button opens the gallery; the gallery focuses its search and clears it */
  focusSearch: false,
  /** where a dragged bookmark would land: before or after this row */
  dropHint: null as { id: string; after: boolean } | null,
  /** the column whose ⋮ menu is open, and where its header sits */
  /** the board's columns in layout order (Board keeps it current); the column menu moves within it */
  colOrder: [] as string[],
  colMenu: null as { k: string; title: string; folderId?: string; rect: { top: number; left: number; right: number; bottom: number } } | null,
});

export const save = (...keys: (keyof Data)[]) =>
  browser.storage.local.set(Object.fromEntries(keys.map((k) => [k, $state.snapshot(app[k])])));
export const saveWs = () => save('workspaces', 'ws');

export const ws = (): Workspace => app.workspaces[app.ws]!;
export const look = (): Look => ({ ...LOOK_DEFAULTS, ...ws().look });
export const wsRoot = () => data.byId.get(ws().root ?? '') ?? data.bar;
/** The board's folder columns: the root's subfolders, then folders added to this board alone (`cols`). */
export function wsFolders(): BNode[] {
  const own = (wsRoot().children ?? []).filter((n) => !n.url);
  const extra = ws().cols.map((id) => data.byId.get(id)).filter((n): n is BNode => !!n && !n.url && !own.includes(n));
  return [...own, ...extra];
}
export const metaOf = (n: Row): Meta => (n.id && app.meta[n.id]) || {};
export const isCollapsed = (key: string) => ws().collapsed.includes(key);
/** Hiding and favorites are per workspace: the bookmark stays as it was on every other board. */
export const isHidden = (id: string) => ws().hidden.includes(id);
export const isFav = (id: string) => ws().favs.includes(id);
export function mark(list: 'hidden' | 'favs', ids: string[], on: boolean) {
  const w = ws();
  w[list] = on ? [...new Set([...w[list], ...ids])] : w[list].filter((x) => !ids.includes(x));
  saveWs();
}
export const setHidden = (id: string, on: boolean) => mark('hidden', [id], on);
export function toggleCollapsed(key: string) {
  const w = ws();
  w.collapsed = isCollapsed(key) ? w.collapsed.filter((x) => x !== key) : [...w.collapsed, key];
  saveWs();
}

export const hasActiveFilter = () => ui.filterFav || !!ui.filterColor || !!ui.filterTag;
export function clearFilters() {
  ui.filterFav = false;
  ui.filterColor = '';
  ui.filterTag = '';
}

export function matchesFilter(n: Row): boolean {
  const m = metaOf(n);
  if (n.id && isHidden(n.id) && !app.showHidden) return false;
  if (ui.filterFav && !(n.id && isFav(n.id))) return false;
  if (ui.filterColor && m.color !== ui.filterColor) return false;
  if (ui.filterTag && !m.tags?.includes(ui.filterTag)) return false;
  return true;
}

export function sortRows<T extends Row>(rows: T[]): T[] {
  const out = [...rows];
  if (ui.sort === 'name') out.sort((a, b) => (a.title || '').localeCompare(b.title || '', locale));
  else if (ui.sort === 'date') out.sort((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0));
  return out;
}

export function allTags(): string[] {
  const found = new Set<string>();
  for (const n of data.flat) for (const tag of metaOf(n).tags ?? []) found.add(tag);
  return [...found].sort((a, b) => a.localeCompare(b, locale));
}

export function openItemMenu(id: string, anchor: Element) {
  if (ui.menuId === id) { closeItemMenu(); return; }
  const r = (anchor.closest('.item') ?? anchor).getBoundingClientRect(); // the menu lines up with the whole row
  ui.menuId = id;
  ui.menuRect = { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
}

export function closeItemMenu() {
  ui.menuId = null;
  ui.menuRect = null;
}

export function openColMenu(k: string, title: string, folderId: string | undefined, header: Element) {
  if (ui.colMenu?.k === k) { ui.colMenu = null; return; }
  const r = header.getBoundingClientRect();
  ui.colMenu = { k, title, folderId, rect: { top: r.top, left: r.left, right: r.right, bottom: r.bottom } };
}

/** Moves a column one step earlier or later in the board's layout order (lanes fill in that order). */
export function moveColumn(k: string, dir: -1 | 1) {
  // shortcut: while a filter hides columns, they drop out of this order and go last; merge with ws().order if that matters.
  const keys = [...ui.colOrder];
  const i = keys.indexOf(k), j = i + dir;
  if (i < 0 || j < 0 || j >= keys.length) return;
  [keys[i], keys[j]] = [keys[j]!, keys[i]!];
  ws().order = keys;
  saveWs();
}

/** The item menu's Hide and Delete, shared by its buttons and the H / Del keys. */
export function hideFromMenu() {
  const id = ui.menuId;
  if (!id) return;
  setHidden(id, !isHidden(id));
  closeItemMenu();
}

export function deleteFromMenu() {
  const id = ui.menuId;
  if (!id) return;
  closeItemMenu();
  removeMany([id]);
}

/** Fills what old or imported workspaces lack; the current one must exist. Not during render: it writes state. */
function normalize() {
  if (!Object.keys(app.workspaces).length) app.workspaces = structuredClone(DEFAULTS.workspaces);
  if (app.local?.id !== LOCAL_ROOT) app.local = emptyLocal();
  for (const [id, w] of Object.entries(app.workspaces)) app.workspaces[id] = normalizeWorkspace($state.snapshot(w), t('Notes'));
  if (!app.workspaces[app.ws]) app.ws = Object.keys(app.workspaces)[0]!;
}

export async function init() {
  const stored = await browser.storage.local.get(null);
  initLang(stored.lang as string | undefined);
  Object.assign(app, stored);
  normalize();
  app.trash = app.trash.filter((x) => Date.now() - x.at < TRASH_DAYS * 864e5);
  save('trash', 'workspaces', 'ws');
}

export async function refresh() {
  const [tree] = await browser.bookmarks.getTree();
  const local = $state.snapshot(app.local) as BNode;
  const flat = flatten([...tree!.children ?? [], local]);
  let recent: BNode[];
  [recent, data.top] = await Promise.all([browser.bookmarks.getRecent(12), browser.topSites.get()]);
  const localLinks = flat.filter((n) => n.url && isLocal(n.id));
  data.recent = [...recent, ...localLinks].sort((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0)).slice(0, 12);
  data.tree = tree!;
  data.bar = tree!.children![0]!;
  data.flat = flat;
  data.byId = new Map(flat.map((n) => [n.id, n]));
}

export const open = (id: string | null) => { location.hash = id ?? ''; };
export const isDue = (m: Meta) => !!m.remind && new Date(m.remind).getTime() <= Date.now();
export const folderOptions = (): [string, string][] => data.flat.filter((n) => !n.url)
  .map((f) => [f.id, (data.byId.get(f.parentId!) ? data.byId.get(f.parentId!)!.title + ' › ' : '') + f.title]);

export function setMeta(id: string, patch: Meta) {
  app.meta[id] = { ...app.meta[id], ...patch };
  save('meta');
}

export function setRemind(id: string, remind: string) {
  const alarm = `remind:${id}`;
  if (remind) browser.alarms.create(alarm, { when: new Date(remind).getTime() });
  else browser.alarms.clear(alarm);
  setMeta(id, { remind });
}

// --- bookmarks: the browser's, or Markboard's own ---

/** Local links are web pages only: the browser vets its own bookmarks' URLs, Markboard vets these. */
const WEB_URL = /^https?:\/\/\S+$/;

/** Writes the local tree and re-reads the board; the browser's own changes arrive through its events. */
function commitLocal() {
  save('local');
  return refresh();
}

/** The `browser.bookmarks` calls the board makes, for either tree: ids under `mb` are Markboard's own. */
export const bm = {
  async get(id: string): Promise<BNode[]> {
    if (!isLocal(id)) return browser.bookmarks.get(id);
    const n = findNode(app.local, id);
    if (!n) throw new Error(`No bookmark ${id}`);
    return [$state.snapshot(n) as BNode];
  },
  getSubTree: (id: string) => (isLocal(id) ? bm.get(id) : browser.bookmarks.getSubTree(id)),
  async create(o: { parentId: string; index?: number; title?: string; url?: string }): Promise<BNode> {
    if (!isLocal(o.parentId)) return browser.bookmarks.create(o);
    if (o.url !== undefined && !WEB_URL.test(o.url)) throw new Error(t('Invalid URL'));
    const made = $state.snapshot(insertNode(app.local, o.parentId, o, o.index)) as BNode;
    await commitLocal();
    return made;
  },
  async update(id: string, o: { title?: string; url?: string }) {
    if (!isLocal(id)) return void await browser.bookmarks.update(id, o);
    const n = findNode(app.local, id);
    if (!n) throw new Error(`No bookmark ${id}`);
    if (o.title !== undefined) n.title = o.title;
    if (o.url !== undefined && n.url !== undefined) {
      if (!WEB_URL.test(o.url)) throw new Error(t('Invalid URL'));
      n.url = o.url;
    }
    await commitLocal();
  },
  /** Between the two trees a move is a copy then a removal: the node gets a new id, its meta and marks follow it. */
  async move(id: string, o: { parentId: string; index?: number }) {
    if (isLocal(id) !== isLocal(o.parentId)) return void await transfer(id, o.parentId, o.index);
    if (!isLocal(id)) return void await browser.bookmarks.move(id, o);
    moveNode(app.local, id, o.parentId, o.index);
    await commitLocal();
  },
  async removeTree(id: string) {
    if (!isLocal(id)) return browser.bookmarks.removeTree(id);
    if (id === LOCAL_ROOT || !detachNode(app.local, id)) throw new Error(`No bookmark ${id}`);
    await commitLocal();
  },
};

async function transfer(id: string, parentId: string, index?: number) {
  const [node] = await bm.getSubTree(id);
  if (!node) return;
  const ids = new Map<string, string>();
  await restore(node, parentId, index, ids);
  await bm.removeTree(id);
  for (const old of ids.keys()) { delete app.meta[old]; browser.alarms.clear(`remind:${old}`); }
  save('meta');
  reassign(ids);
}

/** Points every workspace's marks and column layout at re-created nodes (old id → new id). */
function reassign(ids: Map<string, string>) {
  const id = (x: string) => ids.get(x) ?? x;
  const keyed = <V>(r: Record<string, V>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [id(k), v]));
  for (const w of Object.values(app.workspaces)) {
    if (w.root) w.root = id(w.root);
    for (const list of ['favs', 'hidden', 'cols', 'collapsed', 'order', 'hiddenCols'] as const) w[list] = w[list].map(id);
    w.widths = keyed(w.widths); w.colNames = keyed(w.colNames); w.colColors = keyed(w.colColors);
  }
  saveWs();
}

export async function moveStep(id: string, dir: 'up' | 'down' | 'left' | 'right') {
  const n = data.byId.get(id);
  if (!n || !n.parentId) return;
  if (dir === 'up' || dir === 'down') {
    const siblings = data.byId.get(n.parentId)?.children ?? [];
    const idx = siblings.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const next = dir === 'up' ? Math.max(0, idx - 1) : Math.min(siblings.length, idx + 2);
    await bm.move(id, { parentId: n.parentId, index: next }).catch((e) => toast(e.message));
    await refresh();
  } else {
    const folders = [wsRoot(), ...wsFolders()];
    const curIdx = folders.findIndex((f) => f.id === n.parentId);
    if (curIdx < 0) return;
    const target = folders[(curIdx + (dir === 'left' ? -1 : 1) + folders.length) % folders.length];
    if (target && target.id !== n.parentId) {
      await bm.move(id, { parentId: target.id }).catch((e) => toast(e.message));
      await refresh();
    }
  }
}

export const createBookmark = (folder?: string) => modal('', NewItem, { bare: true, kind: 'bookmark', folder });
export const createFolder = (folder?: string) => modal('', NewItem, { bare: true, kind: 'folder', folder });

export async function edit(n: BNode) {
  const m = app.meta[n.id] ?? {};
  const v = await form(n.url ? t('Edit bookmark') : t('Edit folder'), [
    { name: 'title', label: t('Title'), value: n.title },
    ...(n.url ? [{ name: 'url', label: t('URL'), type: 'url', value: n.url, required: true }] : []),
    { name: 'folder', label: t('Folder'), type: 'select', value: n.parentId, options: folderOptions().filter(([id]) => id !== n.id) },
    { name: 'tags', label: t('Tags (comma separated)'), value: (m.tags ?? []).join(', ') },
    { name: 'comment', label: t('Comment (shown on hover)'), type: 'textarea', value: m.comment },
    { name: 'icon', label: t('Custom icon (emoji or character)'), value: m.icon, maxlength: 8 },
    { name: 'remind', label: t('Remind me at'), type: 'datetime-local', value: m.remind },
    { name: 'pinned', label: t('Pin to the top bar'), type: 'checkbox', value: m.pinned },
    { name: 'hidden', label: t('Hide from the board'), type: 'checkbox', value: isHidden(n.id) },
  ]);
  if (!v) return;
  try {
    await bm.update(n.id, n.url ? { title: v.title, url: v.url } : { title: v.title });
    if (v.folder !== n.parentId) await bm.move(n.id, { parentId: v.folder });
  } catch (e) {
    return toast((e as Error).message);
  }
  setRemind(n.id, v.remind);
  setHidden(n.id, v.hidden);
  setMeta(n.id, {
    tags: v.tags.split(',').map((tag: string) => tag.trim().replace(/^#/, '')).filter(Boolean),
    comment: v.comment, icon: v.icon, remind: v.remind, pinned: v.pinned,
  });
}

/** Drop on an item inserts before it; drop on empty space appends. */
/** Whether a drag over this row means "after it": its lower half, or its right half in a tile grid. */
export function dropsAfter(e: DragEvent, row: Element) {
  const r = row.getBoundingClientRect();
  return row.closest('.gallery:not(.mode-list)') ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
}

export async function dropBookmark(e: DragEvent, parentId: string) {
  ui.dropHint = null;
  const id = e.dataTransfer?.getData('text/bookmark');
  if (!id) return;
  const row = (e.target as Element).closest<HTMLElement>('.item');
  const target = row?.dataset.id;
  const opts: { parentId: string; index?: number } = { parentId };
  if (row && target && target !== id) {
    const [at] = await bm.get(target);
    // move() counts the index before the dragged node leaves its place, so "after" is simply index + 1.
    if (at?.parentId === parentId && at.index !== undefined) opts.index = at.index + (dropsAfter(e, row) ? 1 : 0);
  }
  bm.move(id, opts).catch((err) => toast(err.message));
}

// --- trash ---

export async function removeMany(ids: string[]) {
  const entries: TrashEntry[] = [];
  for (const id of ids) {
    const [node] = await bm.getSubTree(id).catch(() => []); // gone already if an ancestor was selected too
    if (!node) continue;
    await bm.removeTree(id);
    entries.push({ node, at: Date.now() });
  }
  if (!entries.length) return;
  app.trash.unshift(...entries);
  save('trash');
  const what = entries.length === 1 ? t('Moved “{0}” to trash', entries[0]!.node.title || entries[0]!.node.url) : t('Moved to trash: {0}', entries.length);
  toast(what, t('Undo'), async () => { for (const e of [...entries].reverse()) await untrash(e); });
}

export async function untrash(entry: TrashEntry) {
  const { node } = entry;
  const ids = new Map<string, string>();
  for (const n of [node, ...entry.board?.extra ?? []]) {
    const parentOk = await bm.get(n.parentId!).then(() => true, () => false);
    await restore(n, parentOk ? n.parentId! : isLocal(n.id) ? LOCAL_ROOT : wsRoot().id, parentOk ? n.index : undefined, ids);
  }
  if (entry.board) app.workspaces[entry.board.id] = entry.board.w;
  reassign(ids);
  if (entry.board) switchWs(entry.board.id);
  app.trash = app.trash.filter((x) => x.at !== entry.at || x.node.id !== entry.node.id);
  save('trash');
}

/** Undoes the last agent run (lib/bridge.ts records it): blocks back as they were, links it made removed,
 *  renamed ones renamed back, comments restored, and what it trashed restored. */
export async function undoAgentRun() {
  const { agentRun: r } = (await browser.storage.local.get('agentRun')) as { agentRun?: AgentRun };
  if (!r) return;
  await browser.storage.local.remove('agentRun');
  revertBlocks(app.workspaces, r);
  for (const id of [...r.created].reverse()) await bm.removeTree(id).catch(() => {}); // gone already, or inside one removed first
  for (const [id, title] of r.retitled) await bm.update(id, { title }).catch(() => {});
  for (const [id, m] of Object.entries(r.meta)) {
    if (m) app.meta[id] = m;
    else delete app.meta[id];
  }
  for (const e of r.trashed) {
    const entry = app.trash.find((x) => x.at === e.at && x.node.id === e.node.id);
    if (entry) await untrash(entry);
  }
  save('meta');
  saveWs();
  toast(t('Undid Claude’s changes'));
}

/** Re-creates a subtree under `parentId` with its meta; `ids` collects old id → new id. */
async function restore(n: BNode, parentId: string, index?: number, ids = new Map<string, string>()) {
  const made = await bm.create({ parentId, index, title: n.title, url: n.url })
    .catch(() => bm.create({ parentId, title: n.title, url: n.url })); // index may be out of range now
  ids.set(n.id, made.id);
  const m = app.meta[n.id] && $state.snapshot(app.meta[n.id]!);
  if (m) setMeta(made.id, m);
  if (m?.remind) setRemind(made.id, m.remind);
  for (const c of n.children ?? []) await restore(c, made.id, undefined, ids);
}

export function emptyTrash() {
  app.trash = [];
  save('trash');
  toast(t('Trash emptied'));
}

// --- duplicates ---

export function duplicateGroups() {
  const groups = new Map<string, BNode[]>();
  for (const n of data.flat) if (n.url) {
    const k = n.url.replace(/\/$/, '');
    groups.set(k, [...(groups.get(k) ?? []), n]);
  }
  return [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => (a.dateAdded ?? 0) - (b.dateAdded ?? 0)));
}

/** Keeps the oldest copy of each link and carries tags, favorites, pins and comments over to it. */
export async function dedupe(groups: BNode[][]) {
  for (const g of groups) {
    const metas = g.map((n) => app.meta[n.id]).filter((m): m is Meta => !!m).map((m) => $state.snapshot(m));
    if (!metas.length) continue;
    app.meta[g[0]!.id] = {
      ...Object.assign({}, ...[...metas].reverse()), // the kept copy's own color/icon win
      tags: [...new Set(metas.flatMap((m) => m.tags ?? []))],
      pinned: metas.some((m) => m.pinned),
      comment: [...new Set(metas.map((m) => m.comment).filter(Boolean))].join('\n'),
    };
  }
  for (const w of Object.values(app.workspaces)) for (const g of groups) if (g.some((n) => w.favs.includes(n.id))) w.favs.push(g[0]!.id);
  save('meta');
  saveWs();
  await removeMany(groups.flatMap((g) => g.slice(1).map((n) => n.id)));
}

// --- selection ---

let anchor = '';

export function toggleSelect() {
  ui.selecting = !ui.selecting;
  ui.selected.clear();
  anchor = '';
}

/** Click toggles one item; Shift-click selects everything between the last click and this one, in page order. */
export function toggleSel(id: string, range = false) {
  const ids = range && anchor ? [...document.querySelectorAll<HTMLElement>('.item[data-id]')].map((el) => el.dataset.id!) : [];
  const [a, b] = [ids.indexOf(anchor), ids.indexOf(id)];
  if (a >= 0 && b >= 0) for (const x of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) ui.selected.add(x);
  else if (ui.selected.has(id)) ui.selected.delete(id);
  else ui.selected.add(id);
  anchor = id;
}

export function bulkMeta(nodes: BNode[], patch: Meta) {
  for (const n of nodes) app.meta[n.id] = { ...app.meta[n.id], ...patch };
  save('meta');
}

// --- tabs & sessions ---

/** The window's web tabs. permissions.request needs a user gesture, which a command run from Tabkit lacks:
 *  then a toast asks, and its button (a real click) retries. */
async function openTabs(retry: () => void) {
  const ok = await browser.permissions.request({ permissions: ['tabs'] }).catch(() => null);
  if (ok === null) return void toast(t('Markboard needs access to your tabs'), t('Allow'), retry);
  if (!ok) return null;
  return (await browser.tabs.query({ currentWindow: true }))
    .filter((tab) => /^https?:/.test(tab.url ?? ''))
    .map((tab) => ({ title: tab.title ?? '', url: tab.url! }));
}

export async function saveTabs() {
  const tabs = await openTabs(saveTabs);
  if (!tabs) return;
  const folder = await bm.create({ parentId: wsRoot().id, title: `${t('Tabs')} ${new Date().toLocaleString(locale)}` });
  for (const tab of tabs) await bm.create({ parentId: folder.id, ...tab });
  toast(t('Tabs saved: {0} → “{1}”', tabs.length, folder.title));
}

export async function saveSession() {
  const tabs = await openTabs(saveSession);
  if (!tabs) return;
  const v = await form(t('Save session'), [{ name: 'name', label: t('Name'), value: new Date().toLocaleString(locale), required: true }]);
  if (!v) return;
  app.sessions.unshift({ name: v.name, at: Date.now(), tabs });
  save('sessions');
  toast(t('Session saved: “{0}” ({1})', v.name, tabs.length));
}

export function deleteSession(i: number) {
  const s = $state.snapshot(app.sessions[i]!);
  app.sessions.splice(i, 1);
  save('sessions');
  toast(t('Deleted session “{0}”', s.name), t('Undo'), () => { app.sessions.splice(i, 0, s); save('sessions'); });
}

export function openAll(folderId: string) {
  const urls = (data.byId.get(folderId)?.children ?? []).filter((n) => n.url).map((n) => n.url!);
  if (!urls.length) return toast(t('No links in this folder'));
  for (const url of urls) browser.tabs.create({ url, active: false });
}

// --- notes ---

export function newNote() {
  const id = crypto.randomUUID();
  ws().notes.push({ id, title: t('Note'), text: '', checklist: [] });
  saveWs();
  setTimeout(() => document.querySelector<HTMLElement>(`[data-key="note:${id}"] textarea`)?.focus(), 50); // after the re-render
}

export function deleteNote(id: string) {
  const notes = ws().notes, i = notes.findIndex((n) => n.id === id);
  if (i < 0) return;
  const note = $state.snapshot(notes[i]!);
  notes.splice(i, 1);
  saveWs();
  toast(t('Deleted note “{0}”', ws().colNames['note:' + id] || note.title), t('Undo'), () => { notes.splice(i, 0, note); saveWs(); });
}

// --- gallery ---

export async function bulkRename() {
  const folder = data.byId.get(ui.view ?? '');
  if (!folder) return;
  const v = await form(t('Bulk rename in this folder'), [
    { name: 'find', label: t('Find'), required: true },
    { name: 'replace', label: t('Replace with') },
    { name: 'regex', label: t('Regular expression ($1 etc. allowed in replacement)'), type: 'checkbox' },
  ]);
  if (!v) return;
  let re: RegExp;
  try { re = new RegExp(v.regex ? v.find : v.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); } catch { return toast(t('Invalid regular expression')); }
  const changed: [string, string][] = [];
  for (const k of folder.children ?? []) {
    const title = v.regex ? k.title.replace(re, v.replace) : k.title.replace(re, () => v.replace);
    if (title !== k.title) { await bm.update(k.id, { title }); changed.push([k.id, k.title]); }
  }
  toast(t('Renamed: {0}', changed.length), changed.length ? t('Undo') : null,
    async () => { for (const [id, title] of changed) await bm.update(id, { title }); });
}

// --- backups & templates ---

export function snapshot(): Partial<Data> {
  const out = $state.snapshot(app) as Partial<Data> & Pick<Data, 'meta'>;
  delete out.backups;
  // Keep URLs next to meta so it can be re-attached on another machine, where bookmark ids differ.
  for (const [id, m] of Object.entries(out.meta)) if (data.byId.get(id)?.url) m.url = data.byId.get(id)!.url;
  return out;
}

function remapMeta(meta: Record<string, Meta>) {
  const byUrl = new Map(data.flat.filter((n) => n.url).map((n) => [n.url!, n.id]));
  return Object.fromEntries(Object.entries(meta).map(([id, m]) =>
    [m?.url && data.byId.get(id)?.url !== m.url && byUrl.has(m.url) ? byUrl.get(m.url)! : id, m]));
}

export async function applyData(input: unknown) {
  let clean: Partial<Data>;
  try { clean = sanitize(input); } catch { return toast(t('That file is not a Markboard backup')); }
  const before = snapshot();
  if (clean.meta) clean.meta = remapMeta(clean.meta);
  Object.assign(app, clean);
  normalize();
  await save(...(Object.keys(clean) as (keyof Data)[]), 'workspaces', 'ws');
  toast(t('Backup restored'), t('Undo'), () => applyData(before));
}

export function exportData() {
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: `markboard-backup-${new Date().toISOString().slice(0, 10)}.json`,
  }).click();
}

type Template = {
  template?: string;
  folders?: { title?: string; links?: { title?: string; url?: string; comment?: string }[] }[];
  workspace?: { name?: string; look?: object; widgets?: Record<string, unknown>[]; notes?: { key?: string; title?: string; text?: string; checklist?: string[] }[]; hiddenCols?: unknown[] };
};

/** Templates create folders, under Other bookmarks or in Markboard alone (`local`), plus a workspace showing them.
 *  By default they follow the current board: Markboard-only when its root is. */
export async function applyTemplate(tpl: Template, name?: string, local = isLocal(wsRoot().id)) {
  const w = tpl?.workspace;
  if (tpl?.template !== 'markboard' || typeof w !== 'object' || !Array.isArray(tpl.folders)) return toast(t('That file is not a Markboard template'));
  const str = (v: unknown, max = 2000) => String(v ?? '').slice(0, max);
  const arr = <T,>(v: T[] | undefined) => (Array.isArray(v) ? v : []);
  const title = str(name || w.name, 100) || t('Template');
  const rootFolder = await bm.create({ parentId: local ? LOCAL_ROOT : data.tree.children![1]!.id, title });
  for (const f of tpl.folders) {
    const folder = await bm.create({ parentId: rootFolder.id, title: str(f?.title, 100) });
    for (const l of arr(f?.links)) {
      if (!WEB_URL.test(l?.url ?? '')) continue;
      const b = await bm.create({ parentId: folder.id, title: str(l.title, 300) || l.url, url: l.url });
      if (l.comment) app.meta[b.id] = { comment: str(l.comment) };
    }
  }
  const id = crypto.randomUUID();
  const lookIn = typeof w.look === 'object' && w.look ? w.look : {};
  app.workspaces[id] = {
    ...newWorkspace(title),
    root: rootFolder.id,
    look: Object.fromEntries(Object.entries(lookIn).filter(([k, v]) => k in LOOK_DEFAULTS && k !== 'bgImage' && typeof v !== 'object')),
    widgets: arr(w.widgets).filter((x) => WIDGETS[x?.type as string])
      .map((x) => ({ ...Object.fromEntries(Object.entries(x).filter(([, v]) => typeof v !== 'object')), type: x.type as string, id: crypto.randomUUID() })),
    notes: arr(w.notes).map((n) => ({
      id: crypto.randomUUID(), ...(n?.key && { key: str(n.key, 100) }), title: str(n?.title, 100) || t('Note'), text: str(n?.text, 20000),
      checklist: arr(n?.checklist).map((c) => ({ text: str(c, 300), done: false })),
    })),
    hiddenCols: arr(w.hiddenCols).filter((k): k is string => typeof k === 'string'),
  };
  app.ws = id;
  save('meta');
  saveWs();
  toast(t('Created workspace “{0}”', app.workspaces[id].name));
}

export const loadTemplate = async (file: string, name?: string, local?: boolean) =>
  applyTemplate(await (await fetch(`/templates/${file}.json`)).json(), name, local);

export async function importFile(file: File) {
  try {
    const input = JSON.parse(await file.text());
    await (input?.template === 'markboard' ? applyTemplate(input) : applyData(input));
  } catch {
    toast(t('Could not read that file'));
  }
}

// --- look & navigation ---

export function cycleTheme() {
  ws().look.theme = THEMES[(THEMES.indexOf(look().theme) + 1) % THEMES.length];
  saveWs();
}

/** V: cycle gallery layouts, or toggle compact rows on the board. */
export function cycleView() {
  if (ui.view) {
    const modes = ['compact', 'extended', 'list'];
    app.galleryMode = modes[(modes.indexOf(app.galleryMode) + 1) % modes.length]!;
    save('galleryMode');
  } else {
    ws().look.compact = !look().compact;
    saveWs();
  }
}

export const switchWs = (id: string) => { app.ws = id; saveWs(); };

/** Like Pikamark, a new workspace starts as a copy of the current one; `empty` keeps only the look,
 *  `blank` also gives it a new Markboard folder as its root, so its columns live outside the browser's bookmarks. */
export async function addWorkspace(name: string, start: 'copy' | 'empty' | 'blank' = 'copy') {
  const id = crypto.randomUUID();
  const cur = $state.snapshot(ws());
  const w = start === 'copy' ? copyWorkspace(cur, name) : newWorkspace(name, cur.look);
  if (start === 'blank') w.root = (await bm.create({ parentId: LOCAL_ROOT, title: name })).id;
  app.workspaces[id] = w;
  switchWs(id);
}



/** Markboard folders only this board shows (its root, its own columns), outermost first: they go when it goes. */
function ownFolders(id: string): string[] {
  const w = app.workspaces[id]!;
  const within = (inner: string, outer: string) => {
    for (let n = data.byId.get(inner); n; n = data.byId.get(n.parentId ?? '')) if (n.id === outer) return true;
    return false;
  };
  const others = Object.entries(app.workspaces).filter(([k]) => k !== id).flatMap(([, o]) => [o.root ?? data.bar.id, ...o.cols]);
  const mine = [w.root, ...w.cols].filter((f): f is string => !!f && isLocal(f) && f !== LOCAL_ROOT && data.byId.has(f));
  return mine
    .filter((f) => !others.some((o) => within(o, f) || within(f, o)))
    .filter((f, _, all) => !all.some((g) => g !== f && within(f, g)));
}

/** A board on Markboard folders takes them to the trash with it, as one entry that restores the whole board. */
export async function deleteWorkspace() {
  const id = app.ws, old = $state.snapshot(ws());
  const folders = ownFolders(id);
  delete app.workspaces[id];
  app.ws = Object.keys(app.workspaces)[0]!;
  saveWs();
  if (!folders.length)
    return toast(t('Deleted workspace “{0}”', old.name), t('Undo'), () => { app.workspaces[id] = old; switchWs(id); });
  const nodes: BNode[] = [];
  for (const f of folders) {
    const [n] = await bm.getSubTree(f);
    await bm.removeTree(f);
    nodes.push(n!);
  }
  const entry: TrashEntry = { node: nodes[0]!, at: Date.now(), board: { id, w: old, extra: nodes.slice(1) } };
  app.trash.unshift(entry);
  save('trash');
  toast(t('Deleted workspace “{0}” and its Markboard folders', old.name), t('Undo'), () => untrash(entry));
}

/** Bookmark, URL-hash and cross-tab changes. */
export function startSync() {
  let pending: ReturnType<typeof setTimeout>;
  const schedule = () => { clearTimeout(pending); pending = setTimeout(refresh, 50); };
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered'] as const) browser.bookmarks[ev].addListener(schedule);
  addEventListener('hashchange', () => { ui.view = location.hash.slice(1) || null; });
  // Background tabs pick up changes made in the visible one; the visible tab is the writer.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const st = app as unknown as Record<string, unknown>;
    // Taken even by the visible tab: the local tree (the popup writes it), and whatever sync or an agent brought in.
    const synced = 'syncedAt' in changes || 'agentAt' in changes;
    for (const [k, { newValue }] of Object.entries(changes))
      if (k in DEFAULTS && (document.hidden || synced || ['backups', 'local', 'syncStatus'].includes(k))) st[k] = newValue ?? structuredClone(DEFAULTS[k as keyof Data]);
    if ((document.hidden || synced) && 'workspaces' in changes) normalize();
    if ('local' in changes) schedule();
    const run = changes.agentRun?.newValue as AgentRun | undefined;
    if (run && !document.hidden) toast(t('Claude updated {0}', run.boards.join(', ')), t('Undo'), undoAgentRun);
  });
}
