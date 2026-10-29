<script lang="ts">
  import { TEMPLATES } from '@/lib/commands';
  import { isLocal } from '@/lib/core';
  import { toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { ACCENT_NAMES } from '@/lib/settings';
  import { ACCENTS, addWorkspace, loadTemplate, look, saveWs, ws, wsRoot } from '@/lib/store.svelte';
  import Glyph, { type GlyphName } from './Glyph.svelte';

  let { close }: { close: () => void } = $props();

  const current = ws().name;
  const cur = look();
  let name = $state('');
  let start = $state<string>('copy'); // 'copy' | 'empty' | 'blank' | 'template:<file>'
  let theme = $state(cur.theme);
  let accent = $state(cur.accent);
  let lookTouched = $state(false); // a template brings its own look; only override it when asked
  let keepLocal = $state(isLocal(wsRoot().id)); // where a template's folders go

  const template = $derived(start.startsWith('template:') ? start.slice(9) : '');
  const ready = $derived(!!name.trim() || !!template);

  const starts: { id: string; icon: GlyphName; title: string; desc: string }[] = [
    { id: 'copy', icon: 'copy', title: t('Copy of “{0}”', current), desc: t('Same columns, notes and widgets') },
    { id: 'empty', icon: 'grid', title: t('Empty board'), desc: t('Your bookmarks with the default columns') },
    { id: 'blank', icon: 'archive', title: t('Blank board'), desc: t('Its own columns, kept in Markboard and not in your browser bookmarks') },
    ...Object.entries(TEMPLATES).map(([file, label]) => ({
      id: 'template:' + file, icon: 'layers' as GlyphName, title: t(label), desc: t('Template: adds its own folders, notes and widgets'),
    })),
  ];
  const themes = [['system', t('System'), 'monitor'], ['light', t('Light'), 'sun'], ['dark', t('Dark'), 'moon'], ['black', t('Pitch black'), 'contrast']] as const;

  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (!ready) return;
    if (template) {
      try {
        await loadTemplate(template, name.trim() || undefined, keepLocal);
      } catch {
        return toast(t('Could not load the template'));
      }
    }
    else await addWorkspace(name.trim(), start as 'copy' | 'empty' | 'blank');
    if (lookTouched || !template) { // the new workspace is current now
      Object.assign(ws().look, { theme, accent });
      saveWs();
    }
    close();
  }
</script>

<form class="nws" onsubmit={create}>
  <header class="nws-head">
    <h2>{t('New workspace')}</h2>
    <button type="button" class="dialog-x" title={t('Close')} aria-label={t('Close')} onclick={close}><Glyph name="x" size={16} /></button>
  </header>

  <label class="nws-name">
    <span class="nws-label">{t('Name')}</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="nws-input" bind:value={name} autofocus placeholder={template ? t(TEMPLATES[template]!) : t('Work, Home, Trip…')} />
  </label>

  <fieldset class="nws-group">
    <legend class="nws-label">{t('Start from')}</legend>
    <div class="nws-starts">
      {#each starts as s (s.id)}
        <label class="nws-start" class:on={start === s.id}>
          <input type="radio" name="start" value={s.id} bind:group={start} />
          <span class="nws-start-ico"><Glyph name={s.icon} size={15} /></span>
          <span class="nws-start-text">
            <span class="nws-start-title">{s.title}</span>
            <span class="nws-start-desc">{s.desc}</span>
          </span>
        </label>
      {/each}
    </div>
  </fieldset>

  {#if template}
    <div>
      <span class="nws-label">{t('Keep its folders in')}</span>
      <div class="seg nit-keep" role="group" aria-label={t('Keep its folders in')}>
        <button type="button" class:on={!keepLocal} aria-pressed={!keepLocal} onclick={() => (keepLocal = false)}>{t('Browser bookmarks')}</button>
        <button type="button" class:on={keepLocal} aria-pressed={keepLocal} onclick={() => (keepLocal = true)}>{t('Markboard only')}</button>
      </div>
    </div>
  {/if}

  <fieldset class="nws-group">
    <legend class="nws-label">{t('Look')}</legend>
    <div class="st-theme-bar" role="group" aria-label={t('Theme')}>
      {#each themes as [val, label, icon] (val)}
        <button type="button" class="st-theme-btn" class:on={theme === val} aria-pressed={theme === val} onclick={() => { theme = val; lookTouched = true; }}>
          <Glyph name={icon} size={14} /><span>{label}</span>
        </button>
      {/each}
    </div>
    <div class="st-accents nws-accents" role="group" aria-label={t('Accent color')}>
      <button type="button" class="st-accent-pill auto" class:on={!accent} title={t('Automatic')} aria-label={t('Automatic')} onclick={() => { accent = ''; lookTouched = true; }}>
        <Glyph name="slash" size={14} />
      </button>
      {#each ACCENTS as hex, i (hex)}
        <button
          type="button"
          class="st-accent-pill"
          class:on={accent.toLowerCase() === hex}
          style:--sw={hex}
          title={t(ACCENT_NAMES[i]!)}
          aria-label={t(ACCENT_NAMES[i]!)}
          onclick={() => { accent = hex; lookTouched = true; }}
        ></button>
      {/each}
    </div>
    {#if template && !lookTouched}<p class="nws-hint">{t('The template brings its own look unless you pick one here')}</p>{/if}
  </fieldset>

  <footer class="nws-foot">
    <button type="button" class="btn" onclick={close}>{t('Cancel')}</button>
    <button type="submit" class="btn primary" disabled={!ready}>{t('Create workspace')}</button>
  </footer>
</form>
