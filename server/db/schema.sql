-- Run this in the Supabase SQL editor to create the events table.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  reminder_minutes integer,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_start_at_idx on public.calendar_events (start_at);

-- Keep Row Level Security on. The server uses SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS, so no policies are needed and the table stays closed
-- to anyone holding only the public anon key.
alter table public.calendar_events enable row level security;
