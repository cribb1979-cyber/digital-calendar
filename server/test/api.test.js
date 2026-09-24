const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');
const { createFileStore } = require('../store');

let server;
let base;
let dir;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-'));
  const app = createApp({ store: createFileStore(path.join(dir, 'events.json')) });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});

after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body && JSON.stringify(body),
});

test('create, list, update and delete an event', async () => {
  let res = await fetch(`${base}/events`, json('POST', {
    title: 'Tandläkare',
    start: '2026-09-25T13:00:00.000Z',
    end: '2026-09-25T14:00:00.000Z',
    reminderMinutes: 15,
  }));
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.ok(created.id);
  assert.equal(created.allDay, false);
  assert.equal(created.notes, '');

  res = await fetch(`${base}/events`);
  assert.deepEqual((await res.json()).map((e) => e.id), [created.id]);

  res = await fetch(`${base}/events?from=2026-10-01T00:00:00Z`);
  assert.deepEqual(await res.json(), []);

  res = await fetch(`${base}/events/${created.id}`, json('PUT', { title: 'Tandläkaren' }));
  assert.equal(res.status, 200);
  const updated = await res.json();
  assert.equal(updated.title, 'Tandläkaren');
  assert.equal(updated.reminderMinutes, 15);

  res = await fetch(`${base}/events/${created.id}`, { method: 'DELETE' });
  assert.equal(res.status, 204);
  res = await fetch(`${base}/events/${created.id}`, { method: 'DELETE' });
  assert.equal(res.status, 404);
});

test('rejects invalid events', async () => {
  let res = await fetch(`${base}/events`, json('POST', { title: '', start: '2026-09-25T13:00:00Z' }));
  assert.equal(res.status, 400);
  res = await fetch(`${base}/events`, json('POST', { title: 'X', start: 'nope' }));
  assert.equal(res.status, 400);
  res = await fetch(`${base}/events`, json('POST', {
    title: 'X', start: '2026-09-25T13:00:00Z', end: '2026-09-25T12:00:00Z',
  }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /end/);
});

test('basic auth protects the API but not the health check', async () => {
  const app = createApp({ store: createFileStore(path.join(dir, 'auth.json')), password: 'hemligt' });
  const s = app.listen(0);
  await new Promise((r) => s.once('listening', r));
  const url = `http://localhost:${s.address().port}/api`;
  try {
    assert.equal((await fetch(`${url}/health`)).status, 200);
    assert.equal((await fetch(`${url}/events`)).status, 401);
    const auth = { headers: { Authorization: `Basic ${Buffer.from('erik:hemligt').toString('base64')}` } };
    assert.equal((await fetch(`${url}/events`, auth)).status, 200);
  } finally {
    s.close();
  }
});
