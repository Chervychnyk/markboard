import type { Browser } from 'wxt/browser';

export type BNode = Browser.bookmarks.BookmarkTreeNode;
/** A row on the board: a bookmark/folder, or a top site (no id). */
export type Row = Pick<BNode, 'title' | 'url'> & Partial<BNode>;

/** Extras Markboard keeps per bookmark id. `url` is only set in backups, to re-attach meta on another machine. */
export interface Meta {
  tags?: string[];
  comment?: string;
  icon?: string;
  remind?: string;
  pinned?: boolean;
  color?: string;
  url?: string;
}

export interface Look {
  theme: string;
  accent: string;
  font: string;
  compact: boolean;
  columns: number;
  panelOpacity: number;
  bgKind: string;
  bgPreset: string;
  bgColor: string;
  bgColor2: string;
  bgImage: string;
  intensity: number;
  grain: boolean;
  parallax: boolean;
}

/** `key` names a note or widget for whoever fills it in (a template, an agent), so an update replaces it instead of adding one. */
/** `agentAt`: when an agent last wrote it, shown on the block until the user edits it. */
export interface Note { id: string; key?: string; agentAt?: number; title: string; text: string; checklist: { text: string; done: boolean }[] }

/** A widget's own settings and state live on it; `type` picks its WIDGETS entry. */
export interface Widget { id: string; key?: string; agentAt?: number; type: string; label?: string; [k: string]: unknown }

export interface Workspace {
  name: string;
  /** folder shown as columns; the bookmarks bar when unset */
  root?: string;
  look: Partial<Look>;
  notes: Note[];
  widgets: Widget[];
  hiddenCols: string[];
  widths: Record<string, number>;
  order: string[];
  colNames: Record<string, string>;
  colColors: Record<string, string>;
  /** columns and subfolders folded to their header */
  collapsed: string[];
  /** bookmarks and folders hidden from this workspace's board only */
  hidden: string[];
  /** favorites of this workspace */
  favs: string[];
  /** folders shown as columns besides the root's own: Markboard folders made on this board */
  cols: string[];
}

/** The background's last sync: when, how big (of about 100 KB), and why it failed ('size', or the browser's message). */
export interface SyncStatus { at: number; bytes: number; error?: string }

export interface Session { name: string; at: number; tabs: { title: string; url: string }[] }
/** `board`: a deleted workspace whose Markboard folders went with it (`node` and `extra`); restoring brings back all. */
export interface TrashEntry { node: BNode; at: number; board?: { id: string; w: Workspace; extra: BNode[] } }
export interface Backup { date: number; data: Partial<Data> }

/** Everything Markboard stores in chrome.storage.local, one key per field. */
export interface Data {
  meta: Record<string, Meta>;
  showHidden: boolean;
  galleryMode: string;
  workspaces: Record<string, Workspace>;
  ws: string;
  sessions: Session[];
  trash: TrashEntry[];
  autoBackup: boolean;
  backupToDownloads: boolean;
  backups: Backup[];
  lang: string;
  /** toolbar and dock items the user turned off in Settings → Toolbar & header */
  hiddenTools: string[];
  /** the first-run welcome was shown */
  onboarded: boolean;
  /** Markboard's own folders and links, kept out of the browser's bookmarks; `mb` ids (see core.ts) */
  local: BNode;
  /** sync `local`, its meta and the boards on it through the browser account (lib/sync.ts) */
  sync: boolean;
  syncStatus: SyncStatus | null;
}
