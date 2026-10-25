<script lang="ts">
  import { form, toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { saveWs, ws } from '@/lib/store.svelte';
  import type { Widget } from '@/lib/types';
  import { WIDGETS } from '@/lib/widgets';
  import { VIEWS } from './widgets/index';

  let { w }: { w: Widget } = $props();
  const def = $derived(WIDGETS[w.type]);
  const View = $derived(VIEWS[w.type]);

  const dataUrl = (f: File) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(f); });

  async function configure() {
    const fields = def!.fields!(w);
    const v = await form(t(def!.label), fields);
    if (!v) return;
    for (const f of fields) {
      if (!('type' in f) || f.type !== 'file') continue;
      const file = v[f.name] as File | undefined;
      if (file && file.size > 8e6) return toast(t('Photo too large (max 8 MB)'));
      (v as Record<string, unknown>)[f.name] = file ? await dataUrl(file) : w[f.name]; // no new file: keep the old one
    }
    Object.assign(w, v);
    saveWs();
  }

  function remove() {
    const list = ws().widgets, i = list.indexOf(w), copy = $state.snapshot(w);
    list.splice(i, 1);
    saveWs();
    toast(t('Removed: {0}', t(def!.label)), t('Undo'), () => { list.splice(i, 0, copy); saveWs(); });
  }

  // Dropping another widget here moves it before this one.
  function drop(e: DragEvent) {
    const id = e.dataTransfer!.getData('text/widget');
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    const list = ws().widgets, from = list.findIndex((x) => x.id === id);
    if (from < 0 || id === w.id) return;
    const [moved] = list.splice(from, 1);
    list.splice(list.indexOf(w), 0, moved!);
    saveWs();
  }
</script>

{#if def && View}
  <div class="widget" ondragover={(e) => e.preventDefault()} ondrop={drop} role="listitem">
    <div class="whead" draggable="true" title={t('Drag to reorder')} ondragstart={(e) => { e.stopPropagation(); e.dataTransfer!.setData('text/widget', w.id); }} role="group">
      <span class="grow">{w.label || t(def.label)}</span>
      {#if def.fields}<button title={t('Configure')} onclick={configure}>⚙</button>{/if}
      <button title={t('Remove widget')} onclick={remove}>×</button>
    </div>
    <View {w} save={saveWs} />
  </div>
{/if}
