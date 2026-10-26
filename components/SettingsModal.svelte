<script lang="ts">
  import { backupNow } from '@/lib/backup';
  import { TEMPLATES } from '@/lib/commands';
  import { form, toast } from '@/lib/dialogs.svelte';
  import { LANGS, locale, t } from '@/lib/i18n';
  import { ACCENT_NAMES, pickBackupFile } from '@/lib/settings';
  import {
    ACCENTS, addWorkspace, applyData, dedupe, deleteWorkspace, duplicateGroups, emptyTrash, exportData,
    folderOptions, FONT_NAMES, FONTS, loadTemplate, look, PRESET_NAMES, PRESETS, save, saveWs, app, switchWs, TRASH_DAYS, ws, wsRoot,
  } from '@/lib/store.svelte';
  import Duplicates from './Duplicates.svelte';
  import Glyph, { type GlyphName } from './Glyph.svelte';
  import Help from './Help.svelte';
  import Mark from './Mark.svelte';
  import Trash from './Trash.svelte';

  let { close }: { close: () => void } = $props();

  type TabId = 'appearance' | 'board' | 'workspaces' | 'toolbar' | 'general' | 'trash' | 'backups' | 'shortcuts';
  let tab = $state<TabId>('appearance');
  let q = $state('');

  const l = $derived(look());
  const w = $derived(ws());
  const dupGroups = $derived(duplicateGroups());

  const navItems: { id: TabId; label: string; sub: string; icon: GlyphName; group?: string; count?: number }[] = $derived([
    { id: 'appearance', label: t('Appearance'), sub: t('Look of “{0}”', w.name), icon: 'swatch' },
    { id: 'board', label: t('Board & gallery'), sub: t('Columns, rows and what the board shows'), icon: 'grid' },
    { id: 'workspaces', label: t('Workspaces'), sub: t('Separate boards over the same bookmarks'), icon: 'layers', count: Object.keys(app.workspaces).length },
    { id: 'toolbar', label: t('Toolbar & header'), sub: t('Choose what the top bar and dock show'), icon: 'panel' },
    { id: 'general', label: t('General'), sub: t('Language and duplicate bookmarks'), icon: 'sliders' },
    { id: 'trash', label: t('Trash'), sub: t('Deleted items you can still bring back'), icon: 'trash', group: t('Data'), count: app.trash.length || undefined },
    { id: 'backups', label: t('Backup & restore'), sub: t('Snapshots, export and import'), icon: 'archive' },
    { id: 'shortcuts', label: t('Keyboard shortcuts'), sub: t('Every key the board responds to'), icon: 'keyboard' },
  ]);
  const current = $derived(navItems.find((x) => x.id === tab)!);

  // Ids match the shown() checks in App.svelte.
  const tools: { group: string; items: [id: string, label: string][] }[] = $derived([
    { group: t('Top bar'), items: [
      ['meta', t('Link and folder count')], ['filter', t('Filter')], ['hidden', t('Show hidden items')],
      ['add', t('New bookmark')],
      ['sort', t('Sort')], ['density', t('View density')], ['gallery', t('Open gallery')],
    ] },
    { group: t('Dock'), items: [['pins', t('Pinned links')]] },
  ]);

  function setTool(id: string, on: boolean) {
    app.hiddenTools = on ? app.hiddenTools.filter((x) => x !== id) : [...app.hiddenTools, id];
    save('hiddenTools');
  }

  const filteredNav = $derived(
    q.trim()
      ? navItems.filter((item) => item.label.toLowerCase().includes(q.trim().toLowerCase()))
      : navItems,
  );

  function setLook<K extends keyof ReturnType<typeof look>>(key: K, val: ReturnType<typeof look>[K]) {
    (w.look as Record<string, unknown>)[key] = val;
    saveWs();
  }

  function pickPhoto() {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > 8e6) return toast(t('Photo too large (max 8 MB)'));
      const fr = new FileReader();
      fr.onload = () => {
        w.look.bgImage = fr.result as string;
        w.look.bgKind = 'photo';
        saveWs();
      };
      fr.readAsDataURL(f);
    };
    input.click();
  }

  async function onLangChange(e: Event & { currentTarget: HTMLSelectElement }) {
    const next = e.currentTarget.value;
    if (next === (app.lang ?? 'auto')) return;
    app.lang = next;
    await save('lang');
    location.reload();
  }

  async function createWs() {
    const r = await form(t('New workspace'), [{ name: 'name', label: t('Name'), value: '', required: true }]);
    if (r?.name) addWorkspace(r.name);
  }

  async function renameWs(id: string) {
    const target = app.workspaces[id];
    if (!target) return;
    const r = await form(t('Rename workspace'), [{ name: 'name', label: t('Name'), value: target.name, required: true }]);
    if (r?.name) {
      target.name = r.name;
      saveWs();
    }
  }
