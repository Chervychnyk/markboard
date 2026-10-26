<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '@/lib/i18n';
  import {
    COLORS, createBookmark, dropBookmark, HEX, isCollapsed, open, openColMenu, saveWs, toggleCollapsed, ui, ws,
  } from '@/lib/store.svelte';
  import Glyph, { type GlyphName } from './Glyph.svelte';

  let {
    k, title, folderId, count, icon, children,
  }: {
    k: string; title: string; folderId?: string; count?: number; icon?: GlyphName; children: Snippet;
  } = $props();
  let el = $state<HTMLElement>();
  let over = $state(false);

  // A column color is a label name (follows the theme) or a custom hex.
  const raw = $derived(ws().colColors[k] ?? '');
  const color = $derived(raw && COLORS.includes(raw) ? `var(--label-${raw})` : HEX.test(raw) ? raw : null);
  const name = $derived(ws().colNames[k] || title);
  const folded = $derived(isCollapsed(k));

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

</script>

<section
  bind:this={el}
  class="col"
  class:over
  class:folded
  class:menu-open={ui.colMenu?.k === k}
  data-key={k}
  style:--col-color={color ?? 'transparent'}
  ondragover={(e) => { e.preventDefault(); over = true; }}
  ondragleave={dragLeave}
  ondrop={drop}
  role="list"
>
  <!-- svelte-ignore a11y_no_static_element_interactions (dragging is a pointer-only extra; the menu and keys cover the rest) -->
  <header class="col-head" draggable="true" title={t('Drag to reorder')} ondragstart={(e) => e.dataTransfer!.setData('text/column', k)}>
    <!-- A column's color is its top stripe, so the icon never gives way to a dot. -->
    {#if icon}<span class="col-ico" aria-hidden="true"><Glyph name={icon} size={14} /></span>{/if}
    {#if folderId}<a class="col-name" href={'#' + folderId} title={t('Open gallery')}>{name}</a>{:else}<span class="col-name">{name}</span>{/if}
    {#if count !== undefined}<span class="col-count">{count}</span>{/if}
    <div class="col-actions">
      {#if folderId}
        <button class="col-kebab col-hover" title={t('Search this folder')} aria-label={t('Search this folder')} onclick={() => { ui.focusSearch = true; open(folderId); }}>
          <Glyph name="search" size={14} />
        </button>
        <button class="col-kebab col-hover" title={t('Open gallery')} aria-label={t('Open gallery')} onclick={() => open(folderId)}>
          <Glyph name="grid" size={14} />
        </button>
        <button class="col-kebab col-hover" title={t('New bookmark')} aria-label={t('New bookmark')} onclick={() => createBookmark(folderId)}>
          <Glyph name="plus" size={14} />
        </button>
      {/if}
      <button class="col-kebab" title={t('Column options')} aria-label={t('Column options')} onclick={(e) => openColMenu(k, title, folderId, e.currentTarget.closest('.col-head')!)}>
        <Glyph name="more" size={15} />
      </button>
      <button class="col-kebab col-fold" aria-expanded={!folded} title={folded ? t('Expand') : t('Collapse')} aria-label={folded ? t('Expand') : t('Collapse')} onclick={() => toggleCollapsed(k)}>
        <Glyph name="chevron" size={13} />
      </button>
    </div>
  </header>
  {#if !folded}<div class="col-list">{@render children()}</div>{/if}
</section>
