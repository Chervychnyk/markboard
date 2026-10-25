<script lang="ts">
  import { t } from '@/lib/i18n';
  import { data, deleteSession, isDue, saveWs, app, ws, wsRoot } from '@/lib/store.svelte';
  import type { Row } from '@/lib/types';
  import { WIDGETS } from '@/lib/widgets';
  import Column from './Column.svelte';
  import Item from './Item.svelte';
  import NoteBody from './NoteBody.svelte';
  import WidgetCard from './WidgetCard.svelte';

  type Col = { k: string; title: string; folderId?: string; rows?: Row[]; note?: (typeof w.notes)[number] };
  const w = $derived(ws());
  const cols = $derived.by(() => {
    const r = wsRoot();
    const favs = data.flat.filter((n) => app.meta[n.id]?.fav);
    const due = data.flat.filter((n) => isDue(app.meta[n.id] ?? {}));
    const all: (Col | false)[] = [
      due.length > 0 && { k: 'reminders', title: t('⏰ Reminders'), rows: due },
      { k: 'widgets', title: t('Widgets') },
      favs.length > 0 && { k: 'favs', title: t('★ Favorites'), rows: favs },
      { k: 'recent', title: t('Recently added'), rows: data.recent },
      { k: 'top', title: t('Most visited'), rows: data.top },
      { k: 'root', title: r.title, rows: (r.children ?? []).filter((n) => n.url), folderId: r.id },
      ...(r.children ?? []).filter((n) => !n.url).map((f) => ({ k: f.id, title: f.title, rows: f.children ?? [], folderId: f.id })),
      ...w.notes.map((n) => ({ k: 'note:' + n.id, title: n.title, note: n })),
      app.sessions.length > 0 && { k: 'sessions', title: t('Sessions') },
    ];
    const cs = all.filter((c): c is Col => !!c);
    const byKey = new Map(cs.map((c) => [c.k, c]));
    const ordered = [...w.order.filter((k) => byKey.has(k)), ...cs.map((c) => c.k).filter((k) => !w.order.includes(k))];
    return ordered.filter((k) => !w.hiddenCols.includes(k)).map((k) => byKey.get(k)!);
  });

  function addWidget(e: Event & { currentTarget: HTMLSelectElement }) {
    const type = e.currentTarget.value;
    e.currentTarget.value = '';
    w.widgets.push({ id: crypto.randomUUID(), type });
    saveWs();
  }
</script>

{#each cols as c (c.k)}
  <Column k={c.k} title={c.title} folderId={c.folderId}>
    {#if c.k === 'widgets'}
      {#each w.widgets as x (x.id)}<WidgetCard w={x} />{/each}
      <select class="add-widget" aria-label={t('Add widget')} onchange={addWidget}>
        <option value="">{t('+ Add widget')}</option>
        {#each Object.entries(WIDGETS) as [k, d] (k)}<option value={k}>{t(d.label)}</option>{/each}
      </select>
    {:else if c.note}
      <NoteBody note={c.note} />
    {:else if c.k === 'sessions'}
      {#each app.sessions as s, i (s.at)}
        <div class="item">
          <button class="open" title={s.tabs.map((tab) => tab.title).join('\n')} onclick={() => browser.windows.create({ url: s.tabs.map((tab) => tab.url) })}>
            <span class="ico">🗂</span><span class="title">{`${s.name} · ${s.tabs.length}`}</span>
          </button>
          <span class="acts"><button title={t('Delete session')} onclick={() => deleteSession(i)}>×</button></span>
        </div>
      {/each}
    {:else}
      {#each c.rows ?? [] as n (n.id ?? n.url)}<Item {n} />{/each}
    {/if}
  </Column>
{/each}
