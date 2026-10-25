<script lang="ts">
  import { fmt } from '@/lib/core';
  import { t } from '@/lib/i18n';
  import { ticker } from '@/lib/now.svelte';
  import type { Widget } from '@/lib/types';

  let { w }: { w: Widget } = $props();
  const tick = ticker();
  const left = $derived(new Date(w.to as string).getTime() - tick.now);
</script>

<div class="big">{!w.to ? t('Set a date ⚙') : left > 0 ? fmt(left) : t('Done 🎉')}</div>
