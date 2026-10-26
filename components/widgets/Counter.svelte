<script lang="ts">
  import { periodKey } from '@/lib/core';
  import { locale, t } from '@/lib/i18n';
  import { ticker } from '@/lib/now.svelte';
  import type { Widget } from '@/lib/types';

  let { w, save }: { w: Widget; save: () => void } = $props();
  const tick = ticker();

  $effect(() => {
    const key = periodKey(w.reset as string, new Date(tick.now));
    if (key === (w.period ?? '')) return;
    if (w.period && key) w.value = 0;
    w.period = key;
    save();
  });

  const stepSize = $derived((w.step as number) || 1);
  const step = (d: number) => () => { w.value = Math.max(0, ((w.value as number) ?? 0) + d * stepSize); save(); };
  const goal = $derived(Number(w.goal) || 0);
  const value = $derived((w.value as number) ?? 0);
  const unit = $derived((w.unit as string) ? ` ${w.unit}` : '');
</script>

<div class="w-split">
  <div class="w-counter-val">
    <span class="big">{value.toLocaleString(locale)}</span>
    {#if goal || unit}
      <span class="goal-sub">{goal ? ` / ${goal.toLocaleString(locale)}${unit}` : unit}</span>
    {/if}
  </div>
  <div class="row">
    <button class="btn step-btn" onclick={step(-1)} aria-label={t('Decrease')}>−</button>
    <button class="btn step-btn" onclick={step(1)} aria-label={t('Increase')}>+</button>
  </div>
</div>
{#if goal}<progress max={1} value={Math.min(1, value / goal)}></progress>{/if}
