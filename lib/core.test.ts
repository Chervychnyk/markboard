import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ago, copyWorkspace, detachNode, emptyLocal, findNode, flatten, fmt, insertNode, layoutLanes, moveNode, newWorkspace, normalizeWorkspace, parseSchedule, parseTable, periodKey, sanitize, search,
} from './core.ts';
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
  const keys = [...tpl.workspace.widgets, ...tpl.workspace.notes].map((x) => x.key).filter(Boolean);
  assert.equal(new Set(keys).size, keys.length, 'keys are unique on a board');
  for (const w of tpl.workspace.widgets) if (w.tz) assert.ok(Intl.supportedValuesOf('timeZone').includes(w.tz), w.tz);
});

test('layoutLanes keeps placed cards in their lane and deals the rest to the shortest', () => {
  const cards = ['a', 'b', 'c', 'w', 'd'].map((k) => ({ k }));
  const keys = (lanes: { k: string }[][]) => lanes.map((l) => l.map((c) => c.k));
  const h = () => 100, widget = (c: { k: string }) => c.k === 'w';
  assert.deepEqual(keys(layoutLanes(cards, 3, {}, h, widget)), [['a', 'd'], ['b'], ['c', 'w']]);
  // Placed in lane 0 and 2, lane 1 left empty; the loose ones fill the shortest lanes after them.
  assert.deepEqual(keys(layoutLanes(cards, 4, { a: 0, b: 0, c: 0, w: 0, d: 2 }, h, widget)), [['a', 'b', 'c', 'w'], [], ['d'], []]);
  assert.deepEqual(keys(layoutLanes(cards, 3, { a: 2, b: 2 }, h, widget)), [['c'], ['d'], ['a', 'b', 'w']]);
  // A lane past the board's count no longer exists: its cards are dealt like new ones.
  assert.deepEqual(keys(layoutLanes(cards, 2, { a: 3, b: 1 }, h, widget)), [['a', 'c', 'd'], ['b', 'w']]);
});

test('copyWorkspace copies the layout and gives notes and widgets their own ids', () => {
  const w = { ...newWorkspace('Work'), hidden: ['b1'], favs: ['b3'], collapsed: ['f1'] };
  w.notes = [{ id: 'n1', title: 'Todo', text: 'x', checklist: [] }];
  w.widgets = [{ id: 'w1', type: 'clock' }];
  w.order = ['f1', 'note:n1', 'widget:w1'];
  w.colNames = { 'note:n1': 'Mine' };
  w.lanes = { f1: 0, 'widget:w1': 2 };
  const c = copyWorkspace(w, 'Home');
  const [n, x] = [c.notes[0]!.id, c.widgets[0]!.id];
  assert.equal(c.name, 'Home');
  assert.notEqual(n, 'n1');
  assert.notEqual(x, 'w1');
  assert.deepEqual(c.order, ['f1', `note:${n}`, `widget:${x}`]);
  assert.deepEqual(c.colNames, { [`note:${n}`]: 'Mine' });
  assert.deepEqual(c.lanes, { f1: 0, [`widget:${x}`]: 2 });
  assert.deepEqual(c.hidden, ['b1']);
  assert.deepEqual(c.favs, ['b3']);
  c.notes[0]!.text = 'changed';
  c.hidden.push('b2');
  assert.equal(w.notes[0]!.text, 'x'); // the original is untouched
  assert.deepEqual(w.hidden, ['b1']);
});

test('local tree: insert, move with browser index semantics, detach', () => {
  const root = emptyLocal();
  const a = insertNode(root, 'mb', { title: 'A' });
  const [x, y, z] = ['x', 'y', 'z'].map((title) => insertNode(root, a.id, { title, url: `https://${title}.dev` }));
  const order = () => findNode(root, a.id)!.children!.map((n) => n.title).join('');
  assert.equal(order(), 'xyz');
  assert.deepEqual([x!.index, z!.parentId], [0, a.id]);
  moveNode(root, x!.id, a.id, 2); // dropped before z: counted with x still in place
  assert.equal(order(), 'yxz');
  moveNode(root, z!.id, a.id, 0);
  assert.equal(order(), 'zyx');
  const b = insertNode(root, a.id, { title: 'B' });
  assert.throws(() => moveNode(root, a.id, b.id), /itself/);
  moveNode(root, y!.id, b.id);
  assert.equal(findNode(root, y!.id)!.parentId, b.id);
  assert.equal(detachNode(root, a.id)!.title, 'A');
  assert.equal(findNode(root, y!.id), undefined);
  assert.equal(detachNode(root, 'mb'), undefined);
  assert.throws(() => insertNode(root, 'mb:nope', { title: 'x' }));
  assert.deepEqual(flatten([root]).map((n) => n.id), ['mb']);
});

test('sanitize checks the local tree', () => {
  const local = emptyLocal();
  insertNode(local, 'mb', { title: 'A' });
  assert.deepEqual(sanitize({ local }), { local });
  assert.throws(() => sanitize({ local: { ...local, id: '1' } }));
  assert.throws(() => sanitize({ local: { ...local, children: [{ id: 'mb:1', title: 'x', url: 'javascript:alert(1)' }] } }));
  assert.throws(() => sanitize({ local: { ...local, children: [{ id: '5', title: 'x', children: [] }] } }));
});

test('parseSchedule: label | time lines, bad ones dropped', () => {
  const s = parseSchedule('FP1 | 2026-10-30T18:30:00Z\n\nRace|2026-11-01T20:00:00Z\nTBC | soon\nno time\n | 2026-11-01T20:00:00Z');
  assert.deepEqual(s, [{ label: 'FP1', at: Date.UTC(2026, 9, 30, 18, 30) }, { label: 'Race', at: Date.UTC(2026, 10, 1, 20) }]);
});

test('parseTable: pipe rows, markdown tables too', () => {
  assert.deepEqual(parseTable('Pos | Driver | Pts\n1 | Norris | 357'), [['Pos', 'Driver', 'Pts'], ['1', 'Norris', '357']]);
  assert.deepEqual(parseTable('| Pos | Driver |\n|---|:--:|\n| 1 | Norris |\n'), [['Pos', 'Driver'], ['1', 'Norris']]);
  assert.deepEqual(parseTable('just text'), [['just text']]);
  assert.deepEqual(parseTable(''), []);
});

test('ago', () => {
  const now = Date.UTC(2026, 9, 29, 12);
  assert.equal(ago(now - 2 * 3600e3, 'en', now), '2 hours ago');
  assert.equal(ago(now - 30e3, 'en', now), 'now');
  assert.equal(ago(now - 864e5, 'en', now), 'yesterday');
});
