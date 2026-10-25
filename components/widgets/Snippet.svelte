<script lang="ts">
  import { toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import type { Widget } from '@/lib/types';

  let { w }: { w: Widget } = $props();
  const copy = () => navigator.clipboard.writeText((w.text as string) ?? '').then(() => toast(t('Copied')));
</script>

<pre class="snippet">{w.text || t('Add text ⚙')}</pre>
<button class="btn" onclick={copy}>{t('Copy')}</button>
