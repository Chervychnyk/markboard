<script lang="ts">
  import { favicon, isLocal, LOCAL_ROOT } from '@/lib/core';
  import { toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { bm, data, folderOptions, refresh, saveWs, ws, wsRoot } from '@/lib/store.svelte';
  import Glyph from './Glyph.svelte';

  let { close, folder: start, kind }: { close: () => void; folder?: string; kind: 'bookmark' | 'folder' } = $props();

  let url = $state('');
  let title = $state('');
  let folder = $derived(start ?? wsRoot()?.id ?? ''); // the picked folder overrides it
  const isBookmark = $derived(kind === 'bookmark');
  // A folder is kept in the browser's bookmarks or in Markboard alone; the picker lists that tree's folders.
  const localHome = $derived(isLocal(wsRoot().id) ? wsRoot().id : LOCAL_ROOT);
  const local = $derived(isLocal(folder));
  const options = $derived(isBookmark ? folderOptions() : folderOptions().filter(([id]) => isLocal(id) === local));
  function keepIn(toLocal: boolean) {
    if (toLocal !== local) folder = toLocal ? localHome : isLocal(wsRoot().id) ? data.bar.id : wsRoot().id;
  }
  const outsideRoot = $derived.by(() => {
    const root = wsRoot();
    let node = data.byId.get(folder);
    while (node) {
      if (node.id === root.id || ws().cols.includes(node.id)) return false;
      node = node.parentId ? data.byId.get(node.parentId) : undefined;
    }
    return true;
  });
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
    const column = !isBookmark && local && outsideRoot; // a Markboard folder outside the root joins this board instead
    await bm.create({ parentId: folder, title: name, ...(isBookmark && { url: link!.href }) })
      .then((made) => {
        if (column) { ws().cols.push(made.id); saveWs(); }
        close();
        return refresh();
      })
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

  {#if !isBookmark}
    <div>
      <span class="nws-label">{t('Keep in')}</span>
      <div class="seg nit-keep" role="group" aria-label={t('Keep in')}>
        <button type="button" class:on={!local} aria-pressed={!local} onclick={() => keepIn(false)}>{t('Browser bookmarks')}</button>
        <button type="button" class:on={local} aria-pressed={local} onclick={() => keepIn(true)}>{t('Markboard only')}</button>
      </div>
    </div>
  {/if}

  <label>
    <span class="nws-label">{isBookmark ? t('Folder') : t('Inside')}</span>
    <select class="st-select nit-folder" bind:value={folder}>
      {#each options as [id, label] (id)}<option value={id}>{label}</option>{/each}
    </select>
    {#if !isBookmark && local}
      <p class="nws-hint">{outsideRoot ? t('Added to this board as a column. Not in your browser bookmarks or their sync.') : t('Not in your browser bookmarks or their sync.')}</p>
    {:else if !isBookmark && outsideRoot}
      <p class="nws-hint warn">{t("Outside board root — won't appear as a column.")}</p>
    {/if}
  </label>

  <footer class="nws-foot">
    <button type="button" class="btn" onclick={close}>{t('Cancel')}</button>
    <button type="submit" class="btn primary" disabled={!ready}>{isBookmark ? t('Add bookmark') : t('Create folder')}</button>
  </footer>
</form>
