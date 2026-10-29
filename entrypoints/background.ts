// Reminder notifications, daily automatic backups, board commands for the Tabkit palette, and the agent bridge.
import { backupNow } from '@/lib/backup';
import { connectBridge, disconnectBridge } from '@/lib/bridge';
import { reconcile, SYNC_KEYS } from '@/lib/sync';
import { providedCommands, type ProvidedLink, TABKIT_ID, type TabkitMessage } from '@/lib/commands';
import { DEFAULTS, emptyLocal, findNode, flatten, isLocal } from '@/lib/core';
import { initLang, t } from '@/lib/i18n';
import type { BNode, Data } from '@/lib/types';

export default defineBackground(() => {
  connectBridge();

  browser.runtime.onInstalled.addListener(() => {
    browser.alarms.create('backup', { periodInMinutes: 24 * 60 });
    registerWithTabkit();
    reconcile();
  });
  browser.runtime.onStartup.addListener(() => { registerWithTabkit(); reconcile(); });

  // Markboard folders and their boards follow the browser account: local edits go up, others' come down.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'bridgeToken' in changes) { disconnectBridge(); connectBridge(); }
    if (area === 'sync' && 'sync:head' in changes) reconcile(500);
    else if (area === 'local' && !('syncedAt' in changes) && SYNC_KEYS.some((k) => k in changes)) reconcile(3000);
  });

  browser.alarms.onAlarm.addListener(async ({ name }) => {
    if (name === 'bridge') connectBridge();
    else if (name === 'backup') {
      const { autoBackup } = await browser.storage.local.get('autoBackup');
      if (autoBackup) await backupNow();
    } else if (name.startsWith('remind:')) {
      const b = await bookmark(name.slice(7));
      if (b) browser.notifications.create(name, { type: 'basic', iconUrl: '/icon/128.png', title: 'Reminder', message: b.title || b.url || '' });
    }
  });

  browser.notifications.onClicked.addListener(async (id) => {
    const b = await bookmark(id.slice(7));
    browser.tabs.create(b?.url ? { url: b.url } : {});
    browser.notifications.clear(id);
  });

  // Only Tabkit may list or run board commands.
  browser.runtime.onMessageExternal.addListener((msg: TabkitMessage, sender, reply) => {
    if (sender.id !== TABKIT_ID) return false;
    if (msg.type === 'tabkit:commands') listCommands().then(reply);
    else if (msg.type === 'tabkit:links') listLinks().then(reply);
    else if (msg.type === 'tabkit:run') runCommand(msg.command, msg.tabId).then(() => reply(true), (e) => reply({ error: String(e?.message ?? e) }));
    else return false;
    return true;
  });

  // The board asks to (re)register whenever it opens, so installing Tabkit later still links them.
  browser.runtime.onMessage.addListener((msg: { type: string }) => {
    if (msg.type === 'register') registerWithTabkit();
  });
});

/** A reminder's bookmark: the browser's, or one in Markboard's own tree. */
async function bookmark(id: string): Promise<BNode | undefined> {
  if (!isLocal(id)) return (await browser.bookmarks.get(id).catch(() => []))[0];
  const { local = emptyLocal() } = (await browser.storage.local.get('local')) as Partial<Data>;
  return findNode(local, id);
}

// Tabkit may not be installed; then there is nobody to tell.
const registerWithTabkit = () =>
  browser.runtime.sendMessage(TABKIT_ID, { type: 'tabkit:register', name: 'Markboard' } satisfies TabkitMessage).catch(() => {});

async function listCommands() {
  const d = { ...DEFAULTS, ...(await browser.storage.local.get(['workspaces', 'ws', 'lang'])) } as Data;
  initLang(d.lang);
  return providedCommands(d, t);
}

async function listLinks(): Promise<ProvidedLink[]> {
  const { local = emptyLocal() } = (await browser.storage.local.get('local')) as Partial<Data>;
  return flatten([local]).filter((n) => n.url).map((n) => ({ id: n.id, title: n.title, url: n.url! }));
}

/** The board page in that tab runs it; with none there, a new board tab opens and runs it on load. */
async function runCommand(command: string, tabId?: number) {
  const handled = await browser.runtime.sendMessage({ type: 'command', command, tabId }).catch(() => false);
  if (handled) return;
  const tab = tabId === undefined ? undefined : await browser.tabs.get(tabId).catch(() => undefined);
  await browser.tabs.create({ url: browser.runtime.getURL(`/newtab.html?cmd=${encodeURIComponent(command)}`), windowId: tab?.windowId });
}
