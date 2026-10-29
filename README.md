# Markboard

Your browser bookmarks as a board on the new tab page: folders as columns, notes, widgets, workspaces.
Search and commands go through [Tabkit](../tabkit): press <kbd>F</kbd> on the board.

## Quick start

```sh
npm install
npm run build    # -> .output/chrome-mv3, load via chrome://extensions → Load unpacked
```

## Features

- **Board**: the bookmarks bar (or any folder, per workspace) as resizable, reorderable, colourable columns, plus
  Recently added, Most visited, Favorites, Reminders and Sessions columns. Drag bookmarks, columns and widgets.
- **Gallery** (click a column title): grid, extended or list, sorted manually, by name or by date; bulk rename.
- **Bookmarks**: favorites, colour labels, tags, comments, custom icons, reminders (notifications), pins to the
  top bar, hiding. Selection mode (<kbd>S</kbd>) to favorite, colour, move, copy or delete many at once.
- **Notes** with checklists beside your folders (<kbd>N</kbd>).
- **Widgets**: date & time (any time zone), countdown, timer, pomodoro, counter (daily/weekly/monthly reset),
  snippet, photo frame.
- **Workspaces**: several named boards over the same bookmarks, each with its own look, columns and widgets.
- **Markboard folders**: folders and links kept in Markboard alone, outside the browser's bookmarks. A *Blank
  board* is built from them, and templates can be too; on any other board a Markboard-only folder joins as an extra
  column. Moving an item between the two trees copies it over with its tags, colour and favorites. They sync through
  `chrome.storage.sync` (about 100 KB, gzipped; photos stay on each device) with the boards on them, and Tabkit's
  bookmark search finds their links. Deleting a Blank board trashes its folders with it, restorable as one.
- **Look**: system / light / dark / pitch-black themes, five accents or a custom one, four typefaces, column
  count and opacity, backgrounds (colour, gradient presets, photo) with intensity, film grain and parallax.
- **Safety**: trash (7 days) and an undo toast for every delete; duplicate finder; export/import; automatic
  daily backups, optionally into Downloads; templates.
- **Toolbar popup**: save the current tab into a folder, search bookmarks.
- English, Ukrainian, Spanish, French, German.

### Commands and Tabkit

Markboard has no palette of its own. With Tabkit installed, <kbd>F</kbd> (or the search box) opens the Tabkit
palette, which lists every board command as "Markboard: …", including one per workspace. A command picked
while a board tab is current runs there; from any other tab it opens a new board tab and runs there. Without
Tabkit, <kbd>F</kbd> says so; every command still has a key (<kbd>?</kbd> lists them) or a toolbar button.

The protocol is in `lib/commands.ts` here and `lib/providers.ts` in Tabkit (`tabkit:links` hands Tabkit the
links in Markboard folders, so they come up in its bookmark search). Markboard registers on install,
on browser start and whenever a board opens, so installing Tabkit later still links them.

## Development

WXT + Svelte 5, the same setup as Tabkit.

```sh
npm run dev        # dev browser with hot reload
npm run build      # -> .output/chrome-mv3
npm test           # pure logic and i18n coverage
npm run check      # type-check
npm run lint       # ESLint (TypeScript + Svelte rules)
npm run verify     # check + lint + test + build; the git pre-commit hook and CI run this
npm run icons      # assets/icon.svg -> public/icon/{16,32,48,128}.png (needs rsvg-convert)
```

## Layout

- `entrypoints/background.ts`: reminder alarms, daily backups, and the Tabkit command provider.
- `lib/store.svelte.ts`: persisted state (`app`), the bookmark tree (`data`), per-tab `ui` state, and every
  board action. Components mutate `app` in place and call `save()`/`saveWs()`.
  Bookmark writes go through `bm`, which sends `mb:` ids to Markboard's own tree (`app.local`, helpers in `core.ts`)
  and the rest to `browser.bookmarks`; `data` holds both trees merged.
- `lib/sync.ts`: the background syncs Markboard folders and the boards on them; `syncBase` (the last agreed hash)
  tells which side changed, and when both did, the two are merged rather than one dropped.
- `lib/core.ts` (pure: defaults, search, backup validation, time formatting) and `lib/commands.ts` (the command
  table and Tabkit protocol) are unit-tested; `lib/i18n.test.ts` fails on any untranslated `t('…')` string.
- `lib/dialogs.svelte.ts` + `components/Dialogs.svelte`: promise-based form dialogs, modals and the toast.
- `lib/widgets.ts` lists widgets and their settings; their views are `components/widgets/*.svelte`.
- `components/App.svelte` is the new tab page (look, keys, toolbar); `Board`, `Column`, `Item`, `Gallery` the board.
