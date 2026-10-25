<script lang="ts">
  import { locale, t } from '@/lib/i18n';
  import { ticker } from '@/lib/now.svelte';
  import type { Widget } from '@/lib/types';

  let { w }: { w: Widget } = $props();
  const tick = ticker();
  const shown = $derived.by(() => {
    const now = new Date(tick.now);
    try {
      const tz = w.tz ? { timeZone: w.tz as string } : {};
      const hour12 = w.hours ? w.hours === '12' : undefined;
      return [
        now.toLocaleTimeString(locale, { ...tz, hour12, hour: '2-digit', minute: '2-digit' }),
        now.toLocaleDateString(locale, { ...tz, weekday: 'long', day: 'numeric', month: 'long' }) + (w.tz ? ` · ${w.tz}` : ''),
      ];
    } catch {
      return ['--:--', String(w.tz ?? t('Local time'))]; // invalid imported time zone
    }
  });
</script>

<div class="big">{shown[0]}</div>
<div class="muted">{shown[1]}</div>
