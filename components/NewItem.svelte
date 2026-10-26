<script lang="ts">
  import { favicon } from '@/lib/core';
  import { toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { folderOptions, refresh, wsRoot } from '@/lib/store.svelte';
  import Glyph from './Glyph.svelte';

  let { close, folder: start, kind }: { close: () => void; folder?: string; kind: 'bookmark' | 'folder' } = $props();

  let url = $state('');
  let title = $state('');
  let folder = $derived(start ?? wsRoot()?.id ?? ''); // the picked folder overrides it
  const isBookmark = $derived(kind === 'bookmark');
  // Like the address bar: a link typed without a scheme gets https://.
  const link = $derived.by(() => {
    const v = url.trim();
    if (!v) return null;
    try {
      const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
      return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u : null;
    } catch {
      return null;
    }
  });
  const host = $derived(link?.hostname.replace(/^www\./, '') ?? '');
  const ready = $derived(isBookmark ? !!link : !!title.trim());

  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (!ready) return;
    const name = title.trim() || host;
    await browser.bookmarks.create({ parentId: folder, title: name, ...(isBookmark && { url: link!.href }) })
      .then(() => { close(); return refresh(); })
      .catch((err) => toast(err.message));
  }
</script>

<form class="nws nit" onsubmit={create}>
  <header class="nws-head">
    <h2>{isBookmark ? t('New bookmark') : t('New folder')}</h2>
    <button type="button" class="dialog-x" title={t('Close')} aria-label={t('Close')} onclick={close}><Glyph name="x" size={16} /></button>
  </header>

  {#if isBookmark}
    <label>
      <span class="nws-label">{t('URL')}</span>
      <span class="nit-url">
        {#if link}<img class="ico" src={favicon(link.href)} alt="" />{:else}<Glyph name="external" size={15} />{/if}
        <!-- svelte-ignore a11y_autofocus -->
        <input class="nws-input" bind:value={url} autofocus inputmode="url" autocomplete="off" spellcheck="false" placeholder="example.com" />
      </span>
    </label>
  {/if}

  <label>
    <span class="nws-label">{isBookmark ? t('Title') : t('Name')}</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="nws-input" bind:value={title} autofocus={!isBookmark} maxlength={300}
      placeholder={isBookmark ? host || t('Optional') : t('Work, Reading, Trip…')} />
  </label>

  <label>
    <span class="nws-label">{t('Folder')}</span>
    <select class="st-select nit-folder" bind:value={folder}>
      {#each folderOptions() as [id, label] (id)}<option value={id}>{label}</option>{/each}
    </select>
  </label>

  <footer class="nws-foot">
    <button type="button" class="btn" onclick={close}>{t('Cancel')}</button>
    <button type="submit" class="btn primary" disabled={!ready}>{isBookmark ? t('Add bookmark') : t('Create folder')}</button>
  </footer>
</form>
