import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { copyWorkspace, flatten, fmt, newWorkspace, normalizeWorkspace, periodKey, sanitize, search } from './core.ts';
import { providedCommands } from './commands.ts';
import type { BNode } from './types.ts';

const tree = [{ id: '1', parentId: '0', title: 'Bar', children: [
  { id: '2', parentId: '1', title: 'GitHub', url: 'https://github.com' },
  { id: '3', parentId: '1', title: 'Docs', children: [
    { id: '4', parentId: '3', title: 'MDN web docs', url: 'https://developer.mozilla.org', keywords: '#reference' },
  ] },
] }] as unknown as BNode[];

test('flatten and search', () => {
  const flat = flatten(tree) as (BNode & { keywords?: string })[];
  assert.deepEqual(flat.map((n) => n.id), ['1', '2', '3', '4']);
  assert.deepEqual(search(flat, 'git').map((n) => n.id), ['2']);
  assert.deepEqual(search(flat, 'mozilla web').map((n) => n.id), ['4']);
  assert.deepEqual(search(flat, 'docs').map((n) => n.id), ['3', '4']);
  assert.deepEqual(search(flat, '#reference').map((n) => n.id), ['4']);
  assert.deepEqual(search(flat, '   '), []);
});

test('fmt', () => {
  assert.equal(fmt(0), '00:00');
  assert.equal(fmt(65e3), '01:05');
  assert.equal(fmt(3661e3), '1:01:01');
  assert.equal(fmt(90061e3), '1d 1h 1m');
  assert.equal(fmt(-5e3), '00:00');
});

test('sanitize rejects bad shapes', () => {
  assert.deepEqual(sanitize({ showHidden: true, notes: 'x', junk: 1 }), { showHidden: true });
  assert.throws(() => sanitize({ showHidden: 'yes' }));
  assert.deepEqual(sanitize({ workspaces: {} }), {});
  assert.throws(() => sanitize({ meta: [] }));
  assert.throws(() => sanitize({ sessions: {} }));
  assert.throws(() => sanitize(null));
});

test('periodKey: weeks start on Monday', () => {
  // 2026-10-22 is a Thursday: same week as Monday the 19th, not as Sunday the 18th.
  const thu = new Date(2026, 9, 22), mon = new Date(2026, 9, 19), sun = new Date(2026, 9, 18);
  assert.equal(periodKey('week', thu), periodKey('week', mon));
  assert.notEqual(periodKey('week', thu), periodKey('week', sun));
  assert.notEqual(periodKey('day', thu), periodKey('day', mon));
  assert.equal(periodKey('month', thu), periodKey('month', sun));
  assert.equal(periodKey('', thu), '');
});

test('normalizeWorkspace fills fields and migrates a string note', () => {
  const w = normalizeWorkspace({ name: 'X', notes: 'hello', checklist: [{ text: 'a', done: true }] }, 'Notes');
  assert.equal(w.notes[0]!.text, 'hello');
  assert.deepEqual(w.notes[0]!.checklist, [{ text: 'a', done: true }]);
  assert.deepEqual(w.hiddenCols, []);
  assert.deepEqual(w.collapsed, []);
  assert.deepEqual(w.hidden, []);
  assert.deepEqual(w.favs, []);
  assert.deepEqual(w.widgets, []);
  assert.equal(normalizeWorkspace({}, 'Notes').name, 'Notes');
});

test('providedCommands: no search command, one per other workspace', () => {
  const ws = { a: normalizeWorkspace({ name: 'Home' }, ''), b: normalizeWorkspace({ name: 'Work' }, '') };
  const cmds = providedCommands({ workspaces: ws, ws: 'a' }, (s, ...a) => s.replace('{0}', String(a[0])));
  assert.ok(!cmds.some((c) => c.id === 'search'));
  assert.ok(cmds.some((c) => c.id === 'ws:b' && c.title === 'Workspace: Work'));
  assert.ok(!cmds.some((c) => c.id === 'ws:a'));
  assert.ok(cmds.some((c) => c.title === 'Add template: Race weekend'));
});

test('bundled template is valid', () => {
  const tpl = JSON.parse(readFileSync(new URL('../public/templates/race-weekend.json', import.meta.url), 'utf8'));
  assert.equal(tpl.template, 'markboard');
  for (const f of tpl.folders) for (const l of f.links) assert.match(l.url, /^https:\/\//);
  for (const w of tpl.workspace.widgets) if (w.tz) assert.ok(Intl.supportedValuesOf('timeZone').includes(w.tz), w.tz);
});

test('copyWorkspace copies the layout and gives notes and widgets their own ids', () => {
  const w = { ...newWorkspace('Work'), hidden: ['b1'], favs: ['b3'], collapsed: ['f1'] };
  w.notes = [{ id: 'n1', title: 'Todo', text: 'x', checklist: [] }];
  w.widgets = [{ id: 'w1', type: 'clock' }];
  w.order = ['f1', 'note:n1', 'widget:w1'];
  w.colNames = { 'note:n1': 'Mine' };
  const c = copyWorkspace(w, 'Home');
  const [n, x] = [c.notes[0]!.id, c.widgets[0]!.id];
  assert.equal(c.name, 'Home');
  assert.notEqual(n, 'n1');
  assert.notEqual(x, 'w1');
  assert.deepEqual(c.order, ['f1', `note:${n}`, `widget:${x}`]);
  assert.deepEqual(c.colNames, { [`note:${n}`]: 'Mine' });
  assert.deepEqual(c.hidden, ['b1']);
  assert.deepEqual(c.favs, ['b3']);
  c.notes[0]!.text = 'changed';
  c.hidden.push('b2');
  assert.equal(w.notes[0]!.text, 'x'); // the original is untouched
  assert.deepEqual(w.hidden, ['b1']);
});
