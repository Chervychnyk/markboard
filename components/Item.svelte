<script lang="ts">
  import { t } from '@/lib/i18n';
  import { COLORS, edit, isDue, metaOf, removeMany, setMeta, app, toggleSel, ui } from '@/lib/store.svelte';
  import type { BNode, Row } from '@/lib/types';
  import Icon from './Icon.svelte';

  let { n }: { n: Row } = $props();
  const m = $derived(metaOf(n));
  const color = $derived(COLORS.includes(m.color ?? '') ? (m.color ?? '') : '');
  const sel = $derived(ui.selecting && !!n.id);
  const on = $derived(!!n.id && ui.selected.has(n.id));
  const act = (fn: () => unknown) => (e: Event) => { e.preventDefault(); e.stopPropagation(); fn(); };
  const id = $derived(n.id!);
</script>

{#if !m.hidden || app.showHidden}
  <div
    class="item {color && 'c-' + color}"
    class:is-hidden={m.hidden}
    class:selected={on}
    data-id={n.id}
    draggable={n.id ? 'true' : undefined}
    ondragstart={n.id ? (e) => e.dataTransfer!.setData('text/bookmark', id) : undefined}
    role="listitem"
  >
    <a href={n.url ?? '#' + n.id} title={[n.url ?? n.title, m.comment].filter(Boolean).join('\n')} onclick={sel ? act(() => toggleSel(id)) : undefined}>
      {#if sel}<input type="checkbox" checked={on} readonly tabindex={-1} aria-hidden="true" />{/if}
      <Icon {n} {m} />
      <span class="body">
        <span class="title">{n.title || n.url}</span>
        {#if m.tags?.length}<span class="tags">{#each m.tags as tag (tag)}<span class="tag">#{tag}</span>{/each}</span>{/if}
        {#if m.comment}<span class="comment">{m.comment}</span>{/if}
        {#if n.url}<span class="url">{n.url}</span>{/if}
      </span>
    </a>
    {#if n.id && !ui.selecting}
      <span class="acts">
        {#if isDue(m)}<button title={t('Dismiss reminder')} class="on" onclick={act(() => setMeta(id, { remind: '' }))}>⏰</button>{/if}
        <button title={t('Favorite')} class={m.fav ? 'on' : null} onclick={act(() => setMeta(id, { fav: !m.fav }))}>★</button>
        <button title={t('Color label')} onclick={act(() => setMeta(id, { color: COLORS[(COLORS.indexOf(color) + 1) % COLORS.length] }))}>●</button>
        <button title={t('Edit')} onclick={act(() => edit(n as BNode))}>✎</button>
        <button title={t('Delete')} onclick={act(() => removeMany([id]))}>×</button>
      </span>
    {/if}
  </div>
{/if}
