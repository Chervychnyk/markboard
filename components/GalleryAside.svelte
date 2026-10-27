<script lang="ts">
  import { t } from '@/lib/i18n';
  import { createFolder, data, deleteNote, newNote, saveWs, ws, wsRoot } from '@/lib/store.svelte';
  import { WIDGETS } from '@/lib/widgets';
  import Glyph from './Glyph.svelte';
  import NoteBody from './NoteBody.svelte';
  import WidgetCard from './WidgetCard.svelte';

  let { list, current }: { list: boolean; current: string } = $props();
  let tab = $derived<'widgets' | 'folders'>(list ? 'folders' : 'widgets');

  const w = $derived(ws());
  const root = $derived(wsRoot());
  const folders = $derived((root.children ?? []).filter((n) => !n.url));
  const childCount = (id: string) => data.byId.get(id)?.children?.length ?? 0;

  function addWidget(e: Event & { currentTarget: HTMLSelectElement }) {
    const type = e.currentTarget.value;
    e.currentTarget.value = '';
    if (!type || !WIDGETS[type]) return;
    w.widgets.push({ id: crypto.randomUUID(), type });
    saveWs();
  }
</script>

<aside class="gallery-aside">
  <div class="aside-head">
    <div class="seg aside-tabs" role="tablist" aria-label={t('Notes & widgets')}>
      <button
        type="button"
        role="tab"
        class:on={tab === 'widgets'}
        aria-selected={tab === 'widgets'}
        title={t('Notes & widgets')}
        onclick={() => (tab = 'widgets')}
      >
        <Glyph name="sliders" size={14} />
        <span>{t('Notes & widgets')}</span>
      </button>
      <button
        type="button"
        role="tab"
        class:on={tab === 'folders'}
        aria-selected={tab === 'folders'}
        title={t('Folders')}
        onclick={() => (tab = 'folders')}
      >
        <Glyph name="folder" size={14} />
        <span>{t('Folders')}</span>
      </button>
    </div>
    {#if tab === 'widgets'}
      <button class="aside-act" title={t('New note (N)')} aria-label={t('New note')} onclick={() => newNote()}>
        <Glyph name="plus" size={14} />
      </button>
    {:else}
      <button class="aside-act" title={t('New folder')} aria-label={t('New folder')} onclick={() => createFolder()}>
        <Glyph name="plus" size={14} />
      </button>
    {/if}
  </div>

  {#if tab === 'folders'}
    <nav class="folder-nav" aria-label={t('Folders')}>
      {#if folders.length === 0}
        <div class="folder-empty">{t('No folders')}</div>
      {:else}
      {#each folders as f (f.id)}
        <a
          class="folder-link"
          class:on={f.id === current}
          href={'#' + f.id}
          aria-current={f.id === current ? 'page' : undefined}
          style:--folder-color={w.colColors[f.id] ?? ''}
        >
          {#if w.colColors[f.id]}
            <span class="folder-dot" style:background={w.colColors[f.id]}></span>
          {:else}
            <span class="folder-dot empty"></span>
          {/if}
          <Glyph name="folder" size={14} />
          <span class="folder-name">{f.title}</span>
          <span class="folder-total">{childCount(f.id)}</span>
        </a>
      {/each}
      {/if}
    </nav>
  {:else}
    {#each w.widgets as x (x.id)}<WidgetCard w={x} />{/each}
    {#each w.notes as n (n.id)}
      <div class="rail-note" data-key={'note:' + n.id}>
        <div class="rail-note-head">
          <Glyph name="note" size={13} />
          <input
            class="rail-note-title"
            value={n.title}
            aria-label={t('Note')}
            oninput={(e) => { n.title = e.currentTarget.value; saveWs(); }}
          />
          <button class="rail-del" title={t('Delete note')} aria-label={t('Delete note')} onclick={() => deleteNote(n.id)}>
            <Glyph name="trash" size={13} />
          </button>
        </div>
        <NoteBody note={n} />
      </div>
    {/each}
    <select class="add-widget" aria-label={t('Add widget')} onchange={addWidget}>
      <option value="" hidden>{t('+ Add widget')}</option>
      {#each Object.entries(WIDGETS) as [type, def] (type)}
        <option value={type}>{t(def.label)}</option>
      {/each}
    </select>
  {/if}
</aside>
