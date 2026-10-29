// Syncs Markboard's own folders, their meta and the boards built on them through chrome.storage.sync.
// The background runs it; board tabs only see storage.local change (with `syncedAt`, so a visible tab takes it too).
import { toBase64 } from './backup.ts';
import { findNode, isLocal, reindex } from './core.ts';
import type { BNode, Data, Meta, SyncStatus, Workspace } from './types.ts';

/** What travels: the local tree, meta of its nodes, and boards whose root is in it (other roots are browser ids,
 *  different on every machine). Photos stay behind: storage.sync holds about 100 KB in all. */
export interface Payload { local: BNode; meta: Record<string, Meta>; workspaces: Record<string, Workspace> }
type Synced = Pick<Data, 'local' | 'meta' | 'workspaces' | 'ws'>;

const HEAD = 'sync:head';
const CHUNK = 7000; // per item: 8 KB with key and quotes
const QUOTA = 100_000;
const IMAGE = /^data:image\//;

const synced = (w: Workspace) => isLocal(w.root);
const stripImages = <T>(v: T): T => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === 'string' && IMAGE.test(x) ? undefined : x)));

export function payloadOf(d: Pick<Data, 'local' | 'meta' | 'workspaces'>): Payload {
  return {
    local: d.local,
    meta: Object.fromEntries(Object.entries(d.meta).filter(([id]) => isLocal(id))),
    workspaces: stripImages(Object.fromEntries(Object.entries(d.workspaces).filter(([, w]) => synced(w)))),
  };
}

/** JSON with sorted keys, so the same state always hashes the same on every machine. */
export const canonical = (v: unknown) => JSON.stringify(v, (_, x) =>
  x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x);

/** Puts back the photos stripImages left out, from this machine's copy (list entries matched by id). */
export function refill<T>(to: T, from: unknown): T {
  if (!to || typeof to !== 'object' || !from || typeof from !== 'object') return to;
  if (Array.isArray(to)) {
    const src = Array.isArray(from) ? (from as { id?: unknown }[]) : [];
    return to.map((x) => refill(x, src.find((y) => y?.id !== undefined && y.id === x?.id))) as T;
  }
  const out = { ...to } as Record<string, unknown>;
  for (const [k, v] of Object.entries(from)) {
    if (typeof v === 'string' && IMAGE.test(v) && !(k in out)) out[k] = v;
    else if (k in out) out[k] = refill(out[k], v);
  }
  return out as T;
}

/** `a` with what only `b` has added: a node keeps `a`'s place; one only in `b` goes under its parent there. */
export function mergeTree(a: BNode, b: BNode): BNode {
  const out = structuredClone(a);
  const fresh = (n: BNode): BNode => ({ ...n, ...(n.children && { children: n.children.filter((c) => !findNode(out, c.id)).map(fresh) }) });
  const add = (n: BNode, parentId: string) => {
    if (findNode(out, n.id)) {
      for (const c of n.children ?? []) add(c, n.id);
      return;
    }
    const parent = findNode(out, parentId);
    (parent?.children ? parent : out).children!.push(fresh(structuredClone(n)));
  };
  for (const c of b.children ?? []) add(c, b.id);
  reindex(out);
  return out;
}

/** The remote payload applied to this machine's state; `merge` keeps what only this machine has (first sync, or
 *  both sides changed), else the remote is the truth, deletions included. */
export function applyPayload(d: Synced, p: Payload, merge: boolean): Synced {
  const mine = payloadOf(d);
  const keep = <V>(r: Record<string, V>, drop: (k: string, v: V) => boolean) => Object.fromEntries(Object.entries(r).filter(([k, v]) => !drop(k, v)));
  const workspaces = {
    ...keep(d.workspaces, (_, w) => synced(w) && !merge), // boards on browser folders stay; synced ones only when merging
    ...Object.fromEntries(Object.entries(p.workspaces).map(([id, w]) => [id, refill(w, d.workspaces[id])])),
  };
  return {
    local: merge ? mergeTree(p.local, d.local) : p.local,
    meta: { ...keep(d.meta, (id) => isLocal(id)), ...(merge ? mine.meta : {}), ...p.meta },
    workspaces,
    ws: workspaces[d.ws] ? d.ws : Object.keys(workspaces)[0]!,
  };
}

