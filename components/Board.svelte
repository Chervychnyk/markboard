<script lang="ts">
  import { clamp } from '@/lib/core';
  import { t } from '@/lib/i18n';
  import {
    clearFilters, data, deleteSession, dropBookmark, hasActiveFilter, isCollapsed, isDue, look, matchesFilter, sortRows, app, toggleCollapsed, ws, wsRoot,
  } from '@/lib/store.svelte';
  import type { BNode, Note, Row, Widget } from '@/lib/types';
  import Column from './Column.svelte';
  import Glyph, { type GlyphName } from './Glyph.svelte';
  import Item from './Item.svelte';
  import NoteBody from './NoteBody.svelte';
  import WidgetCard from './WidgetCard.svelte';

  type Col = { k: string; title: string; folderId?: string; rows?: Row[]; note?: Note; widget?: Widget; icon?: GlyphName };
  const w = $derived(ws());
  const l = $derived(look());
  let vw = $state(typeof window !== 'undefined' ? window.innerWidth : 1440);

  const cols = $derived.by(() => {
    const r = wsRoot();
    const favs = data.flat.filter((n) => n.url && app.meta[n.id]?.fav);
    const due = data.flat.filter((n) => isDue(app.meta[n.id] ?? {}));
    const folders = (r.children ?? []).filter((n) => !n.url);
    const rootLinks = (r.children ?? []).filter((n) => n.url);
    const all: (Col | false)[] = [
      due.length > 0 && { k: 'reminders', title: t('Reminders'), rows: due, icon: 'bell' },
      ...folders.map((f): Col => ({ k: f.id, title: f.title, rows: f.children ?? [], folderId: f.id, icon: 'folder' })),
      (rootLinks.length > 0 || !folders.length) && { k: 'root', title: r.title, rows: rootLinks, folderId: r.id, icon: 'folder' },
      ...w.widgets.map((x): Col => ({ k: 'widget:' + x.id, title: x.label || x.type, widget: x })),
      ...w.notes.map((n): Col => ({ k: 'note:' + n.id, title: n.title, note: n, icon: 'note' })),
      favs.length > 0 && { k: 'favs', title: t('Favorites'), rows: favs, icon: 'star' },
      { k: 'recent', title: t('Recently added'), rows: data.recent, icon: 'clock' },
      { k: 'top', title: t('Most visited'), rows: data.top, icon: 'external' },
      app.sessions.length > 0 && { k: 'sessions', title: t('Sessions'), icon: 'sessions' },
    ];
    const cs = all.filter((c): c is Col => !!c);
    const byKey = new Map(cs.map((c) => [c.k, c]));
    const expandedOrder = w.order.flatMap((k) => (k === 'widgets' ? w.widgets.map((x) => 'widget:' + x.id) : [k]));
    const ordered = [
      ...expandedOrder.filter((k) => byKey.has(k)),
      ...cs.map((c) => c.k).filter((k) => !expandedOrder.includes(k)),
    ];
    return ordered
      .filter((k) => !w.hiddenCols.includes(k) && !(k.startsWith('widget:') && w.hiddenCols.includes('widgets')))
      .map((k) => byKey.get(k)!)
      .filter((c) => {
        if (!hasActiveFilter()) return true;
        if (!c.rows) return false;
        return visibleCount(c) > 0;
      });
  });

  function subFoldersOf(c: Col): BNode[] {
    if (!c.folderId || !c.rows) return [];
    return c.rows.filter((n): n is BNode => !n.url && Array.isArray(n.children));
  }

  function directLinksOf(c: Col): Row[] {
    if (!c.rows) return [];
    const base = c.folderId ? c.rows.filter((n) => !!n.url) : c.rows;
    return sortRows(base.filter((n) => matchesFilter(n)));
  }

  function visibleCount(c: Col): number {
    if (!c.rows) return 0;
    const direct = directLinksOf(c).length;
    const sub = subFoldersOf(c).reduce((s, f) => s + (f.children ?? []).filter((n) => matchesFilter(n)).length, 0);
    return direct + sub;
  }

  function countOf(c: Col): number | undefined {
    if (c.rows) return visibleCount(c);
    if (c.k === 'sessions') return app.sessions.length;
    if (c.note) return c.note.checklist.length || undefined;
    return undefined;
  }

  function estHeight(c: Col): number {
    if (!c.widget && isCollapsed(c.k)) return 38;
    if (c.widget) {
      return c.widget.type === 'photo' ? 196 : c.widget.type === 'snippet' ? 132 : c.widget.type === 'counter' ? 92 : 76;
    }
    if (c.note) {
      return 48 + (c.note.text ? 58 : 0) + c.note.checklist.length * 29 + 38;
    }
    if (c.k === 'sessions') {
      return 48 + app.sessions.length * 34;
    }
    const subs = subFoldersOf(c);
    const subH = subs.reduce((s, f) => {
      const n = (f.children ?? []).filter((x) => matchesFilter(x)).length;
      return s + 34 + (isCollapsed(f.id) ? 0 : n * 31 + 8);
    }, 0);
    const links = directLinksOf(c).length;
    return 46 + subH + Math.max(1, links) * 31;
  }

  const laneCount = $derived(l.columns ? clamp(l.columns, 1, 8) : vw >= 1200 ? 4 : vw >= 900 ? 3 : vw >= 640 ? 2 : 1);

  const lanes = $derived.by(() => {
    const n = Math.min(laneCount, Math.max(1, cols.length));
    const buckets: Col[][] = Array.from({ length: n }, () => []);
    const heights = new Array<number>(n).fill(0);
    for (const c of cols) {
      // Group standalone widgets into the rightmost lane on multi-column boards, just like Pikamark.
      let best = 0;
      if (c.widget && n >= 3) {
        best = n - 1;
      } else {
        for (let i = 1; i < n; i++) if (heights[i]! < heights[best]!) best = i;
      }
      buckets[best]!.push(c);
      heights[best]! += estHeight(c) + 12;
    }
    return buckets;
  });
