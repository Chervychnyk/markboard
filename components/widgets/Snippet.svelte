<script lang="ts">
  import { toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import type { Widget } from '@/lib/types';
  import Glyph from '../Glyph.svelte';

  let { w }: { w: Widget } = $props();
  const raw = $derived(String(w.text ?? '').trim());
  const pairs = $derived.by(() => {
    if (!raw) return [];
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => l.includes(':'))) {
      return lines.map((l) => {
        const i = l.indexOf(':');
        return { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
      });
    }
    return [];
  });
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast(t('Copied')));
</script>

{#if pairs.length}
  <div class="snippet-list">
    {#each pairs as p (p.label)}
      <button type="button" class="snippet-item" title={p.value} onclick={() => copy(p.value)}>
        <Glyph name="copy" size={13} />
        <span class="snippet-label">{p.label}</span>
      </button>
    {/each}
  </div>
{:else}
  <pre class="snippet">{raw || t('Add text')}</pre>
  <button class="btn" onclick={() => copy(raw)}>{t('Copy')}</button>
{/if}
