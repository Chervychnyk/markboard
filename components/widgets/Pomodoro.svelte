<script lang="ts">
  import { fmt } from '@/lib/core';
  import { toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { ticker } from '@/lib/now.svelte';
  import type { Widget } from '@/lib/types';

  let { w, save }: { w: Widget; save: () => void } = $props();
  const tick = ticker();
  const dur = () => (w.mode === 'break' ? 5 : 25) * 60e3;

  $effect(() => {
    if (!w.endsAt || (w.endsAt as number) > tick.now) return;
    w.mode = w.mode === 'break' ? 'work' : 'break';
    w.endsAt = Date.now() + dur();
    w.left = null;
    save();
    toast(w.mode === 'break' ? t('Focus session done — take a break') : t('Break over — back to focus'));
  });

  function toggle() {
    if (w.endsAt) Object.assign(w, { left: (w.endsAt as number) - Date.now(), endsAt: null });
    else w.endsAt = Date.now() + ((w.left as number) ?? dur());
    save();
  }
  const reset = () => { Object.assign(w, { mode: 'work', endsAt: null, left: null }); save(); };
</script>

<div class="w-split">
  <div class="big">{fmt(w.endsAt ? (w.endsAt as number) - tick.now : ((w.left as number) ?? dur()))}</div>
  <div class="row">
    <button class="btn" onclick={toggle}>{w.endsAt ? t('Pause') : t('Start')}</button>
    <button class="btn" onclick={reset}>{t('Reset')}</button>
  </div>
</div>
