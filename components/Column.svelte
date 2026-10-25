<script lang="ts">
  import type { Snippet } from 'svelte';
  import { form, type Extra } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { deleteNote, dropBookmark, HEX, look, openAll, saveWs, ws } from '@/lib/store.svelte';

  let { k, title, folderId, children }: { k: string; title: string; folderId?: string; children: Snippet } = $props();
  let el = $state<HTMLElement>();
  const fixed = $derived(!!look().columns);

  // Remember the width the user drags the column to (unless a fixed column count is set).
  $effect(() => {
    if (fixed || !el) return;
    const ro = new ResizeObserver(() => {
      const px = Math.round(el!.offsetWidth);
      if (ws().widths[k] !== px) { ws().widths[k] = px; saveWs(); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  const width = $derived(!fixed && ws().widths[k]);
  const color = $derived(HEX.test(ws().colColors[k] ?? '') ? ws().colColors[k] : null);
  const name = $derived(ws().colNames[k] || title);

  function drop(e: DragEvent) {
    e.preventDefault();
    const moving = e.dataTransfer!.getData('text/column');
    if (!moving) return folderId && dropBookmark(e, folderId);
    if (moving === k) return;
    const keys = [...document.querySelectorAll<HTMLElement>('#main .col')].map((c) => c.dataset.key!).filter((x) => x !== moving);
    keys.splice(keys.indexOf(k), 0, moving);
    ws().order = keys;
    saveWs();
  }

  async function menu() {
    const w = ws();
    const noteId = k.startsWith('note:') && k.slice(5);
    const extra: Extra[] = [];
    if (folderId) extra.push([t('Open all links'), () => openAll(folderId)]);
    if (noteId) extra.push([t('Delete note'), () => deleteNote(noteId)]);
    const v = await form(t('Column'), [
      { name: 'name', label: t('Name'), value: w.colNames[k] || title },
      { name: 'color', label: t('Color'), type: 'color', value: w.colColors[k] || '#4f46e5' },
      { name: 'noColor', label: t('No color'), type: 'checkbox', value: !w.colColors[k] },
    ], extra);
    if (!v) return;
    if (v.name && v.name !== title) w.colNames[k] = v.name; else delete w.colNames[k];
    if (v.noColor) delete w.colColors[k]; else w.colColors[k] = v.color;
    saveWs();
  }
</script>

<section
  bind:this={el}
  class="col"
  data-key={k}
  style:width={width ? `${width}px` : null}
  style:border-top={color ? `3px solid ${color}` : null}
  ondragover={(e) => e.preventDefault()}
  ondrop={drop}
  role="list"
>
  <!-- svelte-ignore a11y_no_static_element_interactions (dragging is a pointer-only extra; the ⋯ menu and keys cover the rest) -->
  <header draggable="true" title={t('Drag to reorder')} ondragstart={(e) => e.dataTransfer!.setData('text/column', k)}>
    {#if folderId}<a class="grow" href={'#' + folderId}>{name}</a>{:else}<span class="grow">{name}</span>{/if}
    <button class="hide" title={t('Column options')} onclick={menu}>⋯</button>
    <button class="hide" title={t('Hide column in this workspace')} onclick={() => { ws().hiddenCols.push(k); saveWs(); }}>×</button>
  </header>
  <div class="list">{@render children()}</div>
</section>
