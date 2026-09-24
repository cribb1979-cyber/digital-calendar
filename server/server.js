const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore, validateEvent, ValidationError } = require('./store');

const CLIENT_DIST = path.join(__dirname, '../client/dist');

// Optional HTTP Basic auth so the calendar isn't open to anyone with the URL.
function basicAuth(password) {
  const expected = Buffer.from(password);
  return (req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization || '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const given = Buffer.from(Buffer.from(encoded, 'base64').toString().split(':').slice(1).join(':'));
      if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Digital Calendar", charset="UTF-8"');
    res.status(401).send('Authentication required');
  };
}

function createApp({ store, password } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check stays public so Render can probe it
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, storage: store.kind });
  });

  if (password) app.use(basicAuth(password));

  const asyncRoute = (fn) => (req, res, next) => fn(req, res).catch(next);

  app.get('/api/events', asyncRoute(async (req, res) => {
    const { from, to } = req.query;
    res.json(await store.list({ from, to }));
  }));

  app.post('/api/events', asyncRoute(async (req, res) => {
    res.status(201).json(await store.create(validateEvent(req.body)));
  }));

  app.put('/api/events/:id', asyncRoute(async (req, res) => {
    const event = await store.update(req.params.id, validateEvent(req.body, { partial: true }));
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  }));

  app.delete('/api/events/:id', asyncRoute(async (req, res) => {
    if (!(await store.remove(req.params.id))) return res.status(404).json({ error: 'Event not found' });
    res.status(204).end();
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built React app when it exists
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

if (require.main === module) {
  const store = createStore();
  if (store.kind === 'file') {
    console.warn('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set - storing events in a local file (not persistent on Render)');
  }
  const PORT = process.env.PORT || 5000;
  createApp({ store, password: process.env.APP_PASSWORD }).listen(PORT, () => {
    console.log(`Server is running on port ${PORT} (storage: ${store.kind})`);
  });
}

module.exports = { createApp };
