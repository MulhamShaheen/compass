-- A full refresh may remove and reinsert an occurrence. Keep its dismissal
-- keyed by the stable occurrence ID and remove it when the source is disconnected.
create table public.calendar_dismissals (
  user_id uuid not null references auth.users on delete cascade,
  event_id uuid not null,
  source_id uuid not null,
  primary key (user_id, event_id),
  foreign key (source_id, user_id) references public.calendar_sources (id, user_id) on delete cascade
);
create index calendar_dismissals_source on public.calendar_dismissals (source_id);
alter table public.calendar_dismissals enable row level security;
revoke all on public.calendar_dismissals from public, anon, authenticated;
grant select on public.calendar_dismissals to authenticated;
create policy calendar_dismissals_owner_read on public.calendar_dismissals
  for select to authenticated using (user_id = (select auth.uid()));

create function public.calendar_dismiss(p_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Sign in to dismiss a suggestion.'; end if;
  -- Confirmation takes the same lock so a stale tab cannot log a dismissed event.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':' || p_event::text, 0));

  if exists (select 1 from public.calendar_dismissals where user_id = owner_id and event_id = p_event)
    or exists (select 1 from public.checkpoints where user_id = owner_id and source = 'calendar' and source_ref = p_event::text)
    then return; end if;

  insert into public.calendar_dismissals(user_id, event_id, source_id)
    select e.user_id, e.id, e.source_id from public.calendar_events e
    where e.user_id = owner_id and e.id = p_event and e.ends_at <= now();
  if not found then raise exception 'This event is no longer available.'; end if;
end $$;
revoke all on function public.calendar_dismiss(uuid) from public, anon;
grant execute on function public.calendar_dismiss(uuid) to authenticated;

create or replace function public.calendar_confirm(p_event uuid,p_quest uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_event::text, 0));
  if exists (select 1 from public.checkpoints where source = 'calendar' and source_ref = p_event::text and user_id = auth.uid())
    then return; end if;
  if exists (select 1 from public.calendar_dismissals where user_id = auth.uid() and event_id = p_event)
    then raise exception 'This suggestion has already been dismissed.'; end if;
  insert into public.checkpoints(user_id,quest_id,title,occurred_at,minutes,source,source_ref)
    select e.user_id,q.id,left(e.title,160),e.starts_at,
      least(1440, greatest(0, round(extract(epoch from e.ends_at-e.starts_at)/60)))::integer,'calendar',e.id::text
    from public.calendar_events e join public.quests q on q.id = p_quest and q.user_id = e.user_id
    where e.id = p_event and e.user_id = auth.uid() and e.ends_at <= now() and q.status = 'active' and q.type <> 'system'
      and exists (select 1 from public.calendar_rules r where r.user_id = e.user_id
        and strpos(lower(e.title), lower(r.match_text)) > 0 and (r.quest_id = q.id or r.attr in (q.primary_attr,q.secondary_attr)))
    on conflict (user_id,source_ref) where source = 'calendar' and source_ref is not null do nothing;
  if not found and not exists(select 1 from public.checkpoints where source = 'calendar' and source_ref = p_event::text and user_id = auth.uid()) then
    raise exception 'This event is no longer available for that quest.';
  end if;
end $$;
