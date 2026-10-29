<script lang="ts">
  import { locale, t } from '@/lib/i18n';
  import { app, untrash } from '@/lib/store.svelte';
  import Glyph from './Glyph.svelte';
  import Icon from './Icon.svelte';

  let { close }: { close: () => void } = $props();
</script>

{#if app.trash.length}
  <ul class="plain">
    {#each app.trash as entry (entry.at + (entry.node.id ?? ''))}
      <li class="row">
        {#if entry.board}<span class="ico"><Glyph name="grid" size={15} /></span>{:else}<Icon n={entry.node} m={{}} />{/if}
        <span class="title grow">{entry.board ? t('Workspace: {0}', entry.board.w.name) : entry.node.title || entry.node.url}</span>
        <small>{new Date(entry.at).toLocaleString(locale)}</small>
        <button type="button" class="btn" onclick={async () => { close(); await untrash(entry); }}>{t('Restore')}</button>
      </li>
    {/each}
  </ul>
{:else}
  <p>{t('Trash is empty.')}</p>
{/if}
