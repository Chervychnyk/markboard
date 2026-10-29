<script lang="ts">
  import { fmt, parseSchedule } from '@/lib/core';
  import { locale, t } from '@/lib/i18n';
  import { ticker } from '@/lib/now.svelte';
  import type { Widget } from '@/lib/types';

  let { w }: { w: Widget } = $props();
  const tick = ticker();
  const sessions = $derived(parseSchedule(String(w.text ?? '')));
  const next = $derived(sessions.find((s) => s.at > tick.now));
  // In the viewer's own time zone, whatever zone the line was written in.
  const when = (at: number) =>
    new Date(at).toLocaleString(locale, { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

{#if sessions.length}
  {#if next}
    <div class="w-split">
      <div class="big">{fmt(next.at - tick.now)}</div>
      <div class="muted">{t('Next: {0}', next.label)}</div>
    </div>
  {/if}
  <ul class="plain sched">
    {#each sessions as s, i (i)}
      <li class:past={s.at <= tick.now} class:next={s === next}>
        <span class="grow">{s.label}</span><span class="sched-when">{when(s.at)}</span>
      </li>
    {/each}
  </ul>
{:else}
  <div class="muted">{t('No sessions yet')}</div>
{/if}
