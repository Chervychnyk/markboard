import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { COMMANDS, TEMPLATES } from './commands.ts';
import { ROWS } from './i18n.ts';
import { WIDGETS } from './widgets.ts';

const holes = (s: string) => (s.match(/\{\d\}/g) ?? []).sort().join();

test('every row has 4 translations with the same {n} placeholders', () => {
  for (const [k, row] of Object.entries(ROWS)) {
    assert.equal(row.length, 4, k);
    for (const v of row) { assert.ok(v, k); assert.equal(holes(v), holes(k), `${k} → ${v}`); }
  }
});

test('every UI string is translated', () => {
  const used = new Set<string>();
  const files = ['lib', 'components', 'components/widgets'].flatMap((d) =>
    readdirSync(new URL(`../${d}/`, import.meta.url)).filter((f) => /\.(ts|svelte)$/.test(f) && !f.endsWith('.test.ts')).map((f) => `../${d}/${f}`));
  for (const f of files)
    for (const [, s] of readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) used.add(s!.replace(/\\'/g, "'"));
  // Keys passed to t() indirectly: command titles, widget labels, template, font, accent and preset names.
  for (const c of COMMANDS) used.add(c.title);
  for (const w of Object.values(WIDGETS)) used.add(w.label);
  for (const n of Object.values(TEMPLATES)) used.add(n);
  const settings = readFileSync(new URL('./settings.ts', import.meta.url), 'utf8');
  for (const [, list] of settings.matchAll(/ACCENT_NAMES = \[([^\]]+)\]/g)) for (const [, s] of list!.matchAll(/'([^']+)'/g)) used.add(s!);
  const store = readFileSync(new URL('./store.svelte.ts', import.meta.url), 'utf8');
  for (const [, s] of store.matchAll(/: '(Sans|Serif|Mono|Rounded|Dusk|Ocean|Forest|Ember|Carbon)'/g)) used.add(s!);
  const missing = [...used].filter((s) => !(s in ROWS));
  assert.deepEqual(missing, [], 'untranslated UI strings');
});
