import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['bookmarks', 'storage', 'unlimitedStorage', 'favicon', 'search', 'topSites', 'activeTab', 'alarms', 'notifications'],
    // tabs: "Save tabs" / "Save session"; downloads: backups into the Downloads folder.
    optional_permissions: ['tabs', 'downloads'],
    action: { default_title: 'Markboard' },
  },
});
