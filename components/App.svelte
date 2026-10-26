<script lang="ts">
  import { onMount } from 'svelte';
  import { backupNow } from '@/lib/backup';
  import { COMMANDS, TABKIT_ID, type TabkitMessage } from '@/lib/commands';
  import { clamp } from '@/lib/core';
  import { form, modal, toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { settings } from '@/lib/settings';
  import {
    addWorkspace, clearFilters, closeItemMenu, createBookmark, createFolder, cycleTheme, cycleView,
    data, DATA_IMG, dedupe, deleteFromMenu, hideFromMenu, deleteWorkspace, duplicateGroups, emptyTrash, exportData, FONTS, hasActiveFilter, HEX,
    loadTemplate, look, newNote, open, PRESETS, save, saveSession, saveTabs, saveWs, app, switchWs, toggleSelect, TRASH_DAYS, ui, ws, wsRoot,
  } from '@/lib/store.svelte';
  import type { BNode } from '@/lib/types';
  import { WIDGETS } from '@/lib/widgets';
  import Board from './Board.svelte';
  import Dialogs from './Dialogs.svelte';
  import Duplicates from './Duplicates.svelte';
  import Gallery from './Gallery.svelte';
  import Glyph from './Glyph.svelte';
  import Help from './Help.svelte';
  import ItemMenu from './ItemMenu.svelte';
  import Mark from './Mark.svelte';
  import FilterMenu from './FilterMenu.svelte';
  import Pins from './Pins.svelte';
  import Selbar from './Selbar.svelte';
  import Trash from './Trash.svelte';

  const l = $derived(look());
  const shown = (tool: string) => !app.hiddenTools.includes(tool);
  const gallery = $derived(!!ui.view && data.byId.has(ui.view)); // a deleted folder falls back to the board
  const firstFolderId = $derived((wsRoot().children ?? []).find((n) => !n.url)?.id ?? wsRoot().id);

  // --- look ---

  const dark = matchMedia('(prefers-color-scheme: dark)');
  let osDark = $state(dark.matches);
  dark.addEventListener('change', () => (osDark = dark.matches));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parallax = $derived(l.parallax && !reduceMotion);
  let shift = $state('');

  $effect(() => {
    const root = document.documentElement;
    root.dataset.theme = l.theme === 'system' ? (osDark ? 'dark' : 'light') : ['light', 'dark', 'black'].includes(l.theme) ? l.theme : 'light';
    root.style.setProperty('--accent', HEX.test(l.accent) ? l.accent : '');
    root.style.setProperty('--font', FONTS[l.font] ?? FONTS.system!);
    root.style.setProperty('--panel-alpha', `${clamp(l.panelOpacity, 30, 100)}%`);
    document.body.classList.toggle('compact', !!l.compact);
  });

  const background = $derived.by(() => {
    const [c1, c2] = PRESETS[l.bgPreset] ?? [l.bgColor, l.bgColor2].map((c) => (HEX.test(c) ? c : '#000000'));
    return l.bgKind === 'solid' ? (HEX.test(l.bgColor) ? l.bgColor : '')
      : l.bgKind === 'gradient' ? `linear-gradient(135deg, ${c1}, ${c2})` // taste-skill-ignore: opt-in user wallpaper preset
      : l.bgKind === 'photo' && DATA_IMG.test(l.bgImage) ? `center / cover no-repeat url("${l.bgImage}")`
      : '';
  });

  // Links and folders under this workspace's root, counted once for the scope line.
  const counts = $derived.by(() => {
    let links = 0;
    let folders = 0;
    const walk = (n: BNode) => {
      for (const c of n.children ?? []) {
        if (c.url) links++;
        else { folders++; walk(c); }
      }
    };
    walk(wsRoot());
    return { links, folders };
  });

  // --- commands (keys on the board, and run from the Tabkit palette) ---

  /** F: Tabkit is the search and command palette; it opens over this tab. */
  const openTabkit = () =>
    browser.runtime.sendMessage(TABKIT_ID, { type: 'tabkit:open' } satisfies TabkitMessage)
      .catch(() => toast(t('Install Tabkit to search and run commands')));

  const showTrash = () => modal(t('Trash · kept for {0} days', TRASH_DAYS), Trash, {}, app.trash.length ? [[t('Empty trash'), emptyTrash]] : []);

  function showDuplicates() {
    const groups = duplicateGroups();
    const extra = groups.reduce((s, g) => s + g.length - 1, 0);
    modal(groups.length ? t('Duplicate bookmarks: {0}', extra) : t('No duplicates found'), Duplicates, { groups },
      groups.length ? [[t('Keep one of each'), () => dedupe(groups)]] : []);
  }

  const RUN: Record<string, () => unknown> = {
    search: openTabkit, view: cycleView, select: toggleSelect, note: newNote, theme: cycleTheme, board: () => open(null),
    duplicates: showDuplicates, help: () => modal(t('Keyboard shortcuts'), Help), 'save-tabs': saveTabs, 'save-session': saveSession,
    settings, trash: showTrash, export: exportData, backup: () => backupNow().then(() => toast(t('Backup saved'))),
  };
  function run(id: string) {
    if (id.startsWith('ws:')) return app.workspaces[id.slice(3)] && switchWs(id.slice(3));
    if (id.startsWith('template:')) return loadTemplate(id.slice(9));
    RUN[id]?.();
  }

  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof Element && e.target.closest('input, textarea, select, dialog'))) return;
    if (e.key === 'Escape') {
      if (ui.menuId) return closeItemMenu();
      if (ui.selecting) return toggleSelect();
      if (hasActiveFilter()) return clearFilters();
    }
    if (ui.menuId && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); return hideFromMenu(); }
    if (ui.menuId && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); return deleteFromMenu(); }
    const hit = COMMANDS.find((c) => c.key?.toLowerCase() === e.key.toLowerCase());
    if (hit) { e.preventDefault(); run(hit.id); }
  }

  function onMore(e: Event & { currentTarget: HTMLSelectElement }) {
    const v = e.currentTarget.value;
    e.currentTarget.value = '';
    if (v) run(v);
  }

  function onQuickAdd(e: Event & { currentTarget: HTMLSelectElement }) {
    const v = e.currentTarget.value;
    e.currentTarget.value = '';
    if (!v) return;
    if (v === 'bookmark') createBookmark(ui.view ?? undefined);
    else if (v === 'folder') createFolder(ui.view ?? undefined);
    else if (v === 'note') newNote();
    else if (v.startsWith('widget:')) {
      ws().widgets.push({ id: crypto.randomUUID(), type: v.slice(7) });
      saveWs();
    }
  }

  onMount(() => {
    browser.runtime.sendMessage({ type: 'register' }).catch(() => {});
    // A command picked in Tabkit while this tab was current; the background asks every board page, this tab's answers.
    let myTab: number | undefined;
    browser.tabs.getCurrent().then((tab) => (myTab = tab?.id));
    const onMessage = (msg: { type: string; command: string; tabId?: number }, _: unknown, reply: (r: boolean) => void) => {
      if (msg.type !== 'command' || msg.tabId !== myTab) return;
      run(msg.command);
      reply(true);
    };
    browser.runtime.onMessage.addListener(onMessage);
    // Opened by the background to run a command (no board tab was current).
    const params = new URLSearchParams(location.search);
    if (params.has('cmd')) {
      history.replaceState(null, '', location.pathname + location.hash);
      run(params.get('cmd')!);
    }
    return () => browser.runtime.onMessage.removeListener(onMessage);
  });

  async function onWorkspace(e: Event & { currentTarget: HTMLSelectElement }) {
    const v = e.currentTarget.value;
    e.currentTarget.value = app.ws; // snap back from the "+ New…"/rename/delete choices
    if (v === '__new' || v === '__rename') {
      const r = await form(v === '__new' ? t('New workspace') : t('Rename workspace'), [{ name: 'name', label: t('Name'), value: v === '__new' ? '' : ws().name, required: true }]);
      if (r && v === '__new') addWorkspace(r.name);
      else if (r) { ws().name = r.name; saveWs(); }
    } else if (v === '__delete') deleteWorkspace();
    else switchWs(v);
  }

  async function promptNewWs() {
    const r = await form(t('New workspace'), [{ name: 'name', label: t('Name'), value: '', required: true }]);
    if (r?.name) addWorkspace(r.name);
  }
