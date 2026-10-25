<script lang="ts">
  import { onMount } from 'svelte';
  import type { Browser } from 'wxt/browser';
  import { favicon, flatten, LOOK_DEFAULTS, search } from '@/lib/core';
  import { t } from '@/lib/i18n';
  import type { BNode, Data } from '@/lib/types';

  let tab = $state<Browser.tabs.Tab>();
  let flat = $state.raw<BNode[]>([]);
  let folder = $state('1');
  let saved = $state(false);
  let q = $state('');
  const hits = $derived(search(flat, q).filter((n) => n.url));

  onMount(async () => {
    const { workspaces, ws } = (await browser.storage.local.get(['workspaces', 'ws'])) as Partial<Data>;
    const theme = workspaces?.[ws ?? '']?.look?.theme ?? LOOK_DEFAULTS.theme;
    document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const [root] = await browser.bookmarks.getTree();
    flat = flatten(root!.children ?? []);
    if (tab?.url) saved = (await browser.bookmarks.search({ url: tab.url }).catch(() => [])).length > 0;
  });

  async function saveTab() {
    await browser.bookmarks.create({ parentId: folder, title: tab!.title, url: tab!.url });
    saved = true;
  }

  function onKey(e: KeyboardEvent) {
    const text = q.trim();
    if (e.key !== 'Enter' || !text) return;
    if (hits[0]) browser.tabs.create({ url: hits[0].url });
    else browser.search.query({ text, disposition: 'NEW_TAB' });
  }
</script>

<div id="page">{tab?.title ?? ''}</div>
<div class="row">
  <select aria-label={t('Folder')} bind:value={folder}>
    {#each flat.filter((n) => !n.url) as f (f.id)}<option value={f.id}>{f.title}</option>{/each}
  </select>
  <button class="btn" disabled={saved || !tab?.url} onclick={saveTab}>{saved ? t('Saved ✓') : t('Save')}</button>
</div>
<!-- svelte-ignore a11y_autofocus -->
<input type="search" placeholder={t('Search bookmarks…')} aria-label={t('Search')} autofocus bind:value={q} onkeydown={onKey} />
<ul>
  {#each hits as n (n.id)}
    <li><button class="hit" onclick={() => browser.tabs.create({ url: n.url })}><img class="ico" src={favicon(n.url!)} alt="" /><span class="title">{n.title || n.url}</span></button></li>
  {/each}
</ul>
<button class="btn" onclick={() => browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') })}>{t('Open board')}</button>
