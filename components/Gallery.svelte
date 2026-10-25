<script lang="ts">
  import { locale, t } from '@/lib/i18n';
  import { app, data, dropBookmark, open, ui } from '@/lib/store.svelte';
  import type { BNode } from '@/lib/types';
  import Item from './Item.svelte';

  let { id }: { id: string } = $props();
  const folder = $derived(data.byId.get(id)!);
  const crumbs = $derived.by(() => {
    const out: BNode[] = [];
    for (let n: BNode | undefined = folder; n; n = data.byId.get(n.parentId!)) out.unshift(n);
    return out;
  });
  const kids = $derived.by(() => {
    const k = [...(folder.children ?? [])];
    if (ui.sort === 'name') k.sort((a, b) => a.title.localeCompare(b.title, locale));
    if (ui.sort === 'date') k.sort((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0));
    return k;
  });
</script>

<nav class="crumbs">
  <button class="link" onclick={() => open(null)}>{t('Board')}</button>
  {#each crumbs as c (c.id)}<span> / </span><a href={'#' + c.id}>{c.title}</a>{/each}
</nav>
<div class="gallery mode-{app.galleryMode}" ondragover={(e) => e.preventDefault()} ondrop={(e) => { e.preventDefault(); dropBookmark(e, id); }} role="list">
  {#each kids as n (n.id)}<Item {n} />{/each}
</div>
