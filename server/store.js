const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const TABLE = 'calendar_events';

class ValidationError extends Error {}

function isValidDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Validate and normalize an event payload. With `partial`, only the fields
 * present are checked (used for updates).
 */
function validateEvent(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object') throw new ValidationError('Invalid request body');
  const out = {};

  if (!partial || 'title' in body) {
    if (typeof body.title !== 'string' || !body.title.trim()) throw new ValidationError('title is required');
    if (body.title.length > 200) throw new ValidationError('title is too long');
    out.title = body.title.trim();
  }
  if (!partial || 'start' in body) {
    if (!isValidDate(body.start)) throw new ValidationError('start must be an ISO date');
    out.start = new Date(body.start).toISOString();
  }
  if ('end' in body) {
    if (body.end == null) out.end = null;
    else if (!isValidDate(body.end)) throw new ValidationError('end must be an ISO date');
    else out.end = new Date(body.end).toISOString();
  } else if (!partial) {
    out.end = null;
  }
  if ('allDay' in body || !partial) out.allDay = Boolean(body.allDay);
  if ('reminderMinutes' in body || !partial) {
    const r = body.reminderMinutes;
    if (r == null) out.reminderMinutes = null;
    else if (!Number.isInteger(r) || r < 0 || r > 60 * 24 * 30) throw new ValidationError('reminderMinutes is invalid');
    else out.reminderMinutes = r;
  }
  if ('notes' in body || !partial) {
    const n = body.notes ?? '';
    if (typeof n !== 'string' || n.length > 5000) throw new ValidationError('notes is invalid');
    out.notes = n;
  }
  return out;
}

function checkRange(event) {
  if (event.end && event.start && event.end < event.start) throw new ValidationError('end must be after start');
}

function inRange(event, from, to) {
  const end = event.end || event.start;
  return (!from || end >= from) && (!to || event.start <= to);
}

// Local JSON file store. Fine for development; on Render the disk is wiped
// on every deploy, so use Supabase in production.
function createFileStore(file) {
  let events = [];
  try {
    events = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(events, null, 2));
  };
  const sorted = (list) => [...list].sort((a, b) => a.start.localeCompare(b.start));

  return {
    kind: 'file',
    async list({ from, to } = {}) {
      return sorted(events.filter((e) => inRange(e, from, to)));
    },
    async create(data) {
      checkRange(data);
      const event = { id: crypto.randomUUID(), ...data, createdAt: new Date().toISOString() };
      events.push(event);
      save();
      return event;
    },
    async update(id, data) {
      const i = events.findIndex((e) => e.id === id);
      if (i === -1) return null;
      const next = { ...events[i], ...data };
      checkRange(next);
      events[i] = next;
      save();
      return next;
    },
    async remove(id) {
      const before = events.length;
      events = events.filter((e) => e.id !== id);
      if (events.length === before) return false;
      save();
      return true;
    },
  };
}

const toRow = (e) => {
  const row = {};
  if ('title' in e) row.title = e.title;
  if ('start' in e) row.start_at = e.start;
  if ('end' in e) row.end_at = e.end;
  if ('allDay' in e) row.all_day = e.allDay;
  if ('reminderMinutes' in e) row.reminder_minutes = e.reminderMinutes;
  if ('notes' in e) row.notes = e.notes;
  return row;
};

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  start: new Date(r.start_at).toISOString(),
  end: r.end_at ? new Date(r.end_at).toISOString() : null,
  allDay: r.all_day,
  reminderMinutes: r.reminder_minutes,
  notes: r.notes || '',
  createdAt: r.created_at,
});

function createSupabaseStore(client) {
  const unwrap = ({ data, error }) => {
    if (error) throw new Error(`Supabase: ${error.message}`);
    return data;
  };
  return {
    kind: 'supabase',
    async list({ from, to } = {}) {
      let q = client.from(TABLE).select('*').order('start_at');
      // Events that overlap [from, to]
      if (to) q = q.lte('start_at', to);
      if (from) q = q.or(`end_at.gte.${from},and(end_at.is.null,start_at.gte.${from})`);
      return unwrap(await q).map(fromRow);
    },
    async create(data) {
      checkRange(data);
      return fromRow(unwrap(await client.from(TABLE).insert(toRow(data)).select().single()));
    },
    async update(id, data) {
      const existing = unwrap(await client.from(TABLE).select('*').eq('id', id).maybeSingle());
      if (!existing) return null;
      checkRange({ ...fromRow(existing), ...data });
      return fromRow(unwrap(await client.from(TABLE).update(toRow(data)).eq('id', id).select().single()));
    },
    async remove(id) {
      const rows = unwrap(await client.from(TABLE).delete().eq('id', id).select('id'));
      return rows.length > 0;
    },
  };
}

function createStore(env = process.env) {
  const url = env.SUPABASE_URL;
  // Prefer the service role key: it stays on the server and works with RLS enabled.
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (url && key) {
    return createSupabaseStore(createClient(url, key, { auth: { persistSession: false } }));
  }
  return createFileStore(env.DATA_FILE || path.join(__dirname, 'data', 'events.json'));
}

module.exports = { createStore, createFileStore, validateEvent, ValidationError };
