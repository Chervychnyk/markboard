import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLocal, findNode, flatten, insertNode, newWorkspace } from './core.ts';
import { applyPayload, canonical, mergeTree, pack, payloadOf, unpack } from './sync.ts';

const titles = (n: Parameters<typeof flatten>[0][number]) => flatten([n]).map((x) => x.title).join(',');

test('canonical ignores key order', () => {
  assert.equal(canonical({ b: 1, a: { d: [2, { y: 1, x: 0 }], c: 3 } }), canonical({ a: { c: 3, d: [2, { x: 0, y: 1 }] }, b: 1 }));
});

test('mergeTree keeps the first tree and adds what only the second has', () => {
  const a = emptyLocal();
  const shared = insertNode(a, 'mb', { title: 'Shared' });
  insertNode(a, shared.id, { title: 'A link', url: 'https://a.dev' });
  const b = structuredClone(a);
  insertNode(b, shared.id, { title: 'B link', url: 'https://b.dev' });
  const bOnly = insertNode(b, 'mb', { title: 'B folder' });
  insertNode(b, bOnly.id, { title: 'B inner', url: 'https://c.dev' });
  findNode(b, shared.id)!.title = 'Renamed in B';
  const out = mergeTree(a, b);
  assert.equal(titles(out), 'Markboard,Shared,A link,B link,B folder,B inner');
  assert.equal(findNode(out, bOnly.id)!.children![0]!.parentId, bOnly.id);
  assert.equal(titles(a), 'Markboard,Shared,A link'); // inputs untouched
});

test('payloadOf: Markboard folders, their meta, the boards on them, no photos', () => {
  const local = emptyLocal();
  const f = insertNode(local, 'mb', { title: 'F' });
  const onLocal = { ...newWorkspace('Free', { bgImage: 'data:image/png;base64,AAAA' }), root: f.id };
  onLocal.widgets = [{ id: 'p', type: 'photo', image: 'data:image/jpeg;base64,BBBB' }];
  const d = { local, meta: { [f.id]: { color: 'red' }, '12': { color: 'blue' } }, workspaces: { free: onLocal, bar: newWorkspace('Bar') } };
  const p = payloadOf(d);
  assert.deepEqual(Object.keys(p.workspaces), ['free']);
  assert.deepEqual(Object.keys(p.meta), [f.id]);
  assert.equal(p.workspaces.free!.look.bgImage, undefined);
  assert.equal(p.workspaces.free!.widgets[0]!.image, undefined);
  assert.equal(d.workspaces.free.look.bgImage, 'data:image/png;base64,AAAA'); // the source keeps them
});

test('applyPayload: a pull replaces synced state, a merge keeps both; photos and browser boards stay', () => {
  const local = emptyLocal();
  const f = insertNode(local, 'mb', { title: 'F' });
  const free = { ...newWorkspace('Free', { bgImage: 'data:image/png;base64,AAAA' }), root: f.id };
  const mine = { local, meta: { '12': { color: 'blue' }, [f.id]: { color: 'red' } }, workspaces: { free, bar: newWorkspace('Bar') }, ws: 'free' };
  const remoteLocal = emptyLocal();
  const g = insertNode(remoteLocal, 'mb', { title: 'G' });
  const remote = { local: remoteLocal, meta: { [g.id]: { color: 'green' } }, workspaces: { other: { ...newWorkspace('Other'), root: g.id } } };

  const pulled = applyPayload(mine, remote, false);
  assert.equal(titles(pulled.local), 'Markboard,G');
  assert.deepEqual(Object.keys(pulled.workspaces).sort(), ['bar', 'other']);
  assert.deepEqual(Object.keys(pulled.meta).sort(), ['12', g.id].sort());
  assert.equal(pulled.ws, 'bar'); // the current board was deleted elsewhere

  const merged = applyPayload(mine, remote, true);
  assert.equal(titles(merged.local), 'Markboard,G,F');
  assert.deepEqual(Object.keys(merged.workspaces).sort(), ['bar', 'free', 'other']);
  assert.deepEqual(Object.keys(merged.meta).sort(), ['12', f.id, g.id].sort());
  assert.equal(merged.ws, 'free');

  const back = applyPayload(mine, payloadOf(mine), false); // its own data coming back keeps this machine's photo
  assert.equal(back.workspaces.free!.look.bgImage, 'data:image/png;base64,AAAA');
});

test('pack and unpack round-trip, small enough for storage.sync items', async () => {
  const local = emptyLocal();
  for (let i = 0; i < 400; i++) insertNode(local, 'mb', { title: `Link ${i}`, url: `https://example.com/page/${i}` });
  const text = canonical(payloadOf({ local, meta: {}, workspaces: {} }));
  const { chunks, bytes } = await pack(text);
  assert.ok(chunks.every((c) => c.length <= 7000));
  assert.ok(bytes < text.length / 2, `${bytes} vs ${text.length}`);
  assert.equal(await unpack(chunks), text);
});
