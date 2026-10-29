import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardView, currentRun, findBoard, noteChange, planLinks, removeBlock, revertBlocks, RUN_GAP, upsertBlock } from './agent.ts';
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
  const before = upsertBlock(w, { key: 'drivers', type: 'table', text: 'Pos | Driver', settings: { note: 'After R20', id: 'evil', image: 'data:x' } }, TYPES, 5);
  assert.deepEqual(before, { id: 'w1', key: 'drivers', type: 'table', label: 'Drivers', text: 'a' });
  assert.deepEqual(w.widgets, [{ id: 'w1', key: 'drivers', type: 'table', label: 'Drivers', text: 'Pos | Driver', note: 'After R20', agentAt: 5 }]);
  assert.equal(upsertBlock(w, { key: 'schedule', type: 'schedule', title: 'Sessions', text: 'Race | 2026-11-08T17:00:00Z' }, TYPES), null);
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
  assert.equal(removeBlock(w, 'plan')?.key, 'plan');
  assert.equal(removeBlock(w, 'plan'), undefined);
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

test('a run groups changes until a gap, and reverting puts blocks back in place', () => {
  const ws = { x: board() };
  const r = currentRun(undefined, 1000);
  assert.equal(currentRun(r, 1000 + RUN_GAP - 1).at, 1000);
  assert.equal(currentRun(r, 1000 + RUN_GAP).changes, 0);
  ws.x.widgets.push({ id: 'c', type: 'clock' });
  const change = (key: string, before: ReturnType<typeof upsertBlock>) => noteChange(r, 'Race weekend', { id: 'x', key, before });
  change('drivers', upsertBlock(ws.x, { key: 'drivers', type: 'table', text: 'one' }, TYPES));
  change('drivers', upsertBlock(ws.x, { key: 'drivers', type: 'table', text: 'two' }, TYPES)); // keeps the first "before"
  change('plan', upsertBlock(ws.x, { key: 'plan', type: 'note', text: 'hi' }, TYPES));
  assert.deepEqual([r.changes, r.boards, r.blocks.length], [3, ['Race weekend'], 2]);
  revertBlocks(ws, r);
  assert.deepEqual(ws.x.widgets, [{ id: 'w1', key: 'drivers', type: 'table', label: 'Drivers', text: 'a' }, { id: 'c', type: 'clock' }]);
  assert.deepEqual(ws.x.notes, []);
  // a removed block comes back
  const r2 = currentRun(undefined, 0);
  noteChange(r2, 'Race weekend', { id: 'x', key: 'drivers', before: removeBlock(ws.x, 'drivers')! });
  revertBlocks(ws, r2);
  assert.equal(ws.x.widgets.at(-1)?.key, 'drivers');
});
