<script lang="ts">
  import { form, toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { ticker } from '@/lib/now.svelte';
  import { saveWs, ws } from '@/lib/store.svelte';
  import type { Widget } from '@/lib/types';
  import { WIDGETS } from '@/lib/widgets';
  import AgentMark from './AgentMark.svelte';
  import Glyph from './Glyph.svelte';
  import { VIEWS } from './widgets/index';

  let { w }: { w: Widget } = $props();
  const def = $derived(WIDGETS[w.type]);
  const View = $derived(VIEWS[w.type]);
  const tick = ticker();

  const tzDiff = $derived.by(() => {
    if (w.type !== 'clock' || !w.tz) return '';
    try {
      const now = new Date(tick.now);
      const localStr = now.toLocaleString('en-US');
      const targetStr = now.toLocaleString('en-US', { timeZone: w.tz as string });
      const diffHrs = Math.round((new Date(targetStr).getTime() - new Date(localStr).getTime()) / 3600e3);
      if (diffHrs === 0) return '0h';
      return diffHrs > 0 ? `+${diffHrs}h` : `${diffHrs}h`;
    } catch {
      return '';
    }
  });

  const dataUrl = (f: File) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(f); });

  async function configure() {
    const fields = def!.fields!(w);
    const v = await form(t(def!.label), fields);
    if (!v) return;
    for (const f of fields) {
      if (!('type' in f) || f.type !== 'file') continue;
      const file = v[f.name] as File | undefined;
      if (file && file.size > 8e6) return toast(t('Photo too large (max 8 MB)'));
      (v as Record<string, unknown>)[f.name] = file ? await dataUrl(file) : w[f.name];
    }
    Object.assign(w, v);
    delete w.agentAt; // the user's now
    saveWs();
  }

  function remove() {
    const list = ws().widgets, i = list.indexOf(w), copy = $state.snapshot(w);
    list.splice(i, 1);
    saveWs();
    toast(t('Removed: {0}', t(def!.label)), t('Undo'), () => { list.splice(i, 0, copy); saveWs(); });
  }

</script>

{#if def && View}
  <div class="widget w-{w.type}" role="listitem">
    <div class="whead" role="group">
      <span class="whead-ico"><Glyph name={def.icon} size={13} /></span>
      <span class="grow">{w.label || t(def.label)}</span>
      {#if tzDiff}<span class="tz-pill">{tzDiff}</span>{/if}
      <span class="whead-acts">
        {#if def.fields}<button title={t('Configure')} aria-label={t('Configure')} onclick={configure}><Glyph name="sliders" size={13} /></button>{/if}
        <button title={t('Remove widget')} aria-label={t('Remove widget')} onclick={remove}><Glyph name="x" size={13} /></button>
      </span>
    </div>
    <View {w} save={saveWs} />
    <AgentMark at={w.agentAt} />
  </div>
{/if}
