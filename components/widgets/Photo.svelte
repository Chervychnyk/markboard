<script lang="ts">
  import { t } from '@/lib/i18n';
  import { DATA_IMG } from '@/lib/store.svelte';
  import type { Widget } from '@/lib/types';

  let { w }: { w: Widget } = $props();
</script>

{#if DATA_IMG.test((w.image as string) ?? '')}
  <img class="photo" src={w.image as string} alt={w.label ?? ''} />
{:else}
  <div class="muted">{t('Pick a photo ⚙')}</div>
{/if}
