<script lang="ts">
  import type { Snippet } from 'svelte';
  import { form, type Extra } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { createBookmark, deleteNote, dropBookmark, HEX, openAll, saveWs, ws } from '@/lib/store.svelte';
  import Glyph, { type GlyphName } from './Glyph.svelte';

  let {
    k, title, folderId, count, icon, children,
  }: {
    k: string; title: string; folderId?: string; count?: number; icon?: GlyphName; children: Snippet;
  } = $props();
  let el = $state<HTMLElement>();
  let over = $state(false);

  const color = $derived(HEX.test(ws().colColors[k] ?? '') ? ws().colColors[k] : null);
  const name = $derived(ws().colNames[k] || title);

  function drop(e: DragEvent) {
    e.preventDefault();
    over = false;
    const moving = e.dataTransfer!.getData('text/column');
    if (!moving) return folderId && dropBookmark(e, folderId);
    if (moving === k) return;
    const keys = [...document.querySelectorAll<HTMLElement>('#main .col')].map((c) => c.dataset.key!).filter((x) => x !== moving);
    keys.splice(keys.indexOf(k), 0, moving);
    ws().order = keys;
    saveWs();
  }

  function dragLeave(e: DragEvent) {
    if (!el?.contains(e.relatedTarget as Node | null)) over = false;
  }

  async function menu() {
    const w = ws();
    const noteId = k.startsWith('note:') && k.slice(5);
    const extra: Extra[] = [];
    if (folderId) {
      extra.push([t('New bookmark'), () => createBookmark(folderId)]);
      extra.push([t('Open all links'), () => openAll(folderId)]);
    }
    if (noteId) extra.push([t('Delete note'), () => deleteNote(noteId)]);
    extra.push([t('Hide column in this workspace'), () => { w.hiddenCols.push(k); saveWs(); }]);
    const v = await form(t('Column'), [
      { name: 'name', label: t('Name'), value: w.colNames[k] || title },
      { name: 'color', label: t('Color'), type: 'color', value: w.colColors[k] || '#1d5fbf' },
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
  class:over
  data-key={k}
  style:--col-color={color ?? 'transparent'}
  ondragover={(e) => { e.preventDefault(); over = true; }}
  ondragleave={dragLeave}
  ondrop={drop}
  role="list"
>
  <!-- svelte-ignore a11y_no_static_element_interactions (dragging is a pointer-only extra; the menu and keys cover the rest) -->
  <header class="col-head" draggable="true" title={t('Drag to reorder')} ondragstart={(e) => e.dataTransfer!.setData('text/column', k)}>
    {#if color}
      <span class="col-dot" style:background={color} aria-hidden="true"></span>
    {:else if icon}
      <span class="col-ico" aria-hidden="true"><Glyph name={icon} size={14} /></span>
    {/if}
    {#if folderId}<a class="col-name" href={'#' + folderId} title={t('Open gallery')}>{name}</a>{:else}<span class="col-name">{name}</span>{/if}
    {#if count !== undefined}<span class="col-count">{count}</span>{/if}
    <div class="col-actions">
      {#if folderId}
        <button class="col-kebab" title={t('New bookmark')} aria-label={t('New bookmark')} onclick={() => createBookmark(folderId)}>
          <Glyph name="plus" size={14} />
        </button>
      {/if}
      <button class="col-kebab" title={t('Column options')} aria-label={t('Column options')} onclick={menu}>
        <Glyph name="more" size={15} />
      </button>
    </div>
  </header>
  <div class="col-list">{@render children()}</div>
</section>
