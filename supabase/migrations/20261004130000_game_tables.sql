-- Step 3: the full data model from docs/IMPLEMENTATION_PLAN.md §2 (calendar tables come with M8).
-- Every table carries user_id and a Row Level Security policy limiting all access to its owner.
-- user_id defaults to auth.uid(); the server also sets it from the verified session.

create type public.attribute as enum ('body', 'mind', 'bonds', 'craft', 'spirit');
create type public.quest_type as enum ('main', 'side', 'system'); -- 'system' = the Prologue
create type public.quest_status as enum ('active', 'paused', 'done');

-- Prototype tooling: shifts the app clock by whole days (the debug bar's "Next day").
alter table public.profiles add column dev_day_offset integer not null default 0 check (dev_day_offset between 0 and 3650);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  started_on date not null default current_date,
  ended_on date,
  summary text,
  unique (id, user_id)
);

create table public.attribute_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  attribute public.attribute not null,
  rating smallint not null check (rating between 1 and 5),
  context text not null default 'baseline' check (context in ('baseline', 'weekly_review')),
  rated_at timestamptz not null default now()
);

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  chapter_id uuid,
  type public.quest_type not null,
  status public.quest_status not null default 'active',
  title text not null,
  why text,
  primary_attr public.attribute not null,
  secondary_attr public.attribute check (secondary_attr is distinct from primary_attr),
  started_on date not null default current_date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  -- Composite keys: a row can only point at a parent owned by the same user.
  foreign key (chapter_id, user_id) references public.chapters (id, user_id) on delete set null (chapter_id)
);

create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  quest_id uuid not null,
  occurred_at timestamptz not null,
  title text not null,
  note text,
  minutes integer not null default 0 check (minutes >= 0),
  is_milestone boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'calendar', 'system')),
  source_ref text,
  created_at timestamptz not null default now(),
  foreign key (quest_id, user_id) references public.quests (id, user_id) on delete cascade
);
create index checkpoints_user_occurred on public.checkpoints (user_id, occurred_at desc);
create index checkpoints_quest_occurred on public.checkpoints (quest_id, occurred_at desc);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null check (kind in ('keep', 'starve')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.habit_logs (
  habit_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  primary key (habit_id, day),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

create table public.weather_logs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  weather text not null check (weather in ('clear', 'breezy', 'cloudy', 'foggy', 'stormy')),
  primary key (user_id, day)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  prompt text,
  body text not null,
  weather text,
  created_at timestamptz not null default now()
);

-- Logbook prompts. user_id null = a shared default; user-editable prompts come in v1.1.
create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  text text not null,
  sort smallint not null default 0,
  active boolean not null default true
);

create table public.unlocks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  feature text not null check (feature in ('prompts_rotate', 'habits', 'side_quests', 'character', 'where_life_goes', 'weekly_review', 'calendar')),
  unlocked_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, feature)
);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week_start date not null,
  note text,
  completed_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- Row Level Security: owner-only on every user table.
do $$
declare t text;
begin
  foreach t in array array['chapters', 'attribute_ratings', 'quests', 'checkpoints', 'habits', 'habit_logs',
                           'weather_logs', 'journal_entries', 'unlocks', 'weekly_reviews']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%s: own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Prompts: everyone signed in reads the defaults and their own; only their own can be changed.
alter table public.prompts enable row level security;
create policy "prompts: read defaults and own" on public.prompts
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "prompts: change own" on public.prompts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.prompts to authenticated;

insert into public.prompts (user_id, text, sort) values
  (null, 'What moved the story forward today?', 1),
  (null, 'Who did you spend time with, and how did it feel?', 2),
  (null, 'What drained you, and what fed you?', 3),
  (null, 'If today were a chapter title, what would it be?', 4),
  (null, 'What would you tell yourself from one year ahead?', 5),
  (null, 'Which quest are you avoiding, and why?', 6),
  (null, 'What small thing went better than expected?', 7);

-- M7: delete my account. Removes the auth user; every table cascades. Runs as the caller's own id only.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