export async function hash(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return toBase64(new Uint8Array(buf));
}

const gzip = async (s: string) =>
  toBase64(new Uint8Array(await new Response(new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()));
const gunzip = (b64: string) =>
  new Response(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();

/** Gzips the payload and splits it into storage.sync items; `bytes` is checked against the quota. */
export async function pack(text: string): Promise<{ chunks: string[]; bytes: number }> {
  const packed = await gzip(text);
  const chunks = Array.from({ length: Math.ceil(packed.length / CHUNK) }, (_, i) => packed.slice(i * CHUNK, (i + 1) * CHUNK));
  return { chunks, bytes: packed.length };
}

export const unpack = (chunks: string[]) => gunzip(chunks.join(''));

// --- the background's side: storage access ---

interface Head { hash: string; n: number; at: number; bytes: number }

async function readRemote(head: Head): Promise<Payload | null> {
  const keys = Array.from({ length: head.n }, (_, i) => `sync:${i}`);
  const got = await browser.storage.sync.get(keys);
  if (keys.some((k) => typeof got[k] !== 'string')) return null; // still arriving
  try {
    const text = await unpack(keys.map((k) => got[k] as string));
    return (await hash(text)) === head.hash ? JSON.parse(text) : null; // a half-arrived write: wait for the rest
  } catch {
    return null;
  }
}

const status = (s: SyncStatus) => browser.storage.local.set({ syncStatus: s });

async function push(p: Payload, oldN: number) {
  const text = canonical(p);
  const { chunks, bytes } = await pack(text);
  if (bytes > QUOTA) return status({ at: Date.now(), bytes, error: 'size' });
  const h = await hash(text);
  try {
    await browser.storage.sync.set({ ...Object.fromEntries(chunks.map((c, i) => [`sync:${i}`, c])), [HEAD]: { hash: h, n: chunks.length, at: Date.now(), bytes } satisfies Head });
    if (oldN > chunks.length) await browser.storage.sync.remove(Array.from({ length: oldN - chunks.length }, (_, i) => `sync:${chunks.length + i}`));
  } catch (e) {
    return status({ at: Date.now(), bytes, error: String((e as Error)?.message ?? e) });
  }
  await browser.storage.local.set({ syncBase: h, syncStatus: { at: Date.now(), bytes } satisfies SyncStatus });
}

/** One step toward both sides agreeing. `syncBase` is the hash both had at the last sync, which tells whose side moved. */
async function reconcileOnce() {
  const d = (await browser.storage.local.get(['local', 'meta', 'workspaces', 'ws', 'sync', 'syncBase'])) as Partial<Data> & { syncBase?: string };
  if (d.sync === false || !d.local || !d.workspaces) return;
  const state: Synced = { local: d.local, meta: d.meta ?? {}, workspaces: d.workspaces, ws: d.ws ?? '' };
  const mine = await hash(canonical(payloadOf(state)));
  const head = (await browser.storage.sync.get(HEAD))[HEAD] as Head | undefined;
  if (!head) return push(payloadOf(state), 0);
  if (head.hash === mine) {
    if (d.syncBase !== mine) await browser.storage.local.set({ syncBase: mine });
    return;
  }
  if (d.syncBase === head.hash) return push(payloadOf(state), head.n); // only this side changed
  const remote = await readRemote(head);
  if (!remote) return;
  const merge = d.syncBase !== mine; // first sync here, or both sides changed: keep both
  const next = applyPayload(state, remote, merge);
  await browser.storage.local.set({ ...next, syncedAt: Date.now() });
  if (merge) await push(payloadOf(next), head.n);
  else await browser.storage.local.set({ syncBase: head.hash, syncStatus: { at: Date.now(), bytes: head.bytes } satisfies SyncStatus });
}

let queue = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | undefined;
/** Runs after `delay` ms of quiet (typing in a note saves on every key; storage.sync takes 120 writes a minute). */
export function reconcile(delay = 0) {
  clearTimeout(timer);
  timer = setTimeout(() => { queue = queue.then(reconcileOnce).catch((e) => status({ at: Date.now(), bytes: 0, error: String(e?.message ?? e) })); }, delay);
}

/** Local keys whose change is something to sync. */
export const SYNC_KEYS = ['local', 'meta', 'workspaces', 'sync'];
