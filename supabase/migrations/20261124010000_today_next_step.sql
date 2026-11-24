create table public.today_next_steps (
  user_id uuid primary key references auth.users on delete cascade,
  id uuid not null unique,
  quest_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 160),
  day date not null,
  foreign key (quest_id, user_id) references public.quests (id, user_id) on delete cascade
);
alter table public.today_next_steps enable row level security;
grant select, insert, update, delete on public.today_next_steps to authenticated;
create policy next_step_owner on public.today_next_steps for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A paused or finished quest yields its place on Today, including when another
-- device changes the quest while the next-step form is open.
create function public.clear_inactive_quest_step() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.today_next_steps where user_id = new.user_id and quest_id = new.id;
  return null;
end $$;
create trigger clear_inactive_quest_step after update of status on public.quests
  for each row when (new.status <> 'active' and new.status is distinct from old.status)
  execute function public.clear_inactive_quest_step();

-- Each edit replaces the token. Check it under a per-owner lock, including when
-- the owner has no row yet. Consuming a step and inserting the checkpoint commit
-- together, so an interrupted request can be retried without extra points.
create function public.write_today_next_step(p_expected uuid, p_step jsonb, p_checkpoint jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  current_step public.today_next_steps;
  quest uuid := coalesce(p_step->>'quest_id', p_checkpoint->>'quest_id')::uuid;
begin
  if owner_id is null or (p_step is not null and p_checkpoint is not null) then return false; end if;

  if quest is not null then
    perform 1 from public.quests where user_id = owner_id and id = quest and type = 'main' and status = 'active' for share;
    if not found then return false; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('today:' || owner_id::text, 0));

  if p_checkpoint is not null and exists (
    select 1 from public.checkpoints where user_id = owner_id and id = p_expected and quest_id = quest
      and source = 'manual' and source_ref = 'next-step:' || p_expected::text
  ) then return true; end if;

  select * into current_step from public.today_next_steps where user_id = owner_id for update;
  if current_step.id is distinct from p_expected then return false; end if;

  if p_step is not null then
    insert into public.today_next_steps(user_id,id,quest_id,title,day)
      values (owner_id,(p_step->>'id')::uuid,quest,p_step->>'title',(p_step->>'day')::date)
      on conflict (user_id) do update set id = excluded.id, quest_id = excluded.quest_id, title = excluded.title, day = excluded.day;
  else
    if p_checkpoint is not null then
      if current_step.id is null or current_step.quest_id is distinct from quest then return false; end if;
      insert into public.checkpoints(id,user_id,quest_id,occurred_at,title,note,minutes,is_milestone,source,source_ref,created_at)
        values (p_expected,owner_id,quest,(p_checkpoint->>'occurred_at')::timestamptz,p_checkpoint->>'title',
          p_checkpoint->>'note',(p_checkpoint->>'minutes')::integer,(p_checkpoint->>'is_milestone')::boolean,
          'manual','next-step:' || p_expected::text,(p_checkpoint->>'created_at')::timestamptz);
    end if;
    delete from public.today_next_steps where user_id = owner_id;
  end if;
  return true;
end $$;
revoke all on function public.write_today_next_step(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.write_today_next_step(uuid,jsonb,jsonb) to authenticated;
