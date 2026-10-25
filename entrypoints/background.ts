// Reminder notifications, daily automatic backups, and board commands for the Tabkit palette.
import { backupNow } from '@/lib/backup';
import { providedCommands, TABKIT_ID, type TabkitMessage } from '@/lib/commands';
import { DEFAULTS } from '@/lib/core';
import { initLang, t } from '@/lib/i18n';
import type { Data } from '@/lib/types';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.alarms.create('backup', { periodInMinutes: 24 * 60 });
    registerWithTabkit();
  });
  browser.runtime.onStartup.addListener(registerWithTabkit);

  browser.alarms.onAlarm.addListener(async ({ name }) => {
    if (name === 'backup') {
      const { autoBackup } = await browser.storage.local.get('autoBackup');
      if (autoBackup) await backupNow();
    } else if (name.startsWith('remind:')) {
      const [b] = await browser.bookmarks.get(name.slice(7)).catch(() => []);
      if (b) browser.notifications.create(name, { type: 'basic', iconUrl: '/icon/128.png', title: 'Reminder', message: b.title || b.url || '' });
    }
  });

  browser.notifications.onClicked.addListener(async (id) => {
    const [b] = await browser.bookmarks.get(id.slice(7)).catch(() => []);
    browser.tabs.create(b?.url ? { url: b.url } : {});
    browser.notifications.clear(id);
  });

  // Only Tabkit may list or run board commands.
  browser.runtime.onMessageExternal.addListener((msg: TabkitMessage, sender, reply) => {
    if (sender.id !== TABKIT_ID) return false;
    if (msg.type === 'tabkit:commands') listCommands().then(reply);
    else if (msg.type === 'tabkit:run') runCommand(msg.command, msg.tabId).then(() => reply(true), (e) => reply({ error: String(e?.message ?? e) }));
    else return false;
    return true;
  });

  // The board asks to (re)register whenever it opens, so installing Tabkit later still links them.
  browser.runtime.onMessage.addListener((msg: { type: string }) => {
    if (msg.type === 'register') registerWithTabkit();
  });
});

// Tabkit may not be installed; then there is nobody to tell.
const registerWithTabkit = () =>
  browser.runtime.sendMessage(TABKIT_ID, { type: 'tabkit:register', name: 'Markboard' } satisfies TabkitMessage).catch(() => {});

async function listCommands() {
  const d = { ...DEFAULTS, ...(await browser.storage.local.get(['workspaces', 'ws', 'lang'])) } as Data;
  initLang(d.lang);
  return providedCommands(d, t);
}

/** The board page in that tab runs it; with none there, a new board tab opens and runs it on load. */
async function runCommand(command: string, tabId?: number) {
  const handled = await browser.runtime.sendMessage({ type: 'command', command, tabId }).catch(() => false);
  if (handled) return;
  const tab = tabId === undefined ? undefined : await browser.tabs.get(tabId).catch(() => undefined);
  await browser.tabs.create({ url: browser.runtime.getURL(`/newtab.html?cmd=${encodeURIComponent(command)}`), windowId: tab?.windowId });
}
