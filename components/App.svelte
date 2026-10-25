<script lang="ts">
  import { onMount } from 'svelte';
  import { backupNow } from '@/lib/backup';
  import { COMMANDS, TABKIT_ID, type TabkitMessage } from '@/lib/commands';
  import { clamp } from '@/lib/core';
  import { form, modal, toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { settings } from '@/lib/settings';
  import {
    addWorkspace, bulkRename, cycleTheme, cycleView, data, DATA_IMG, dedupe, deleteWorkspace, duplicateGroups, emptyTrash, exportData, FONTS, HEX,
    loadTemplate, look, newNote, open, PRESETS, save, saveSession, saveTabs, saveWs, app, switchWs, toggleSelect, TRASH_DAYS, ui, ws,
  } from '@/lib/store.svelte';
  import Board from './Board.svelte';
  import Dialogs from './Dialogs.svelte';
  import Duplicates from './Duplicates.svelte';
  import Gallery from './Gallery.svelte';
  import Help from './Help.svelte';
  import Pins from './Pins.svelte';
  import Selbar from './Selbar.svelte';
  import Trash from './Trash.svelte';

  const l = $derived(look());
  const gallery = $derived(!!ui.view && data.byId.has(ui.view)); // a deleted folder falls back to the board

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
    const cols = clamp(l.columns, 0, 12);
    root.style.setProperty('--col-w', cols ? `calc((100vw - 32px - ${(cols - 1) * 12}px) / ${cols})` : '');
    document.body.classList.toggle('compact', !!l.compact);
  });

  const background = $derived.by(() => {
    const [c1, c2] = PRESETS[l.bgPreset] ?? [l.bgColor, l.bgColor2].map((c) => (HEX.test(c) ? c : '#000000'));
    return l.bgKind === 'solid' ? (HEX.test(l.bgColor) ? l.bgColor : '')
      : l.bgKind === 'gradient' ? `linear-gradient(135deg, ${c1}, ${c2})`
      : l.bgKind === 'photo' && DATA_IMG.test(l.bgImage) ? `center / cover no-repeat url("${l.bgImage}")`
      : '';
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
    if (e.key === 'Escape' && ui.selecting) return toggleSelect();
    const hit = COMMANDS.find((c) => c.key?.toLowerCase() === e.key.toLowerCase());
    if (hit) { e.preventDefault(); run(hit.id); }
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
</script>

<svelte:window
  onkeydown={onKey}
  onmousemove={(e) => parallax && (shift = `translate(${(0.5 - e.clientX / innerWidth) * 16}px, ${(0.5 - e.clientY / innerHeight) * 16}px)`)}
/>

<div id="bg" aria-hidden="true" class:grain={l.grain && l.bgKind !== 'none'} style:background style:opacity={clamp(l.intensity, 0, 100) / 100}
  style:transform={parallax ? shift : null}></div>
<header class="top">
  <button class="searchbox" onclick={openTabkit} title={t('Search & command palette')}>
    <span class="muted">{t('Search and commands (F)')}</span>
  </button>
  <select id="ws" aria-label={t('Workspace')} value={app.ws} onchange={onWorkspace}>
    {#each Object.entries(app.workspaces) as [id, w] (id)}<option value={id}>{w.name}</option>{/each}
    <option value="__new">{t('+ New workspace…')}</option>
    <option value="__rename">{t('Rename workspace…')}</option>
    {#if Object.keys(app.workspaces).length > 1}<option value="__delete">{t('Delete this workspace')}</option>{/if}
  </select>
  {#if gallery}
    <span id="gallery-tools">
      <select aria-label={t('Sort')} bind:value={ui.sort}>
        <option value="manual">{t('Manual')}</option>
        <option value="name">{t('Name')}</option>
        <option value="date">{t('Date added')}</option>
      </select>
      <select aria-label={t('Gallery layout')} bind:value={app.galleryMode} onchange={() => save('galleryMode')}>
        <option value="compact">{t('Grid')}</option>
        <option value="extended">{t('Extended')}</option>
        <option value="list">{t('List')}</option>
      </select>
      <button class="btn" onclick={bulkRename}>{t('Bulk rename')}</button>
    </span>
  {/if}
  <button class="btn" title={t('New note (N)')} onclick={newNote}>{t('+ Note')}</button>
  <button class="btn" title={t('Selection mode (S)')} onclick={toggleSelect}>{t('Select')}</button>
  <button class="btn" onclick={saveTabs}>{t('Save tabs')}</button>
  <button class="btn" onclick={saveSession}>{t('Save session')}</button>
  <button class="btn" aria-label={t('Trash')} title={t('Trash')} onclick={showTrash}>🗑</button>
  <button class="btn" aria-label={t('Cycle theme (T)')} title={t('Cycle theme (T)')} onclick={cycleTheme}>◐</button>
  <button class="btn" aria-label={t('Settings')} title={t('Settings')} onclick={settings}>⚙</button>
  <button class="btn" aria-label={t('Keyboard shortcuts (?)')} title={t('Keyboard shortcuts (?)')} onclick={() => run('help')}>?</button>
</header>
<Pins />
<main id="main" class={gallery ? 'gallery-view' : 'board'}>
  {#if gallery}<Gallery id={ui.view!} />{:else}<Board />{/if}
</main>
{#if ui.selecting}<Selbar />{/if}
<Dialogs />