</script>

<svelte:window
  onkeydown={onKey}
  onmousemove={(e) => parallax && (shift = `translate(${(0.5 - e.clientX / innerWidth) * 16}px, ${(0.5 - e.clientY / innerHeight) * 16}px)`)}
/>

<div id="bg" aria-hidden="true" class:grain={l.grain && l.bgKind !== 'none'} style:background style:opacity={clamp(l.intensity, 0, 100) / 100}
  style:transform={parallax ? shift : null}></div>
<header class="top">
  <button class="brand" onclick={() => open(null)} aria-label="Markboard" title={t('Board')}>
    <Mark size={19} />
    <span class="brand-name">Markboard</span>
  </button>
  <span class="top-sep" aria-hidden="true"></span>
  <div class="scope">
    {#if gallery}<span class="scope-name">{ws().name}</span>{:else}<h1 class="scope-name">{ws().name}</h1>{/if}
    {#if shown('meta')}<span class="scope-meta">{t('{0} links · {1} folders', counts.links, counts.folders)}</span>{/if}
    <span class="scope-chev"><Glyph name="chevron" size={12} /></span>
    <select id="ws" aria-label={t('Workspace')} value={app.ws} onchange={onWorkspace}>
      {#each Object.entries(app.workspaces) as [id, w] (id)}<option value={id}>{w.name}</option>{/each}
      <option value="__new">{t('+ New workspace…')}</option>
      <option value="__rename">{t('Rename workspace…')}</option>
      {#if Object.keys(app.workspaces).length > 1}<option value="__delete">{t('Delete this workspace')}</option>{/if}
    </select>
  </div>

  <div class="top-filters" role="toolbar" aria-label={t('Board')}>
    {#if shown('filter')}<FilterMenu />{/if}
    {#if shown('hidden')}
    <button
      type="button"
      class="tool-icon"
      class:on={app.showHidden}
      aria-pressed={app.showHidden}
      title={t('Show hidden items')}
      aria-label={t('Show hidden items')}
      onclick={() => { app.showHidden = !app.showHidden; save('showHidden'); }}
    >
      <Glyph name={app.showHidden ? 'eye' : 'eye-off'} size={15} />
    </button>
    {/if}
    {#if shown('add')}
    <div class="menu-select tool-icon" title={t('New bookmark')}>
      <Glyph name="plus" size={15} />
      <select aria-label={t('New bookmark')} onchange={onQuickAdd}>
        <option value="">+ {t('New bookmark')}</option>
        <option value="bookmark">{t('New bookmark')}</option>
        <option value="folder">{t('New folder')}</option>
        <option value="note">{t('New note')}</option>
        {#each Object.entries(WIDGETS) as [k, d] (k)}
          <option value={'widget:' + k}>{t('+ Add widget')}: {t(d.label)}</option>
        {/each}
      </select>
    </div>
    {/if}
  </div>

  <button class="search" onclick={openTabkit} aria-label={t('Search and commands (F)')} title={t('Search and commands (F)')}>
    <Glyph name="search" size={15} />
    <span class="search-label">{t('Search or run a command')}</span>
    <kbd>F</kbd>
  </button>

  <div class="top-actions">
    {#if shown('sort')}
    <div class="sort-pill" title={t('Sort')}>
      <Glyph name="sort" size={13} />
      <select aria-label={t('Sort')} bind:value={ui.sort}>
        <option value="manual">{t('Manual')}</option>
        <option value="name">{t('Name')}</option>
        <option value="date">{t('Date added')}</option>
      </select>
    </div>
    {/if}
    {#if shown('density')}
    <button
      type="button"
      class="tool-icon"
      class:on={l.compact}
      title={t('Switch view density / gallery layout')}
      aria-label={t('Switch view density / gallery layout')}
      onclick={cycleView}
    >
      <Glyph name="list" size={15} />
    </button>
    {/if}
    {#if shown('gallery')}
    <button
      type="button"
      class="tool-icon"
      class:on={gallery}
      title={gallery ? t('Back to board') : t('Open gallery')}
      aria-label={gallery ? t('Back to board') : t('Open gallery')}
      onclick={() => open(gallery ? null : firstFolderId)}
    >
      <Glyph name="grid" size={15} />
    </button>
    {/if}
    <button
      type="button"
      class="tool-icon"
      title={t('Settings')}
      aria-label={t('Settings')}
      onclick={settings}
    >
      <Glyph name="settings" size={15} />
    </button>
  </div>
</header>

{#if hasActiveFilter()}
  <div class="filter-bar" role="status">
    {#if ui.filterFav}
      <button type="button" class="filter-chip" onclick={() => (ui.filterFav = false)} aria-label={t('Remove filter: {0}', t('Favorites'))}>
        <Glyph name="star-fill" size={12} />{t('Favorites')}<Glyph name="x" size={12} />
      </button>
    {/if}
    {#if ui.filterColor}
      <button type="button" class="filter-chip" onclick={() => (ui.filterColor = '')} aria-label={t('Remove filter: {0}', ui.filterColor)}>
        <span class="color-dot dot-{ui.filterColor}"></span>{ui.filterColor}<Glyph name="x" size={12} />
      </button>
    {/if}
    {#if ui.filterTag}
      <button type="button" class="filter-chip" onclick={() => (ui.filterTag = '')} aria-label={t('Remove filter: {0}', '#' + ui.filterTag)}>
        #{ui.filterTag}<Glyph name="x" size={12} />
      </button>
    {/if}
    <button type="button" class="filter-clear-all" onclick={clearFilters}>{t('Clear filters')}</button>
  </div>
{/if}

<main id="main" class:board={!gallery} class:gallery-view={gallery}>
  {#if gallery}<Gallery id={ui.view!} />{:else}<Board />{/if}
</main>

<footer class="dock">
  <div class="dock-ws" role="tablist" aria-label={t('Workspace')}>
    {#each Object.entries(app.workspaces) as [id, w] (id)}
      <button
        type="button"
        role="tab"
        class="dock-ws-btn"
        class:on={id === app.ws}
        aria-selected={id === app.ws}
        onclick={() => switchWs(id)}
      >
        <span class="dock-ws-dot"></span>
        <span>{w.name}</span>
      </button>
    {/each}
    <button type="button" class="dock-ws-add" title={t('+ New workspace…')} aria-label={t('+ New workspace…')} onclick={promptNewWs}>
      <Glyph name="plus" size={13} />
    </button>
  </div>

  {#if shown('pins')}<Pins />{/if}

  <div class="dock-tools">
    <button type="button" class="dock-tool" title={t('New note (N)')} aria-label={t('New note')} onclick={newNote}>
      <Glyph name="note" size={14} /><span class="dock-label">{t('New note')}</span>
    </button>
    <button type="button" class="dock-tool" title={t('Save tabs')} aria-label={t('Save tabs')} onclick={saveTabs}>
      <Glyph name="tabs" size={14} /><span class="dock-label">{t('Save tabs')}</span>
    </button>
    <button type="button" class="dock-tool" title={t('Trash')} aria-label={t('Trash')} onclick={showTrash}>
      <Glyph name="trash" size={14} />
    </button>
    <div class="menu-select dock-tool" title={t('More')}>
      <Glyph name="more" size={15} />
      <select aria-label={t('More')} onchange={onMore}>
        <option value="">{t('More')}</option>
        <option value="select">{t('Select')}</option>
        <option value="note">{t('New note')}</option>
        <option value="save-session">{t('Save session')}</option>
        <option value="duplicates">{t('Find duplicates')}</option>
        <option value="trash">{t('Trash')}</option>
        <option value="export">{t('Export')}</option>
        <option value="backup">{t('Back up now')}</option>
        <option value="help">{t('Keyboard shortcuts')}</option>
        <option value="settings">{t('Settings')}</option>
        <option value="theme">{t('Cycle theme (T)')}</option>
      </select>
    </div>
  </div>
</footer>

{#if ui.selecting}<Selbar />{/if}
<ItemMenu />
<Dialogs />
