alter table public.checkpoints add unique (id, quest_id, user_id);

create table public.compass_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  note text check (length(note) <= 4000),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  quest_id uuid,
  checkpoint_id uuid check (checkpoint_id is null or quest_id is not null),
  attribute public.attribute not null,
  completed_at timestamptz check (completed_at >= starts_at),
  created_at timestamptz not null default now(),
  revision integer not null default 0 check (revision >= 0),
  unique (id, user_id),
  foreign key (quest_id, user_id) references public.quests (id, user_id) on delete set null (quest_id),
  foreign key (checkpoint_id, quest_id, user_id) references public.checkpoints (id, quest_id, user_id) on delete set null (checkpoint_id)
);

create index compass_events_user_start on public.compass_events (user_id, starts_at, id);
create index compass_events_quest on public.compass_events (quest_id, user_id) where quest_id is not null;
create index compass_events_checkpoint on public.compass_events (checkpoint_id, quest_id, user_id) where checkpoint_id is not null;

alter table public.compass_events enable row level security;
create policy "compass_events: own rows" on public.compass_events for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.compass_events to authenticated;

-- Foreign-key actions can change an event outside its edit form.
create function public.bump_unlinked_event_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.revision = old.revision then new.revision := old.revision + 1; end if;
  return new;
end $$;
create trigger bump_unlinked_event_revision before update on public.compass_events
for each row when (old.quest_id is distinct from new.quest_id or old.checkpoint_id is distinct from new.checkpoint_id)
execute function public.bump_unlinked_event_revision();

-- Clear both event links before the quest and its checkpoints cascade.
create function public.unlink_events_from_quest() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.compass_events
    set quest_id = null, checkpoint_id = null
    where user_id = old.user_id and quest_id = old.id;
  return old;
end $$;
create trigger unlink_events_from_quest before delete on public.quests
for each row execute function public.unlink_events_from_quest();