</script>

<svelte:window bind:innerWidth={vw} />

{#if hasActiveFilter() && !cols.length}
  <div class="board-empty">
    <p class="board-empty-title">{t('Nothing matches these filters')}</p>
    <button type="button" class="btn sm" onclick={clearFilters}>{t('Clear filters')}</button>
  </div>
{:else}

{#each lanes as lane, li (li)}
  <div class="board-lane">
    {#each lane as c (c.k)}
      {#if c.widget}
        <WidgetCard w={c.widget} />
      {:else}
        <Column k={c.k} title={c.title} folderId={c.folderId} count={countOf(c)} icon={c.icon}>
          {#if c.note}
            <NoteBody note={c.note} />
          {:else if c.k === 'sessions'}
            {#each app.sessions as s, i (s.at)}
              <div class="session" role="listitem">
                <button class="session-open" title={s.tabs.map((tab) => tab.title).join('\n')} onclick={() => browser.windows.create({ url: s.tabs.map((tab) => tab.url) })}>
                  <span class="ico"><Glyph name="sessions" size={15} /></span>
                  <span class="title">{s.name}</span>
                  <span class="count">{s.tabs.length}</span>
                </button>
                <button class="session-del" title={t('Delete session')} aria-label={t('Delete session')} onclick={() => deleteSession(i)}><Glyph name="trash" size={14} /></button>
              </div>
            {/each}
          {:else}
            {@const subs = subFoldersOf(c)}
            {@const links = directLinksOf(c)}
            {#each subs as sub (sub.id)}
              {@const subLinks = sortRows((sub.children ?? []).filter((n) => matchesFilter(n)))}
              {#if !hasActiveFilter() || subLinks.length}
                <div
                  class="subfolder"
                  class:collapsed={isCollapsed(sub.id)}
                  ondragover={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  ondrop={(e) => { e.preventDefault(); e.stopPropagation(); dropBookmark(e, sub.id); }}
                  role="group"
                  aria-label={sub.title}
                >
                  <div class="subfolder-head">
                    <button type="button" class="subfolder-toggle" onclick={() => toggleCollapsed(sub.id)} aria-expanded={!isCollapsed(sub.id)} title={sub.title}>
                      <Glyph name="folder" size={14} />
                    </button>
                    <a class="subfolder-name" href={'#' + sub.id} title={t('Open gallery')}>{sub.title}</a>
                    <span class="subfolder-count">{subLinks.length}</span>
                    <button type="button" class="subfolder-chev" onclick={() => toggleCollapsed(sub.id)} aria-label={sub.title}>
                      <Glyph name="chevron" size={12} />
                    </button>
                  </div>
                  {#if !isCollapsed(sub.id) && subLinks.length}
                    <div class="subfolder-list">
                      {#each subLinks as item (item.id ?? item.url)}<Item n={item} />{/each}
                    </div>
                  {/if}
                </div>
              {/if}
            {/each}
            {#if links.length}
              {#each links as n (n.id ?? n.url)}<Item {n} />{/each}
            {:else if !subs.length}
              <p class="col-empty">{t('No bookmarks yet')}</p>
            {/if}
          {/if}
        </Column>
      {/if}
    {/each}
  </div>
{/each}
{/if}
