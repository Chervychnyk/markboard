import { flatten } from './core.ts';
import type { Backup, Data } from './types.ts';

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Snapshot into storage (last 7 kept) and, if enabled, into Downloads/Markboard backups/.
 *  Runs in the service worker too, so no DOM or object URLs here. */
export async function backupNow() {
  const { backups = [], ...data } = (await browser.storage.local.get(null)) as Partial<Data>;
  const [root] = await browser.bookmarks.getTree();
  const urls = new Map(flatten(root!.children ?? []).filter((n) => n.url).map((n) => [n.id, n.url!]));
  for (const [id, m] of Object.entries(data.meta ?? {})) if (urls.has(id)) m.url = urls.get(id);
  const date = Date.now();
  await browser.storage.local.set({ backups: [{ date, data } satisfies Backup, ...backups].slice(0, 7) });
  if (data.backupToDownloads && browser.downloads) {
    await browser.downloads.download({
      url: 'data:application/json;base64,' + toBase64(new TextEncoder().encode(JSON.stringify(data, null, 2))),
      filename: `Markboard backups/markboard-${new Date(date).toISOString().slice(0, 10)}.json`,
      conflictAction: 'overwrite',
    });
  }
}
