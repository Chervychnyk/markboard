<script lang="ts">
  import { parseTable } from '@/lib/core';
  import { t } from '@/lib/i18n';
  import type { Widget } from '@/lib/types';

  let { w }: { w: Widget } = $props();
  const rows = $derived(parseTable(String(w.text ?? '')));
</script>

{#if rows.length}
  <div class="wtable-wrap">
    <table class="wtable">
      <thead><tr>{#each rows[0]! as c, i (i)}<th>{c}</th>{/each}</tr></thead>
      <tbody>
        {#each rows.slice(1) as r, i (i)}<tr>{#each r as c, j (j)}<td>{c}</td>{/each}</tr>{/each}
      </tbody>
    </table>
  </div>
  {#if w.note}<div class="muted wtable-note">{w.note}</div>{/if}
{:else}
  <div class="muted">{t('No rows yet')}</div>
{/if}
