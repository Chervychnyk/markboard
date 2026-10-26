<script lang="ts">
  import { onMount } from 'svelte';
  import type { Browser } from 'wxt/browser';
  import { favicon, flatten, LOOK_DEFAULTS, search } from '@/lib/core';
  import { t } from '@/lib/i18n';
  import { FONTS, HEX } from '@/lib/store.svelte';
  import type { BNode, Data, Look, Meta } from '@/lib/types';
  import Glyph from './Glyph.svelte';
  import Mark from './Mark.svelte';

  let tab = $state<Browser.tabs.Tab>();
  let flat = $state.raw<BNode[]>([]);
  let recent = $state.raw<BNode[]>([]);
  let meta = $state.raw<Record<string, Meta>>({});
  let folder = $state('1');
  let saved = $state(false);
  let q = $state('');
  let scope = $state<'all' | 'fav' | 'recent'>('all');
  let name = $state('');

  const hits = $derived.by(() => {
    if (q.trim()) return search(flat, q).filter((n) => n.url);
    if (scope === 'fav') return flat.filter((n) => n.url && (meta[n.id]?.fav || meta[n.id]?.pinned)).slice(0, 8);
    if (scope === 'recent') return recent.slice(0, 8);
    return flat.filter((n) => n.url && meta[n.id]?.pinned).slice(0, 3);
  });

  const domain = $derived.by(() => {
    try { return new URL(tab?.url ?? '').hostname.replace(/^www\./, ''); } catch { return ''; }
  });
  const hitDomain = (url: string) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  };
  const parentName = (id?: string) => flat.find((n) => n.id === id)?.title ?? '';

  onMount(async () => {
    const stored = (await browser.storage.local.get(['workspaces', 'ws', 'meta'])) as Partial<Data>;
    meta = stored.meta ?? {};
    const look: Look = { ...LOOK_DEFAULTS, ...stored.workspaces?.[stored.ws ?? '']?.look };
    const root = document.documentElement;
    root.dataset.theme = look.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : look.theme;
    root.style.setProperty('--font', FONTS[look.font] ?? FONTS.system!);
    if (HEX.test(look.accent)) root.style.setProperty('--accent', look.accent);
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    name = tab?.title ?? '';
    const [tree] = await browser.bookmarks.getTree();
    flat = flatten(tree!.children ?? []);
    recent = await browser.bookmarks.getRecent(8).catch(() => []);
    if (tab?.url) saved = (await browser.bookmarks.search({ url: tab.url }).catch(() => [])).length > 0;
  });

  async function saveTab() {
    await browser.bookmarks.create({ parentId: folder, title: name.trim() || tab!.title, url: tab!.url });
    saved = true;
  }

  function onKey(e: KeyboardEvent) {
    const text = q.trim();
    if (e.key !== 'Enter' || !text) return;
    if (hits[0]) browser.tabs.create({ url: hits[0].url });
    else browser.search.query({ text, disposition: 'NEW_TAB' });
  }
</script>

<div class="popup">
  <header class="pp-head">
    <Mark size={18} />
    <h1 class="pp-name">Markboard</h1>
    <div class="pp-scopes">
      <button
        type="button"
        class="pp-scope-btn"
        class:on={scope === 'fav'}
        title={t('Favorites')}
        aria-label={t('Favorites')}
        aria-pressed={scope === 'fav'}
        onclick={() => (scope = scope === 'fav' ? 'all' : 'fav')}
      >
        <Glyph name="star" size={14} />
      </button>
      <button
        type="button"
        class="pp-scope-btn"
        class:on={scope === 'recent'}
        title={t('Recently added')}
        aria-label={t('Recently added')}
        aria-pressed={scope === 'recent'}
        onclick={() => (scope = scope === 'recent' ? 'all' : 'recent')}
      >
        <Glyph name="clock" size={14} />
      </button>
    </div>
  </header>

  <label class="pp-search">
    <Glyph name="search" size={15} />
    <!-- svelte-ignore a11y_autofocus -->
    <input type="search" placeholder={t('Search bookmarks…')} aria-label={t('Search')} autofocus bind:value={q} onkeydown={onKey} />
  </label>

  {#if hits.length}
    <ul class="pp-hits">
      {#each hits as n (n.id)}
        <li>
          <button class="pp-hit" onclick={() => browser.tabs.create({ url: n.url })}>
            <img class="ico" src={favicon(n.url!)} alt="" />
            <span class="pp-hit-body">
              <span class="pp-hit-title">{n.title || n.url}</span>
              <span class="pp-hit-sub">{parentName(n.parentId) || hitDomain(n.url!)}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else if q.trim()}
    <p class="pp-empty">{t('No results')}</p>
  {/if}

  {#if tab}
    <section class="pp-savebox">
      <div class="pp-section">{t('Save this tab')}</div>
      <div class="pp-field">
        <span class="pp-field-label">{t('Name')}</span>
        <div class="pp-page">
          {#if tab.url}<img class="ico" src={favicon(tab.url)} alt="" />{/if}
          <input class="pp-name-input" bind:value={name} aria-label={t('Name')} placeholder={t('Name')} />
          {#if domain}<span class="pp-domain">{domain}</span>{/if}
        </div>
      </div>
      <div class="pp-field">
        <span class="pp-field-label">{t('Folder')}</span>
        <div class="pp-save">
          <select aria-label={t('Folder')} bind:value={folder}>
            {#each flat.filter((n) => !n.url) as f (f.id)}<option value={f.id}>{f.title}</option>{/each}
          </select>
          <button class="btn primary" disabled={saved || !tab.url} onclick={saveTab}>
            {#if saved}<Glyph name="check" size={14} />{/if}{saved ? t('Saved') : t('Save')}
          </button>
        </div>
      </div>
    </section>
  {/if}

  <footer class="pp-foot">
    <button class="btn" onclick={() => browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') })}>
      <span>{t('Open board')}</span><Glyph name="external" size={14} />
    </button>
  </footer>
</div>
