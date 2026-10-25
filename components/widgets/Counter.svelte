<script lang="ts">
  import { periodKey } from '@/lib/core';
  import { t } from '@/lib/i18n';
  import { ticker } from '@/lib/now.svelte';
  import type { Widget } from '@/lib/types';

  let { w, save }: { w: Widget; save: () => void } = $props();
  const tick = ticker();

  $effect(() => {
    const key = periodKey(w.reset as string, new Date(tick.now));
    if (key === (w.period ?? '')) return;
    if (w.period && key) w.value = 0; // a new period started (first run only records it)
    w.period = key;
    save();
  });

  const step = (d: number) => () => { w.value = ((w.value as number) ?? 0) + d; save(); };
  const goal = $derived(Number(w.goal) || 0);
  const value = $derived((w.value as number) ?? 0);
</script>

<div class="big">{goal ? `${value} / ${goal}` : String(value)}</div>
{#if goal}<progress max={1} value={Math.min(1, value / goal)}></progress>{/if}
<div class="row">
  <button class="btn" onclick={step(-1)} aria-label={t('Decrease')}>−</button>
  <button class="btn" onclick={step(1)} aria-label={t('Increase')}>+</button>
</div>
