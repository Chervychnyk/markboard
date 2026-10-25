// The Settings dialog: look of the current workspace, its root folder, and general options.
import { backupNow } from './backup.ts';
import { TEMPLATES } from './commands.ts';
import { form, toast, type Extra } from './dialogs.svelte.ts';
import { LANGS, locale, t } from './i18n.ts';
import {
  ACCENTS, applyData, exportData, folderOptions, FONT_NAMES, FONTS, importFile, loadTemplate, look, PRESET_NAMES, PRESETS, save, saveWs, app, ws, wsRoot,
} from './store.svelte.ts';

const ACCENT_NAMES = ['Indigo', 'Blue', 'Green', 'Orange', 'Red'];

function pickFile() {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
  input.onchange = () => input.files?.[0] && importFile(input.files[0]);
  input.click();
}

export async function settings() {
  const l = look();
  const extra: Extra[] = [
    [t('Back up now'), async () => { await backupNow(); toast(t('Backup saved')); }],
    [t('Export'), exportData],
    [t('Import backup or template'), pickFile],
    [t('Show hidden columns'), () => { ws().hiddenCols = []; saveWs(); toast(t('All columns shown')); }],
    ...Object.entries(TEMPLATES).map(([f, name]): Extra => [t('Add “{0}” template', t(name)), () => loadTemplate(f)]),
    ...app.backups.map((b): Extra => [t('Restore backup from {0}', new Date(b.date).toLocaleString(locale)), () => applyData(b.data)]),
  ];
  const accentPreset = ACCENTS.includes(l.accent) ? l.accent : l.accent ? 'custom' : '';
  const v = await form(t('Settings'), [
    { heading: t('Look of “{0}”', ws().name) },
    { name: 'theme', label: t('Theme'), type: 'select', value: l.theme, options: [['system', t('System')], ['light', t('Light')], ['dark', t('Dark')], ['black', t('Pitch black')]] },
    { name: 'accentPreset', label: t('Accent color'), type: 'select', value: accentPreset,
      options: [['', t('Automatic')], ...ACCENTS.map((a, i): [string, string] => [a, t(ACCENT_NAMES[i]!)]), ['custom', t('Custom (color below)')]] },
    { name: 'accent', label: t('Custom accent'), type: 'color', value: l.accent || '#4f46e5' },
    { name: 'font', label: t('Typeface'), type: 'select', value: l.font, options: Object.keys(FONTS).map((f) => [f, t(FONT_NAMES[f]!)]) },
    { name: 'columns', label: t('Columns per screen'), type: 'select', value: String(l.columns), options: [['0', t('Auto (resizable)')], ...[3, 4, 5, 6, 7, 8].map((n): [string] => [String(n)])] },
    { name: 'panelOpacity', label: t('Column opacity'), type: 'range', min: 30, max: 100, value: l.panelOpacity },
    { name: 'compact', label: t('Compact rows'), type: 'checkbox', value: l.compact },
    { name: 'bgKind', label: t('Background'), type: 'select', value: l.bgKind, options: [['none', t('None')], ['solid', t('Solid color')], ['gradient', t('Gradient')], ['photo', t('Photo')]] },
    { name: 'bgPreset', label: t('Gradient'), type: 'select', value: l.bgPreset, options: [['custom', t('Custom (colors below)')], ...Object.keys(PRESETS).map((p): [string, string] => [p, t(PRESET_NAMES[p]!)])] },
    { name: 'bgColor', label: t('Color'), type: 'color', value: l.bgColor },
    { name: 'bgColor2', label: t('Second gradient color'), type: 'color', value: l.bgColor2 },
    { name: 'bgFile', label: t('Photo'), type: 'file', accept: 'image/*' },
    { name: 'intensity', label: t('Background intensity'), type: 'range', min: 0, max: 100, value: l.intensity },
    { name: 'grain', label: t('Film grain'), type: 'checkbox', value: l.grain },
    { name: 'parallax', label: t('Parallax on mouse move'), type: 'checkbox', value: l.parallax },
    { heading: t('Workspace') },
    { name: 'root', label: t('Folder shown as columns'), type: 'select', value: wsRoot().id, options: folderOptions() },
    { heading: t('General') },
    { name: 'lang', label: t('Language'), type: 'select', value: app.lang ?? 'auto', options: Object.entries(LANGS).map(([code, name]) => [code, name ?? t('Automatic')]) },
    { name: 'showHidden', label: t('Show hidden items'), type: 'checkbox', value: app.showHidden },
    { name: 'autoBackup', label: t('Automatic daily backups (last 7 kept)'), type: 'checkbox', value: app.autoBackup },
    { name: 'backupToDownloads', label: t('Also save backups to Downloads/Markboard backups'), type: 'checkbox', value: app.backupToDownloads,
      onchange: (e) => { const el = e.currentTarget; if (el.checked) browser.permissions.request({ permissions: ['downloads'] }).then((ok) => (el.checked = ok)); } },
  ], extra);
  if (!v) return;
  let bgImage = l.bgImage;
  if (v.bgFile) {
    if (v.bgFile.size > 8e6) return toast(t('Photo too large (max 8 MB)'));
    bgImage = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(v.bgFile); });
  }
  const { root, showHidden, autoBackup, backupToDownloads, bgFile, lang, accentPreset: ap, accent, ...rest } = v;
  ws().look = {
    ...rest, bgImage, bgKind: bgFile ? 'photo' : v.bgKind, accent: ap === 'custom' ? accent : ap,
    columns: Number(v.columns), panelOpacity: Number(v.panelOpacity), intensity: Number(v.intensity),
  };
  ws().root = root;
  Object.assign(app, { showHidden, autoBackup, backupToDownloads });
  save('showHidden', 'autoBackup', 'backupToDownloads');
  saveWs();
  if (lang !== (app.lang ?? 'auto')) {
    app.lang = lang;
    await save('lang');
    location.reload(); // strings are resolved at render; a reload re-renders everything in the new language
  }
}
