<script lang="ts">
  import { form, toast } from '@/lib/dialogs.svelte';
  import { t } from '@/lib/i18n';
  import { bm, bulkMeta, COLORS, data, folderOptions, isFav, mark, removeMany, toggleSelect, ui } from '@/lib/store.svelte';

  const nodes = $derived([...ui.selected].map((id) => data.byId.get(id)).filter((n) => !!n));
  const needs = (fn: () => unknown) => () => (nodes.length ? fn() : toast(t('Click items to select them first')));

  async function color() {
    const v = await form(t('Color label'), [{ name: 'color', label: t('Color'), type: 'select', options: COLORS.map((c) => [c, c || t('None')]) }]);
    if (v) bulkMeta(nodes, { color: v.color });
  }
  async function move() {
    const v = await form(t('Move to folder'), [{ name: 'folder', label: t('Folder'), type: 'select', options: folderOptions() }]);
    if (!v) return;
    for (const n of nodes) await bm.move(n.id, { parentId: v.folder }).catch((e) => toast(e.message));
    toggleSelect();
  }
  const copy = () => navigator.clipboard.writeText(nodes.filter((n) => n.url).map((n) => n.url).join('\n')).then(() => toast(t('Links copied')));
</script>

<div id="selbar">
  <span class="grow">{t('Selected: {0}', nodes.length)}</span>
  <button type="button" class="btn" onclick={needs(() => mark('favs', nodes.map((n) => n.id), !nodes.every((n) => isFav(n.id))))}>{t('Favorite')}</button>
  <button type="button" class="btn" onclick={needs(color)}>{t('Color label')}</button>
  <button type="button" class="btn" onclick={needs(move)}>{t('Move…')}</button>
  <button type="button" class="btn" onclick={needs(copy)}>{t('Copy links')}</button>
  <button type="button" class="btn" onclick={needs(() => { removeMany(nodes.map((n) => n.id)); toggleSelect(); })}>{t('Delete')}</button>
  <button type="button" class="btn primary" onclick={toggleSelect}>{t('Done')}</button>
</div>
