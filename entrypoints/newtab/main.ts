import { mount } from 'svelte';
import '@/assets/style.css';
import App from '@/components/App.svelte';
import { lang, t } from '@/lib/i18n';
import { init, refresh, startSync } from '@/lib/store.svelte';

(async () => {
  await init();
  document.documentElement.lang = lang;
  document.title = t('New Tab');
  startSync();
  await refresh();
  mount(App, { target: document.body });
})();
