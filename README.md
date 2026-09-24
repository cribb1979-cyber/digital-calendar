# Digital Calendar

A Swedish, voice-first calendar. Say (or type) something like
*"Tandläkare på fredag klockan 3"* and the app works out the title, day and
time, asks when something is unclear (*"Menar du klockan 03:00 eller 15:00?"*),
and reminds you before the event.

## Features

- **Voice or text input** via the Web Speech API (`sv-SE`); follow-up questions
  are read aloud and can be answered by voice ("15", "på eftermiddagen", "spara").
- **Swedish natural-language parsing** (`client/src/lib/parser.js`):
  - days: *idag, imorgon, övermorgon, ikväll, på fredag, nästa måndag, om 3 dagar,
    den 5 oktober, 12/11, 2026-12-24, den 30:e*
  - times: *kl 15, 14:30, halv tre, kvart över tio, kvart i elva, klockan sju på kvällen*
  - ranges and durations: *mellan 13 och 15, kl 9-11:30, i en och en halv timme*
  - reminders: *påminn mig 30 minuter innan, med påminnelse 1 dag innan*
  - all-day: *hela dagen, heldag*
- **Clarification** for ambiguous hours (1–7 without *morgon/kväll*), missing day,
  time or title.
- **Month view, day list and upcoming events**; create, edit and delete events.
- **Reminders** as browser notifications plus in-app alerts (while the app is
  open in a tab). Default: 15 minutes before timed events.
- **Storage** in Supabase, or a local JSON file when Supabase isn't configured.
- Light/dark mode and mobile layout.

## Project structure

```
client/          React + Vite frontend
  src/lib/       parser, date helpers, API client (with unit tests)
  src/hooks/     speech recognition, reminders
  src/components/
server/          Express API that also serves client/dist
  store.js       Supabase store + JSON file fallback
  db/schema.sql  Supabase table definition
  test/          API tests
render.yaml
```

## Running locally

```bash
cd server && npm install && npm run dev      # API on http://localhost:5000
cd client && npm install && npm run dev      # UI on http://localhost:5173 (proxies /api)
```

Without Supabase variables, events are saved to `server/data/events.json`.

Tests:

```bash
cd client && npm test
cd server && npm test
```

## Supabase setup

1. In the Supabase dashboard, open **SQL Editor** and run `server/db/schema.sql`.
2. Copy the project URL and the **service_role** key from
   **Project Settings → API**. The key is only used by the server and never
   sent to the browser. Never share it.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | for persistence | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for persistence | Server-side key (works with RLS on). `SUPABASE_ANON_KEY` is accepted as a fallback but then needs RLS policies. |
| `APP_PASSWORD` | no | Protects the whole app with HTTP Basic auth (any username) |
| `NODE_ENV` | on Render | `production` |
| `NODE_VERSION` | on Render | `22` |
| `PORT` | no | Set automatically by Render |
| `DATA_FILE` | no | Path for the JSON file store |

## Deploying to Render

Create a **Web Service** from this repository with:

- **Root directory:** empty (repository root)
- **Build command:** `cd client && npm install && npm run build && cd ../server && npm install`
- **Start command:** `cd server && npm start`
- **Health check path:** `/api/health`
- The environment variables above

(If the service is created as a Blueprint, `render.yaml` sets this up.)

On Render's free plan the local disk is wiped on every deploy and restart, so
configure Supabase to keep your events.

## License

MIT
