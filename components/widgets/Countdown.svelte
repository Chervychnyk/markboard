<script lang="ts">
  import { fmt } from '@/lib/core';
  import { locale, t } from '@/lib/i18n';
  import { ticker } from '@/lib/now.svelte';
  import type { Widget } from '@/lib/types';

  let { w }: { w: Widget } = $props();
  const tick = ticker();
  const target = $derived(w.to ? new Date(w.to as string).getTime() : 0);
  const left = $derived(target - tick.now);
  const main = $derived.by(() => {
    if (!w.to) return t('Set a date');
    if (left <= 0) return t('Done');
    const days = Math.ceil(left / 864e5);
    return days >= 2 ? t('{0} days', days) : fmt(left);
  });
  const until = $derived.by(() => {
    if (!w.to || left <= 0) return '';
    return t('until {0}', new Date(target).toLocaleDateString(locale, { month: 'short', day: 'numeric' }));
  });
</script>

<div class="w-split">
  <div class="big">{main}</div>
  {#if until}<div class="muted">{until}</div>{/if}
</div>