</script>

<div class="st-modal">
  <aside class="st-side">
    <label class="st-search">
      <Glyph name="search" size={14} />
      <input type="search" placeholder={t('Search')} aria-label={t('Search')} bind:value={q} />
      <kbd>/</kbd>
    </label>

    <nav class="st-nav" aria-label={t('Settings')}>
      {#each filteredNav as item (item.id)}
        {#if item.group && !q.trim()}
          <div class="st-group">{item.group}</div>
        {/if}
        <button
          type="button"
          class="st-nav-item"
          class:on={tab === item.id}
          onclick={() => (tab = item.id)}
        >
          <Glyph name={item.icon} size={15} />
          <span class="grow">{item.label}</span>
          {#if item.count !== undefined}
            <span class="st-badge">{item.count}</span>
          {/if}
        </button>
      {/each}
    </nav>

    <div class="st-brand">
      <Mark size={18} />
      <div class="st-brand-text">
        <div class="st-brand-name">Markboard</div>
        <div class="st-brand-sub">v0.6.0 · {w.name}</div>
      </div>
    </div>
  </aside>

  <div class="st-main">
    <header class="st-head">
      <div>
        <h3>{current.label}</h3>
        <p class="st-sub">{current.sub}</p>
      </div>
      <button type="button" class="dialog-x" title={t('Close')} aria-label={t('Close')} onclick={close}>
        <Glyph name="x" size={16} />
      </button>
    </header>

    <div class="st-body">
      {#if tab === 'appearance'}
        <section class="st-sec">
          <div class="st-sec-title">{t('Theme')}</div>
          <div class="st-theme-bar" role="group" aria-label={t('Theme')}>
            {#each [['system', t('System'), 'monitor'], ['light', t('Light'), 'sun'], ['dark', t('Dark'), 'moon'], ['black', t('Pitch black'), 'contrast']] as const as [val, label, icon] (val)}
              <button
                type="button"
                class="st-theme-btn"
                class:on={l.theme === val}
                aria-pressed={l.theme === val}
                onclick={() => setLook('theme', val)}
              >
                <Glyph name={icon} size={14} />
                <span>{label}</span>
              </button>
            {/each}
          </div>
        </section>

        <section class="st-sec">
          <div class="st-sec-title">{t('Accent color')}</div>
          <div class="st-accents" role="group" aria-label={t('Accent color')}>
            <button
              type="button"
              class="st-accent-pill auto"
              class:on={!l.accent}
              title={t('Automatic')}
              aria-label={t('Automatic')}
              onclick={() => setLook('accent', '')}
            >
              <Glyph name="slash" size={14} />
            </button>
            {#each ACCENTS as hex, i (hex)}
              <button
                type="button"
                class="st-accent-pill"
                class:on={l.accent.toLowerCase() === hex}
                style:--sw={hex}
                title={t(ACCENT_NAMES[i]!)}
                aria-label={t(ACCENT_NAMES[i]!)}
                onclick={() => setLook('accent', hex)}
              ></button>
            {/each}
            <label class="st-accent-pill custom" class:on={!!l.accent && !ACCENTS.includes(l.accent.toLowerCase())} title={t('Custom accent')}>
              <Glyph name="swatch" size={14} />
              <input type="color" value={l.accent || '#1d5fbf'} oninput={(e) => setLook('accent', e.currentTarget.value)} aria-label={t('Custom accent')} />
            </label>
          </div>
        </section>

        <section class="st-sec">
          <div class="st-sec-row">
            <div class="st-sec-title">{t('Background')}</div>
            <input
              type="checkbox"
              class="st-switch"
              checked={l.bgKind !== 'none'}
              aria-label={t('Background')}
              onchange={(e) => setLook('bgKind', e.currentTarget.checked ? 'gradient' : 'none')}
            />
          </div>
          <div class="st-bg-panel">
            <div class="st-bg-grid">
              <button type="button" class="st-bg-tile" class:on={l.bgKind === 'none'} title={t('None')} onclick={() => setLook('bgKind', 'none')}>
                <Glyph name="slash" size={15} />
                <span>{t('None')}</span>
              </button>
              <button type="button" class="st-bg-tile" class:on={l.bgKind === 'photo'} title={t('Photo')} onclick={pickPhoto}>
                <Glyph name="plus" size={15} />
                <span>{t('Photo')}</span>
              </button>
              <label class="st-bg-tile" class:on={l.bgKind === 'solid'} title={t('Solid color')}>
                <span class="st-bg-dot" style:background={l.bgColor}></span>
                <span>{t('Color')}</span>
                <input type="color" value={l.bgColor} oninput={(e) => { w.look.bgColor = e.currentTarget.value; w.look.bgKind = 'solid'; saveWs(); }} aria-label={t('Solid color')} />
              </label>
              {#each Object.entries(PRESETS) as [key, [c1, c2]] (key)}
                <button
                  type="button"
                  class="st-bg-tile preset"
                  class:on={l.bgKind === 'gradient' && l.bgPreset === key}
                  style:--p1={c1}
                  style:--p2={c2}
                  title={t(PRESET_NAMES[key]!)}
                  onclick={() => { w.look.bgKind = 'gradient'; w.look.bgPreset = key; saveWs(); }}
                >
                  <span>{t(PRESET_NAMES[key]!)}</span>
                </button>
              {/each}
            </div>

            <div class="st-control-row">
              <div class="st-control-label">
                <span>{t('Background intensity')}</span>
              </div>
              <input type="range" min={0} max={100} value={l.intensity} oninput={(e) => setLook('intensity', Number(e.currentTarget.value))} aria-label={t('Background intensity')} />
              <span class="st-val">{l.intensity}%</span>
            </div>

            <div class="st-control-row">
              <div class="st-control-label">
                <span>{t('Column opacity')}</span>
                <span class="st-row-desc">{t('See more of the background through columns')}</span>
              </div>
              <input type="range" min={30} max={100} value={l.panelOpacity} oninput={(e) => setLook('panelOpacity', Number(e.currentTarget.value))} aria-label={t('Column opacity')} />
              <span class="st-val">{l.panelOpacity}%</span>
            </div>

            <label class="st-switch-row">
              <div>
                <div class="st-row-title">{t('Parallax on mouse move')}</div>
                <div class="st-row-desc">{t('The background shifts slightly as the mouse moves')}</div>
              </div>
              <input type="checkbox" class="st-switch" checked={l.parallax} onchange={(e) => setLook('parallax', e.currentTarget.checked)} />
            </label>

            <label class="st-switch-row">
              <div>
                <div class="st-row-title">{t('Film grain')}</div>
                <div class="st-row-desc">{t('A fine noise that smooths out gradients')}</div>
              </div>
              <input type="checkbox" class="st-switch" checked={l.grain} onchange={(e) => setLook('grain', e.currentTarget.checked)} />
            </label>
          </div>
        </section>

        <section class="st-sec">
          <div class="st-sec-row">
            <div class="st-sec-title">{t('Typeface')}</div>
            <div class="seg" role="group" aria-label={t('Typeface')}>
              {#each Object.keys(FONTS) as f (f)}
                <button type="button" class="st-seg-btn" class:on={l.font === f} onclick={() => setLook('font', f)}>
                  {t(FONT_NAMES[f]!)}
                </button>
              {/each}
            </div>
          </div>
        </section>

      {:else if tab === 'board'}
        <section class="st-sec">
          <div class="st-bg-panel">
            <div class="st-switch-row">
              <div class="st-row-title">{t('Columns per screen')}</div>
              <div class="seg" role="group" aria-label={t('Columns per screen')}>
                {#each [['0', t('Automatic')], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']] as [val, label] (val)}
                  <button type="button" class="st-seg-btn" class:on={String(l.columns) === val} onclick={() => setLook('columns', Number(val))}>
                    {label}
                  </button>
                {/each}
              </div>
            </div>

            <label class="st-switch-row">
              <div><div class="st-row-title">{t('Compact rows')}</div><div class="st-row-desc">{t('Tighter rows fit more links on screen')}</div></div>
              <input type="checkbox" class="st-switch" checked={l.compact} onchange={(e) => setLook('compact', e.currentTarget.checked)} />
            </label>

            <label class="st-switch-row">
              <div><div class="st-row-title">{t('Folder shown as columns')}</div><div class="st-row-desc">{t('Its subfolders become the board columns')}</div></div>
              <select class="st-select" value={wsRoot().id} onchange={(e) => { w.root = e.currentTarget.value; saveWs(); }}>
                {#each folderOptions() as [id, label] (id)}
                  <option value={id}>{label}</option>
                {/each}
              </select>
            </label>

            <label class="st-switch-row">
              <div><div class="st-row-title">{t('Show hidden items')}</div><div class="st-row-desc">{t('Hidden bookmarks appear dimmed')}</div></div>
              <input type="checkbox" class="st-switch" checked={app.showHidden} onchange={(e) => { app.showHidden = e.currentTarget.checked; save('showHidden'); }} />
            </label>

            <div class="st-switch-row">
              <div class="st-row-title">{t('Show hidden columns')} ({w.hiddenCols.length})</div>
              <button type="button" class="btn" disabled={!w.hiddenCols.length} onclick={() => { w.hiddenCols = []; saveWs(); toast(t('All columns shown')); }}>
                {t('Show hidden columns')}
              </button>
            </div>
          </div>
        </section>

      {:else if tab === 'workspaces'}
        <section class="st-sec">
          <div class="st-bg-panel">
            {#each Object.entries(app.workspaces) as [id, item] (id)}
              <div class="st-switch-row">
                <div class="row">
                  <span class="st-row-title">{item.name}</span>
                  {#if id === app.ws}<span class="st-badge">{t('Workspace')}</span>{/if}
                </div>
                <div class="row">
                  {#if id !== app.ws}
                    <button type="button" class="btn sm" onclick={() => switchWs(id)}>{t('Board')}</button>
                  {/if}
                  <button type="button" class="btn sm" onclick={() => renameWs(id)}>{t('Edit')}</button>
                  {#if Object.keys(app.workspaces).length > 1 && id === app.ws}
                    <button type="button" class="btn sm" onclick={deleteWorkspace}>{t('Delete')}</button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
          <div class="row wrap">
            <button type="button" class="btn primary" onclick={createWs}>{t('+ New workspace…')}</button>
            {#each Object.entries(TEMPLATES) as [file, name] (file)}
              <button type="button" class="btn" onclick={() => loadTemplate(file)}>{t('Add “{0}” template', t(name))}</button>
            {/each}
          </div>
        </section>

      {:else if tab === 'toolbar'}
        {#each tools as sec (sec.group)}
          <section class="st-sec">
            <div class="st-sec-title">{sec.group}</div>
            <div class="st-bg-panel">
              {#each sec.items as [id, label] (id)}
                <label class="st-switch-row">
                  <div class="st-row-title">{label}</div>
                  <input type="checkbox" class="st-switch" checked={!app.hiddenTools.includes(id)} onchange={(e) => setTool(id, e.currentTarget.checked)} />
                </label>
              {/each}
            </div>
          </section>
        {/each}

      {:else if tab === 'general'}
        <section class="st-sec">
          <div class="st-bg-panel">
            <label class="st-switch-row">
              <div><div class="st-row-title">{t('Language')}</div><div class="st-row-desc">{t('Set independently of the browser language')}</div></div>
              <select class="st-select" value={app.lang ?? 'auto'} onchange={onLangChange}>
                {#each Object.entries(LANGS) as [code, name] (code)}
                  <option value={code}>{name ?? t('Automatic')}</option>
                {/each}
              </select>
            </label>
          </div>
        </section>

        <section class="st-sec">
          <div class="st-sec-row">
            <div class="st-sec-title">{t('Find duplicates')}</div>
            {#if dupGroups.length}
              <button type="button" class="btn primary sm" onclick={() => dedupe(dupGroups)}>{t('Keep one of each')}</button>
            {/if}
          </div>
          <div class="st-bg-panel">
            <Duplicates groups={dupGroups} />
          </div>
        </section>

      {:else if tab === 'trash'}
        <section class="st-sec">
          <div class="st-sec-row">
            <div class="st-sec-title">{t('Trash · kept for {0} days', TRASH_DAYS)}</div>
            {#if app.trash.length}
              <button type="button" class="btn sm" onclick={emptyTrash}>{t('Empty trash')}</button>
            {/if}
          </div>
          <div class="st-bg-panel">
            <Trash {close} />
          </div>
        </section>

      {:else if tab === 'backups'}
        <section class="st-sec">
          <div class="st-bg-panel">
            <label class="st-switch-row">
              <div><div class="st-row-title">{t('Automatic daily backups (last 7 kept)')}</div><div class="st-row-desc">{t('Saved on this device once a day')}</div></div>
              <input type="checkbox" class="st-switch" checked={app.autoBackup} onchange={(e) => { app.autoBackup = e.currentTarget.checked; save('autoBackup'); }} />
            </label>
            <label class="st-switch-row">
              <div><div class="st-row-title">{t('Also save backups to Downloads/Markboard backups')}</div><div class="st-row-desc">{t('Keeps a copy outside the browser')}</div></div>
              <input
                type="checkbox"
                class="st-switch"
                checked={app.backupToDownloads}
                onchange={(e) => {
                  const el = e.currentTarget;
                  if (el.checked) {
                    browser.permissions.request({ permissions: ['downloads'] }).then((ok) => {
                      el.checked = ok;
                      app.backupToDownloads = ok;
                      save('backupToDownloads');
                    });
                  } else {
                    app.backupToDownloads = false;
                    save('backupToDownloads');
                  }
                }}
              />
            </label>
          </div>
          <div class="row wrap">
            <button type="button" class="btn primary" onclick={() => backupNow().then(() => toast(t('Backup saved')))}>{t('Back up now')}</button>
            <button type="button" class="btn" onclick={exportData}>{t('Export')}</button>
            <button type="button" class="btn" onclick={pickBackupFile}>{t('Import backup or template')}</button>
          </div>
          {#if app.backups.length}
            <div class="st-bg-panel">
              {#each app.backups as b (b.date)}
                <div class="st-switch-row">
                  <span class="st-row-title">{t('Restore backup from {0}', new Date(b.date).toLocaleString(locale))}</span>
                  <button type="button" class="btn sm" onclick={() => applyData(b.data)}>{t('Restore')}</button>
                </div>
              {/each}
            </div>
          {/if}
        </section>

      {:else if tab === 'shortcuts'}
        <section class="st-sec">
          <div class="st-bg-panel">
            <Help />
          </div>
        </section>
      {/if}
    </div>
  </div>
</div>
