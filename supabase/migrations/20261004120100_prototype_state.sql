-- Bridge until the full data model lands (plan step 3): the whole game state of
-- one character as a JSON document, so the deployed app is playable per user now.
-- Step 3 moves this into the real tables (chapters, quests, checkpoints, ...) and
-- drops this table. Row Level Security: a user can only see and change their own row.

create table public.prototype_state (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.prototype_state enable row level security;

create policy "prototype_state: own row" on public.prototype_state
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.prototype_state to authenticated;
