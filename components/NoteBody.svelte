<script lang="ts">
  import { t } from '@/lib/i18n';
  import { saveWs } from '@/lib/store.svelte';
  import type { Note } from '@/lib/types';

  let { note }: { note: Note } = $props();

  function add(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    const text = e.currentTarget.value.trim();
    if (e.key !== 'Enter' || !text) return;
    note.checklist.push({ text, done: false });
    e.currentTarget.value = '';
    saveWs();
  }
</script>

<textarea class="notes" placeholder={t('Write anything…')} aria-label={t('Note')} bind:value={note.text} oninput={saveWs}></textarea>
<ul class="plain checklist">
  {#each note.checklist as c, i (i)}
    <li class="row">
      <label class="grow" class:done={c.done}><input type="checkbox" bind:checked={c.done} onchange={saveWs} />{c.text}</label>
      <button class="hide" title={t('Remove')} onclick={() => { note.checklist.splice(i, 1); saveWs(); }}>×</button>
    </li>
  {/each}
</ul>
<input class="check-add" placeholder={t('+ Add to checklist')} aria-label={t('Add checklist item')} onkeydown={add} />
