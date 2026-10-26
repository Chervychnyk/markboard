<script lang="ts">
  import { t } from '@/lib/i18n';
  import { COLORS, data, isDue, metaOf, openItemMenu, setMeta, app, toggleSel, ui } from '@/lib/store.svelte';
  import type { Row } from '@/lib/types';
  import Glyph from './Glyph.svelte';
  import Icon from './Icon.svelte';

  let { n }: { n: Row } = $props();
  const m = $derived(metaOf(n));
  const color = $derived(COLORS.includes(m.color ?? '') ? (m.color ?? '') : '');
  const sel = $derived(ui.selecting && !!n.id);
  const on = $derived(!!n.id && ui.selected.has(n.id));
  const menuOpen = $derived(!!n.id && ui.menuId === n.id);
  const act = (fn: (e: MouseEvent) => unknown) => (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); fn(e); };
  const id = $derived(n.id!);
  const host = $derived.by(() => {
    try { return new URL(n.url ?? '').hostname.replace(/^www\./, ''); } catch { return n.url ?? ''; }
  });
  // Folder tiles preview up to eight children as icons; past eight, the last slot counts the rest.
  const children = $derived(n.id && !n.url ? data.byId.get(n.id)?.children ?? [] : []);
  const preview = $derived(children.slice(0, children.length > 8 ? 7 : 8));
  const childCount = $derived(children.length);
</script>

{#if !m.hidden || app.showHidden}
  <div
    class="item {color && 'c-' + color}"
    class:is-hidden={m.hidden}
    class:selected={on}
    class:menu-open={menuOpen}
    class:fav={m.fav}
    class:folder={!n.url}
    class:previewless={!n.url && !preview.length}
    data-id={n.id}
    draggable={n.id ? 'true' : undefined}
    ondragstart={n.id ? (e) => e.dataTransfer!.setData('text/bookmark', id) : undefined}
    oncontextmenu={n.id && !ui.selecting ? (e) => { e.preventDefault(); openItemMenu(id, e.currentTarget); } : undefined}
    role="listitem"
  >
    <a class="item-link" href={n.url ?? '#' + n.id} title={[n.url ?? n.title, m.comment].filter(Boolean).join('\n')} onclick={sel ? act((e) => toggleSel(id, e.shiftKey)) : undefined}>
      {#if sel}<input type="checkbox" checked={on} readonly tabindex={-1} aria-hidden="true" />{/if}
      {#if preview.length}
        <span class="folder-preview" aria-hidden="true">
          {#each preview as p (p.id)}
            <span class="mini" title={p.title}>
              {#if p.url}<Icon n={p} />{:else}<Glyph name="folder" size={14} />{/if}
            </span>
          {/each}
          {#if childCount > preview.length}<span class="mini more">+{childCount - preview.length}</span>{/if}
        </span>
      {/if}
      <Icon {n} {m} />
      <span class="body">
        <span class="title-line">
          {#if !n.url}<span class="folder-inline-ico" aria-hidden="true"><Glyph name="folder" size={14} /></span>{/if}
          <span class="title">{n.title || n.url}</span>
          {#if m.remind}
            <span class="due" class:upcoming={!isDue(m)} title={m.remind}>
              <Glyph name="bell" size={12} />
            </span>
          {/if}
          {#if m.comment}
            <span class="has-comment" title={m.comment}><Glyph name="comment" size={12} /></span>
          {/if}
        </span>
        {#if m.tags?.length}<span class="tags">{#each m.tags as tag (tag)}<span class="tag">#{tag}</span>{/each}</span>{/if}
        {#if m.comment}<span class="comment">{m.comment}</span>{/if}
        {#if n.url}<span class="url">{host}</span>{:else}<span class="folder-count">{childCount}</span>{/if}
      </span>
    </a>
    {#if n.id && !ui.selecting}
      <span class="acts">
        <button class="star" class:on={m.fav} title={t('Favorite')} aria-label={t('Favorite')} onclick={act(() => setMeta(id, { fav: !m.fav }))}>
          <Glyph name={m.fav ? 'star-fill' : 'star'} size={14} />
        </button>
        <button
          class="more-btn"
          class:on={menuOpen}
          title={t('More')}
          aria-label={t('More')}
          aria-expanded={menuOpen}
          onclick={act((e) => openItemMenu(id, e.currentTarget as Element))}
        >
          <Glyph name="more" size={15} />
        </button>
      </span>
    {/if}
  </div>
{/if}
