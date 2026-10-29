<script lang="ts">
  import { ago } from '@/lib/core';
  import { locale, t } from '@/lib/i18n';
  import { ticker } from '@/lib/now.svelte';

  /** When an agent last wrote the block (its `agentAt`). */
  let { at }: { at?: number } = $props();
  const tick = ticker();
</script>

{#if at}<div class="agent-mark" title={new Date(at).toLocaleString(locale)}>{t('Updated by Claude · {0}', ago(at, locale, tick.now))}</div>{/if}
