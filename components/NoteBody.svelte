<script lang="ts">
  import { t } from '@/lib/i18n';
  import { saveWs } from '@/lib/store.svelte';
  import type { Note } from '@/lib/types';
  import Glyph from './Glyph.svelte';

  let { note }: { note: Note } = $props();
  let draft = $state('');

  function commit() {
    const text = draft.trim();
    if (!text) return;
    note.checklist.push({ text, done: false });
    draft = '';
    saveWs();
  }
</script>

<textarea
  class="notes"
  rows={note.checklist.length ? 2 : 4}
  placeholder={t('Write anything…')}
  aria-label={t('Note')}
  bind:value={note.text}
  oninput={saveWs}
></textarea>
{#if note.checklist.length}
  <ul class="plain checklist">
    {#each note.checklist as c, i (i)}
      <li class="row">
        <label class="grow" class:done={c.done}><input type="checkbox" bind:checked={c.done} onchange={saveWs} /><span>{c.text}</span></label>
        <button class="hide" title={t('Remove')} aria-label={t('Remove')} onclick={() => { note.checklist.splice(i, 1); saveWs(); }}><Glyph name="x" size={12} /></button>
      </li>
    {/each}
  </ul>
{/if}
<div class="check-add-row">
  <input
    class="check-add"
    placeholder={t('+ Add to checklist')}
    aria-label={t('Add checklist item')}
    bind:value={draft}
    onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
  />
  <button type="button" class="check-add-btn" title={t('Add checklist item')} aria-label={t('Add checklist item')} onclick={commit}>
    <Glyph name="plus" size={13} />
  </button>
</div>
