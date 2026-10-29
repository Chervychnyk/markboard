import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardView, findBoard, planLinks, removeBlock, upsertBlock } from './agent.ts';
import { normalizeWorkspace } from './core.ts';
import type { BNode } from './types.ts';

const TYPES = ['clock', 'schedule', 'table'];
const board = () => normalizeWorkspace({ name: 'Race weekend', widgets: [{ id: 'w1', key: 'drivers', type: 'table', label: 'Drivers', text: 'a' }] }, '');

test('findBoard by id or name, any case', () => {
  const ws = { x: board() };
  assert.equal(findBoard(ws, 'x')[0], 'x');
  assert.equal(findBoard(ws, ' race WEEKEND ')[0], 'x');
  assert.throws(() => findBoard(ws, 'Work'), /Boards: Race weekend/);
});

test('upsertBlock replaces by key, keeps id and unspecified fields', () => {
  const w = board();
  assert.equal(upsertBlock(w, { key: 'drivers', type: 'table', text: 'Pos | Driver', settings: { note: 'After R20', id: 'evil', image: 'data:x' } }, TYPES), 'updated');
  assert.deepEqual(w.widgets, [{ id: 'w1', key: 'drivers', type: 'table', label: 'Drivers', text: 'Pos | Driver', note: 'After R20' }]);
  assert.equal(upsertBlock(w, { key: 'schedule', type: 'schedule', title: 'Sessions', text: 'Race | 2026-11-08T17:00:00Z' }, TYPES), 'created');
  assert.equal(w.widgets.length, 2);
  assert.throws(() => upsertBlock(w, { key: 'drivers', type: 'note' }, TYPES), /is a table/);
  assert.throws(() => upsertBlock(w, { key: 'x', type: 'rocket' }, TYPES), /Unknown type/);
  assert.throws(() => upsertBlock(w, { key: ' ', type: 'note' }, TYPES), /key/);
});

test('upsertBlock on a note keeps ticks of items that stay', () => {
  const w = board();
  upsertBlock(w, { key: 'plan', type: 'note', title: 'Plan', checklist: [{ text: 'Fantasy' }, { text: 'Snacks' }] }, TYPES);
  w.notes[0]!.checklist[1]!.done = true;
  upsertBlock(w, { key: 'plan', type: 'note', checklist: [{ text: 'Snacks' }, { text: 'Tyres' }] }, TYPES);
  assert.equal(w.notes.length, 1);
  assert.equal(w.notes[0]!.title, 'Plan');
  assert.deepEqual(w.notes[0]!.checklist, [{ text: 'Snacks', done: true }, { text: 'Tyres', done: false }]);
  assert.ok(removeBlock(w, 'plan'));
  assert.ok(!removeBlock(w, 'plan'));
});

test('planLinks matches by URL, drops bad and repeated ones', () => {
  const have = [
    { id: 'a', title: 'Old', url: 'https://a.test/' },
    { id: 'b', title: 'Gone', url: 'https://b.test/' },
    { id: 'f', title: 'Sub', children: [] },
  ] as unknown as BNode[];
  const want = [{ title: 'New', url: 'https://c.test/' }, { title: 'A', url: 'https://a.test/', comment: 'x' }, { title: 'Bad', url: 'javascript:alert(1)' }, { title: 'Again', url: 'https://c.test/' }];
  assert.deepEqual(planLinks(have, want, true), {
    links: [{ title: 'New', url: 'https://c.test/', comment: undefined, id: undefined }, { title: 'A', url: 'https://a.test/', comment: 'x', id: 'a' }],
    remove: ['b'],
  });
  assert.deepEqual(planLinks(have, want, false).remove, []);
});

test('boardView leaves out ids of blocks and photos', () => {
  const w = board();
  w.widgets.push({ id: 'p', type: 'photo', image: 'data:image/png;base64,AAAA' });
  const folder = { id: 'mb:1', title: 'This weekend', children: [{ id: 'mb:2', title: 'Guide', url: 'https://g.test/' }] } as unknown as BNode;
  const v = boardView('x', w, true, [folder], { 'mb:2': { comment: 'Read first' } });
  assert.deepEqual(v.folders, [{ id: 'mb:1', title: 'This weekend', links: [{ id: 'mb:2', title: 'Guide', url: 'https://g.test/', comment: 'Read first' }] }]);
  assert.deepEqual(v.widgets[1], { type: 'photo' });
});
