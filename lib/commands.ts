// Board commands and the Tabkit command-provider protocol. Pure: the board page maps ids to actions,
// the background lists them for Tabkit.
import type { Data } from './types.ts';

/** Tabkit's extension id, pinned by its manifest key. */
export const TABKIT_ID = 'mfkkblanhdohfjjhffnpfdcbbgbhmmbd';

/** Messages between Tabkit and a command provider (this extension). */
export type TabkitMessage =
  | { type: 'tabkit:register'; name: string } // provider → Tabkit: list my commands in the palette
  | { type: 'tabkit:open' } // provider → Tabkit: open the palette over the sender's tab
  | { type: 'tabkit:commands' } // Tabkit → provider: reply with ProvidedCommand[]
  | { type: 'tabkit:run'; command: string; tabId?: number }; // Tabkit → provider

export interface ProvidedCommand { id: string; title: string }

/** Board commands. `key` is the single-key shortcut on the board; titles are i18n keys. */
export const COMMANDS: { id: string; title: string; key?: string }[] = [
  { id: 'search', title: 'Search & command palette', key: 'F' },
  { id: 'view', title: 'Switch view density / gallery layout', key: 'V' },
  { id: 'select', title: 'Selection mode', key: 'S' },
  { id: 'note', title: 'New note', key: 'N' },
  { id: 'theme', title: 'Cycle theme', key: 'T' },
  { id: 'board', title: 'Back to board', key: 'B' },
  { id: 'duplicates', title: 'Find duplicates', key: 'D' },
  { id: 'help', title: 'Keyboard shortcuts', key: '?' },
  { id: 'save-tabs', title: 'Save open tabs as folder' },
  { id: 'save-session', title: 'Save session' },
  { id: 'settings', title: 'Settings' },
  { id: 'trash', title: 'Trash' },
  { id: 'export', title: 'Export backup' },
  { id: 'backup', title: 'Back up now' },
  { id: 'template:race-weekend', title: 'Add template: {0}' },
];

export const TEMPLATES: Record<string, string> = { 'race-weekend': 'Race weekend' };

/** What Tabkit lists: every command but "search" (that is Tabkit itself), then one per other workspace. */
export function providedCommands(d: Pick<Data, 'workspaces' | 'ws'>, t: (s: string, ...a: unknown[]) => string): ProvidedCommand[] {
  const title = (c: (typeof COMMANDS)[number]) =>
    c.id.startsWith('template:') ? t(c.title, t(TEMPLATES[c.id.slice(9)]!)) : t(c.title);
  return [
    ...COMMANDS.filter((c) => c.id !== 'search').map((c) => ({ id: c.id, title: title(c) })),
    ...Object.entries(d.workspaces)
      .filter(([id]) => id !== d.ws)
      .map(([id, w]) => ({ id: `ws:${id}`, title: t('Workspace: {0}', w.name) })),
  ];
}
