---
name: f1-weekend
description: Update the Race weekend board in Markboard with the current F1 weekend - session schedule, drivers' and constructors' standings, practice / qualifying / race positions, track clock, links and the race-day note. Use when the user asks to update, refresh or fill the F1 / race weekend board, or to add results after a session (FP1-FP3, sprint, qualifying, race).
---

# F1 race weekend board

Fills the Markboard "Race weekend" board (made from the bundled template) through the `markboard` MCP tools.
Data comes from `scripts/f1.py`, which prints JSON with the widget text ready to use:

| Command | Gives |
|---|---|
| `python3 scripts/f1.py next` | the race weekend under way or next: `race`, `round`, `circuit`, `locality`, `country`, `sprint`, `schedule_text`, `links` |
| `python3 scripts/f1.py standings` | `drivers_text` + `drivers_note`, `constructors_text` + `constructors_note` (after the last round) |
| `python3 scripts/f1.py session [NAME]` | a finished session of the current weekend: `key`, `title`, `text`, `note`, `location`; NAME is `"Practice 1"`, `"Qualifying"`, … (default: the latest one that ended) |

Run it from this skill's directory. It needs `api.jolpi.ca` and `api.openf1.org`. On `{"error": …}` (exit 1), say what failed;
don't fill the board from memory.

## Steps

1. `read_board("Race weekend")` (if there is no such board, `list_boards` and ask which one). Note the keys it already has.
2. `f1.py next`, then update:
   - `schedule` (schedule): title `"<Race short name> · Round <n>"`, text `schedule_text`.
   - `track-time` (clock): title `"<locality> (track)"`, settings `{"tz": <IANA zone of the circuit>, "hours": "24"}`. Work out the zone from the city.
3. `f1.py standings`, then update `drivers` (table) with `drivers_text` and settings `{"note": drivers_note}`, and `constructors` the same way.
   Skip this if the round in the notes is unchanged since the last update (read_board shows the current note).
4. Session results: `f1.py session`. If its `location` is not this weekend's race (no session has ended yet, or the
   latest one belongs to the previous race), skip this step. Otherwise update the block named by `key`:
   - `practice` (table): the latest practice; each new FP replaces the previous one.
   - `qualifying` (table): qualifying, or sprint qualifying on a sprint weekend until the main qualifying ends.
   - `race` (table): sprint or race result.
   Use `title`, `text`, settings `{"note": note}`. When the user names a session ("add FP2"), pass that NAME.
   At the start of a new weekend (the race in `next` differs from the board's schedule title), `remove_block` the old
   `practice`, `qualifying` and `race` blocks, since they belong to the previous race.
5. `set_links("Race weekend", "This weekend", …)` with the race's own links: the formula1.com race page
   (`https://www.formula1.com/en/racing/<year>/<country-slug>`), `links.wikipedia`, `links.circuit_wikipedia` with one
   line on what makes the track special, `links.windy` ("Forecast at the circuit"), and FIA event documents
   (`https://www.fia.com/documents/championships/fia-formula-one-world-championship-14`). Only add a link you have
   reason to believe loads; leave a guessed one out.
6. `plan` (note): title `"Race day plan · <country>"`, text mentioning the race start in UTC and track local time.
   Send the checklist only to add an item; keep the existing items in their order so the user's ticks stay.
7. Tell the user what changed in a few lines (session results with the top three, standings leader and gap).
   Every change shows "Updated by Claude" on the board and can be undone in one go from the toast or
   Settings → Agent access.

## Rules

- Keep the keys above; never add a second block for the same thing.
- Leave `fantasy`, the city clocks and the other folders alone unless asked.
- Times in widgets are UTC ISO strings; the board shows them in the viewer's zone.
- Driver surnames only in tables; teams by short name (the script does both).

## Keeping it fresh

During a weekend, `/loop 30m /f1-weekend` refreshes it after each session (Claude Code must stay open: the board
connects to the MCP server on this machine, so cloud routines can't reach it). Results usually appear in OpenF1 within
minutes of a session ending; if `session` says there is no classification yet, try again later.
