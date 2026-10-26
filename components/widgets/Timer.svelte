<script lang="ts">
  import { fmt } from '@/lib/core';
  import { t } from '@/lib/i18n';
  import { ticker } from '@/lib/now.svelte';
  import type { Widget } from '@/lib/types';

  let { w, save }: { w: Widget; save: () => void } = $props();
  const tick = ticker();
  const elapsed = $derived(((w.elapsed as number) ?? 0) + (w.startedAt ? tick.now - (w.startedAt as number) : 0));

  function toggle() {
    if (w.startedAt) Object.assign(w, { elapsed: elapsed, startedAt: null });
    else w.startedAt = Date.now();
    save();
  }
  const reset = () => { Object.assign(w, { elapsed: 0, startedAt: null }); save(); };
</script>

<div class="w-split">
  <div class="big">{fmt(elapsed)}</div>
  <div class="row">
    <button class="btn" onclick={toggle}>{w.startedAt ? t('Pause') : t('Start')}</button>
    <button class="btn" onclick={reset}>{t('Reset')}</button>
  </div>
</div>
