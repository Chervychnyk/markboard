<script lang="ts">
  import { locale, t } from '@/lib/i18n';
  import {
    bulkRename, createBookmark, data, dropBookmark, matchesFilter, metaOf, open, save, sortRows, app, ui,
  } from '@/lib/store.svelte';
  import type { BNode } from '@/lib/types';
  import GalleryAside from './GalleryAside.svelte';
  import Glyph from './Glyph.svelte';
  import Item from './Item.svelte';

  let { id }: { id: string } = $props();

  const folder = $derived(data.byId.get(id)!);
  const crumbs = $derived.by(() => {
    const out: BNode[] = [];
    for (let n: BNode | undefined = folder; n; n = data.byId.get(n.parentId!)) out.unshift(n);
    return out;
  });

  const allKids = $derived(folder.children ?? []);
  const tags = $derived(
    [...new Set(allKids.flatMap((n) => metaOf(n).tags ?? []))].sort((a, b) => a.localeCompare(b, locale)),
  );

  let tag = $state<string>();
  let q = $state('');

  // A different folder means a different tag vocabulary.
  $effect(() => {
    void id;
    tag = undefined;
    q = '';
  });

  const kids = $derived.by(() => {
    const query = q.trim().toLowerCase();
    const filtered = allKids.filter((n) => {
      if (!matchesFilter(n)) return false;
      if (tag && !metaOf(n).tags?.includes(tag)) return false;
      if (query && !`${n.title} ${n.url ?? ''} ${(metaOf(n).tags ?? []).join(' ')}`.toLowerCase().includes(query)) return false;
      return true;
    });
    return sortRows(filtered);
  });

  const modes: [string, string, 'grid' | 'masonry' | 'list'][] = [
    ['compact', t('Grid'), 'grid'], ['extended', t('Masonry'), 'masonry'], ['list', t('List'), 'list'],
  ];
  function setMode(mode: string) {
    app.galleryMode = mode;
    save('galleryMode');
  }
  let searchEl = $state<HTMLInputElement>();
  $effect(() => {
    if (ui.focusSearch && searchEl) {
      searchEl.focus();
      ui.focusSearch = false;
    }
  });
</script>

<header class="gallery-head">
  <div class="gallery-title-block">
    <div class="gallery-crumb-row">
      <nav class="crumbs" aria-label={t('Board')}>
        <button class="crumb-btn" onclick={() => open(null)}>
          <Glyph name="folder" size={14} />
          <span>{t('Board')}</span>
        </button>
        {#each crumbs.slice(0, -1) as c (c.id)}
          <span class="crumb-sep" aria-hidden="true">›</span>
          <a class="crumb-link" href={'#' + c.id}>{c.title}</a>
        {/each}
        <span class="crumb-sep" aria-hidden="true">›</span>
      </nav>
      <h1 class="gallery-title">{folder.title}</h1>
      <span class="gallery-sub">{t('{0} bookmarks', kids.length)}</span>
      {#if tags.length}
        <div class="tag-filter" role="group" aria-label={t('Tags')}>
          {#each tags as x (x)}
            <button
              class="tag-chip"
              class:on={tag === x}
              aria-pressed={tag === x}
              title={t('Filter by #{0}', x)}
              onclick={() => (tag = tag === x ? undefined : x)}
            >#{x}</button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  <div class="gallery-tools">
    <label class="gallery-search">
      <Glyph name="search" size={14} />
      <input type="search" placeholder={t('Search bookmarks…')} aria-label={t('Search')} bind:value={q} bind:this={searchEl} />
    </label>
    <div class="seg" role="group" aria-label={t('Gallery layout')}>
      {#each modes as [mode, label, icon] (mode)}
        <button class:on={app.galleryMode === mode} aria-pressed={app.galleryMode === mode} title={label} aria-label={label} onclick={() => setMode(mode)}>
          <Glyph name={icon} size={15} />
        </button>
      {/each}
    </div>
    <button class="btn" onclick={() => createBookmark(id)}>
      <Glyph name="plus" size={14} /><span>{t('New bookmark')}</span>
    </button>
    <button class="btn ghost" onclick={bulkRename}>{t('Bulk rename')}</button>
    <button
      class="btn ghost aside-toggle"
      class:on={ui.aside}
      title={ui.aside ? t('Hide sidebar') : t('Show sidebar')}
      aria-label={ui.aside ? t('Hide sidebar') : t('Show sidebar')}
      aria-pressed={ui.aside}
      onclick={() => (ui.aside = !ui.aside)}
    >
      <Glyph name="panel" size={15} />
    </button>
  </div>
</header>

<div class="gallery-body" class:no-aside={!ui.aside}>
  <div class="gallery-main">
    {#if kids.length}
      <div
        class="gallery mode-{app.galleryMode}"
        role="list"
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => { e.preventDefault(); dropBookmark(e, id); }}
      >
        {#each kids as n (n.id)}<Item {n} />{/each}
      </div>
    {:else}
      <p class="gallery-empty">{tag || q ? t('No results') : t('No bookmarks yet')}</p>
    {/if}
  </div>
  {#if ui.aside}<GalleryAside list={app.galleryMode === 'list'} current={id} />{/if}
</div>
