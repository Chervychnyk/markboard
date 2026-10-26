<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '@/lib/i18n';
  import {
    COLORS, createBookmark, createFolder, data, deleteNote, HEX, moveColumn, open, openAll, removeMany, saveWs, ui, ws,
  } from '@/lib/store.svelte';
  import Glyph from './Glyph.svelte';

  // The column ⋮ menu: the item menu's layout, for a whole column. Name and color are this workspace's own.
  const c = $derived(ui.colMenu);
  const color = $derived(c ? ws().colColors[c.k] ?? '' : '');
  const noteId = $derived(c?.k.startsWith('note:') ? c.k.slice(5) : '');
  const isFolder = $derived(!!c?.folderId && data.byId.has(c.folderId));
  // Browser root folders (Bookmarks bar, Other bookmarks) can't be deleted; neither can the board's own root.
  const canDelete = $derived(isFolder && data.byId.get(c!.folderId!)?.parentId !== '0' && c!.folderId !== data.bar?.id && c!.k !== 'root');
  const close = () => (ui.colMenu = null);

  const pos = $derived.by(() => {
    const r = c?.rect;
    if (!r) return { top: '80px', left: '80px', width: '308px' };
    const w = Math.min(Math.max(r.right - r.left, 308), 360, innerWidth - 24);
    return { top: `${Math.round(r.bottom + 6)}px`, left: `${Math.round(Math.max(12, Math.min(innerWidth - w - 12, r.left)))}px`, width: `${Math.round(w)}px` };
  });

  function rename(e: Event & { currentTarget: HTMLInputElement }) {
    if (!c) return;
    const v = e.currentTarget.value.trim();
    if (v && v !== c.title) ws().colNames[c.k] = v; else delete ws().colNames[c.k];
    saveWs();
  }

  function setColor(v: string) {
    if (!c) return;
    if (v) ws().colColors[c.k] = v; else delete ws().colColors[c.k];
    saveWs();
  }

  const run = (fn: () => unknown) => () => { close(); fn(); };

  // The column jumps to another lane, so the menu follows its header there.
  async function move(dir: -1 | 1) {
    if (!c) return;
    moveColumn(c.k, dir);
    await tick();
    const head = document.querySelector(`#main .col[data-key="${CSS.escape(c.k)}"] .col-head`);
    if (head && ui.colMenu) {
      const r = head.getBoundingClientRect();
      ui.colMenu.rect = { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
    }
  }
  function hide() {
    if (!c) return;
    ws().hiddenCols.push(c.k);
    saveWs();
    close();
  }
  function remove() {
    if (!c) return;
    const { folderId } = c;
    close();
    if (noteId) deleteNote(noteId);
    else if (folderId && canDelete) removeMany([folderId]);
  }
</script>

{#if c}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="im-backdrop" onclick={close}></div>
  <div
    class="item-menu col-menu"
    role="dialog"
    tabindex="-1"
    aria-label={t('Column options')}
    style:top={pos.top}
    style:left={pos.left}
    style:width={pos.width}
    onkeydown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())}
  >
    <input
      class="im-input"
      value={ws().colNames[c.k] || c.title}
      aria-label={t('Name')}
      placeholder={c.title}
      onchange={rename}
      onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />

    {#if isFolder}
      <div class="im-group">
        <div class="im-label">{t('Manage')}</div>
        <div class="im-grid2">
          <button type="button" class="im-act" onclick={run(() => open(c.folderId!))}><Glyph name="grid" size={14} /><span>{t('Gallery')}</span></button>
          <button type="button" class="im-act" onclick={run(() => openAll(c.folderId!))}><Glyph name="external" size={14} /><span>{t('Open all')}</span></button>
          <button type="button" class="im-act" onclick={run(() => createFolder(c.folderId!))}><Glyph name="folder" size={14} /><span>{t('New folder')}</span></button>
          <button type="button" class="im-act" onclick={run(() => createBookmark(c.folderId!))}><Glyph name="plus" size={14} /><span>{t('New bookmark')}</span></button>
        </div>
      </div>
    {/if}

    <div class="im-group">
      <div class="im-label">{t('Color')}</div>
      <div class="im-swatches" role="group" aria-label={t('Color')}>
        {#each COLORS as sw (sw)}
          <button
            type="button"
            class="im-swatch {sw ? 'sw-' + sw : 'sw-none'}"
            class:on={color === sw}
            title={sw || t('No color')}
            aria-label={sw || t('No color')}
            aria-pressed={color === sw}
            onclick={() => setColor(sw)}
          >{#if !sw}<Glyph name="slash" size={13} />{/if}</button>
        {/each}
        <label class="im-swatch sw-custom" class:on={HEX.test(color)} title={t('Custom color')} style:--sw={HEX.test(color) ? color : null}>
          {#if !HEX.test(color)}<Glyph name="swatch" size={13} />{/if}
          <input type="color" value={HEX.test(color) ? color : '#1d5fbf'} oninput={(e) => setColor(e.currentTarget.value)} aria-label={t('Custom color')} />
        </label>
      </div>
    </div>

    <div class="im-group">
      <div class="im-label">{t('Arrange')}</div>
      <div class="im-arrange">
        <div class="im-arrows">
          <button type="button" title={t('Move earlier')} aria-label={t('Move earlier')} disabled={ui.colOrder.indexOf(c.k) <= 0} onclick={() => move(-1)}><Glyph name="left" size={14} /></button>
          <button type="button" title={t('Move later')} aria-label={t('Move later')} disabled={ui.colOrder.indexOf(c.k) >= ui.colOrder.length - 1} onclick={() => move(1)}><Glyph name="right" size={14} /></button>
        </div>
      </div>
    </div>

    <div class="im-foot">
      <div class="im-foot-btns">
        <button type="button" class="im-btn" title={t('Hide column in this workspace')} onclick={hide}>
          <Glyph name="eye-off" size={14} /><span>{t('Hide')}</span>
        </button>
        {#if canDelete || noteId}
          <button type="button" class="im-btn danger" title={noteId ? t('Delete note') : t('Shared across workspaces: deleting removes it everywhere. Hide it to keep it in just this one')} onclick={remove}>
            <Glyph name="trash" size={14} /><span>{t('Delete')}</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
