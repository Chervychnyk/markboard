<script lang="ts">
  import { tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { clamp, isLocal, layoutLanes } from '@/lib/core';
  import { t } from '@/lib/i18n';
  import {
    clearFilters, data, deleteSession, dropBookmark, hasActiveFilter, isCollapsed, isDue, isFav, look, matchesFilter, placeCard, sortRows, app, toggleCollapsed, ui, ws, wsFolders, wsRoot,
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
    const favs = data.flat.filter((n) => n.url && isFav(n.id));
    const due = data.flat.filter((n) => isDue(app.meta[n.id] ?? {}));
    const folders = wsFolders();
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

  const lanes = $derived(layoutLanes(cols, laneCount, w.lanes, estHeight, (c) => !!c.widget));
  $effect(() => { ui.lanes = lanes.map((l) => l.map((c) => c.k)); });

  // Dragging a card by its header: it lifts and follows the pointer, and a gap opens in the lane where it would land.
  // `lane`/`index` is that spot among the other cards; `dx`/`dy` is where the card was grabbed.
  type Drag = { k: string; from: number; at: number; lane: number; index: number; x: number; y: number; dx: number; dy: number; w: number; h: number };
  let drag = $state<Drag | null>(null);
  const laneEls: HTMLElement[] = $state([]);
  const GAP = '\0gap';

  const shown = $derived.by(() => {
    const d = drag;
    if (!d) return lanes;
    return lanes.map((l, i) => {
      const out = l.filter((c) => c.k !== d.k);
      if (i === d.lane) out.splice(d.index, 0, { k: GAP, title: '' });
      // The lifted card stays mounted in its own lane; being fixed, it takes no room there.
      if (i === d.from) out.splice(Math.min(d.at, out.length), 0, l[d.at]!);
      return out;
    });
  });

  const cardEl = (k: string) => document.querySelector<HTMLElement>(`[data-card="${CSS.escape(k)}"]`);

  function grab(e: PointerEvent) {
    const t = e.target as Element;
    if (e.button !== 0 || hasActiveFilter() || !t.closest('.col-head, .whead') || t.closest('button, input, select, textarea, label')) return;
    const el = t.closest<HTMLElement>('[data-card]');
    if (!el) return;
    const k = el.dataset.card!, x0 = e.clientX, y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      if (!drag) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        const from = lanes.findIndex((l) => l.some((c) => c.k === k)), at = lanes[from]!.findIndex((c) => c.k === k), r = el.getBoundingClientRect();
        drag = { k, from, at, lane: from, index: at, x: 0, y: 0, dx: x0 - r.left, dy: y0 - r.top, w: r.width, h: r.height };
        document.documentElement.classList.add('card-dragging');
        scroll();
      }
      drag.x = ev.clientX;
      drag.y = ev.clientY;
      aim();
    };
    const up = () => { stop(); if (drag) void settle(true); };
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && drag) { stop(); void settle(false); } };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key, true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key, true);
  }

  /** Finds the lane nearest the pointer, and the spot in it: past every card whose middle is above the pointer. */
  function aim() {
    if (!drag) return;
    const { x, y } = drag;
    let lane = 0, best = Infinity;
    laneEls.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if (d < best) { best = d; lane = i; }
    });
    const el = laneEls[lane];
    if (!el) return;
    // offsetTop, not the on-screen box, so cards still gliding (FLIP) don't make the gap flicker.
    const top = el.getBoundingClientRect().top;
    const cards = [...el.querySelectorAll<HTMLElement>(':scope > [data-card]')].filter((c) => c.dataset.card !== drag!.k);
    const index = cards.filter((c) => top + c.offsetTop + c.offsetHeight / 2 < y).length;
    if (lane !== drag.lane || index !== drag.index) { drag.lane = lane; drag.index = index; }
  }

  /** Scrolls the page while the card is held near its top or bottom edge. */
  function scroll() {
    if (!drag) return;
    const edge = 70, y = drag.y, h = window.innerHeight;
    const v = y < edge ? -(edge - y) / 4 : y > h - edge ? (y - (h - edge)) / 4 : 0;
    if (v) { window.scrollBy(0, v); aim(); }
    requestAnimationFrame(scroll);
  }

  /** Drops the card (or, cancelled, sends it back) and glides it from under the pointer into its place. */
  async function settle(keep: boolean) {
    const d = drag!, from = cardEl(d.k)!.getBoundingClientRect();
    drag = null;
    document.documentElement.classList.remove('card-dragging');
    // A drag ends in a click wherever the pointer rose; a column title there would open its gallery.
    const swallow = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }));
    if (keep && !(d.lane === d.from && d.index === d.at)) placeCard(d.k, d.lane, d.index);
    await tick();
    const el = cardEl(d.k), to = el?.getBoundingClientRect();
    if (!el || !to) return;
    el.animate(
      [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`, zIndex: 60 }, { transform: 'none', zIndex: 60 }],
      { duration: 260, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
    );
  }
</script>

<svelte:window bind:innerWidth={vw} />

{#if hasActiveFilter() && !cols.length}
  <div class="board-empty">
    <p class="board-empty-title">{t('Nothing matches these filters')}</p>
    <button type="button" class="btn sm" onclick={clearFilters}>{t('Clear filters')}</button>
  </div>
{:else}

{#each shown as lane, li (li)}
  <!-- svelte-ignore a11y_no_static_element_interactions (dragging is a pointer-only extra; the column menu's arrows move cards too) -->
  <div class="board-lane" class:target={drag?.lane === li} bind:this={laneEls[li]} onpointerdown={grab}>
    {#each lane as c (c.k)}
      {@const lifted = drag?.k === c.k}
      <div
        class={c.k === GAP ? 'card-gap' : 'card'}
        class:lifted
        data-card={c.k === GAP ? undefined : c.k}
        style:height={c.k === GAP ? `${drag?.h ?? 0}px` : undefined}
        style:width={lifted ? `${drag!.w}px` : undefined}
        style:transform={lifted ? `translate3d(${drag!.x - drag!.dx}px, ${drag!.y - drag!.dy}px, 0)` : undefined}
        animate:flip={{ duration: lifted ? 0 : 240, easing: cubicOut }}
      >
        {#if c.k !== GAP}{@render card(c)}{/if}
      </div>
    {/each}
  </div>
{/each}
{/if}

{#snippet card(c: Col)}
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
          <div class="col-empty">
            <p>{t('No bookmarks yet')}</p>
            <p class="col-empty-hint">{isLocal(c.folderId) ? t('Add one with + or the toolbar button') : t('Add one with + or the ☆ in the address bar')}</p>
          </div>
        {/if}
      {/if}
    </Column>
  {/if}
{/snippet}
