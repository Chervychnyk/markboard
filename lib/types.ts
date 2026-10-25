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
  hidden?: boolean;
  fav?: boolean;
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

export interface Note { id: string; title: string; text: string; checklist: { text: string; done: boolean }[] }

/** A widget's own settings and state live on it; `type` picks its WIDGETS entry. */
export interface Widget { id: string; type: string; label?: string; [k: string]: unknown }

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
}

export interface Session { name: string; at: number; tabs: { title: string; url: string }[] }
export interface TrashEntry { node: BNode; at: number }
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
}
