// The Settings modal: opens the two-pane SettingsModal dialog.
import SettingsModal from '@/components/SettingsModal.svelte';
import { modal } from './dialogs.svelte.ts';
import { importFile } from './store.svelte.ts';

export const ACCENT_NAMES = ['Blue', 'Teal', 'Green', 'Orange', 'Red'];

export function pickBackupFile() {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
  input.onchange = () => input.files?.[0] && importFile(input.files[0]);
  input.click();
}

export function settings() {
  modal('', SettingsModal, { bare: true });
}
