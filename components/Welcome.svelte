<script lang="ts">
  import { LANGS, t } from '@/lib/i18n';
  import { app, folderOptions, save, saveWs, ws, wsRoot } from '@/lib/store.svelte';
  import Mark from './Mark.svelte';

  let { close }: { close: () => void } = $props();

  async function setLang(e: Event & { currentTarget: HTMLSelectElement }) {
    app.lang = e.currentTarget.value;
    app.onboarded = false; // show the welcome again, in the new language
    await save('lang', 'onboarded');
    location.reload();
  }
</script>

<div class="welcome">
  <Mark size={28} />
  <h2>{t('Welcome to Markboard')}</h2>
  <p class="welcome-lead">{t('Your browser bookmarks as a board. Nothing is copied: what you change here changes your real bookmarks.')}</p>

  <div class="welcome-fields">
    <label>
      <span>{t('Language')}</span>
      <select class="st-select" value={app.lang ?? 'auto'} onchange={setLang}>
        {#each Object.entries(LANGS) as [code, name] (code)}<option value={code}>{name ?? t('Automatic')}</option>{/each}
      </select>
    </label>
    <label>
      <span>{t('Folder shown as columns')}</span>
      <select class="st-select" value={wsRoot().id} onchange={(e) => { ws().root = e.currentTarget.value; saveWs(); }}>
        {#each folderOptions() as [id, label] (id)}<option value={id}>{label}</option>{/each}
      </select>
    </label>
  </div>

  <ul class="welcome-tips">
    <li><kbd>F</kbd><span>{t('Search bookmarks and run any command')}</span></li>
    <li><kbd>⋮</kbd><span>{t('On a bookmark: favorite, color, tags, comment, reminder')}</span></li>
    <li><kbd>⇅</kbd><span>{t('Drag bookmarks and columns to rearrange them')}</span></li>
  </ul>

  <button type="button" class="btn primary welcome-start" onclick={close}>{t('Start')}</button>
</div>
