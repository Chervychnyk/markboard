import { mount } from 'svelte';
import '@/assets/style.css';
import Popup from '@/components/Popup.svelte';
import { initLang, lang } from '@/lib/i18n';

(async () => {
  const { lang: stored } = await browser.storage.local.get('lang');
  initLang(stored as string | undefined);
  document.documentElement.lang = lang;
  mount(Popup, { target: document.body });
})();
