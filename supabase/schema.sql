create table if not exists public.requirement_sessions (
  session_id text primary key,
  state jsonb not null,
  messages jsonb not null default '[]'::jsonb,
  extraction_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists requirement_sessions_updated_at_idx
  on public.requirement_sessions (updated_at desc);

alter table public.requirement_sessions enable row level security;

drop policy if exists "No browser access to requirement sessions" on public.requirement_sessions;
create policy "No browser access to requirement sessions"
  on public.requirement_sessions
  for all
  using (false)
  with check (false);
