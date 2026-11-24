create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;
create schema if not exists compass_private;
revoke all on schema compass_private from public, anon, authenticated;

create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('ics','google')),
  label text not null check (length(btrim(label)) between 1 and 160),
  last_synced_at timestamptz,
  unique (id, user_id)
);
create index calendar_sources_owner on public.calendar_sources(user_id);
create unique index calendar_google_primary on public.calendar_sources(user_id) where kind = 'google';

create table compass_private.calendar_credentials (
  source_id uuid primary key references public.calendar_sources on delete cascade,
  secret_id uuid not null,
  feed_hash bytea,
  sync_cursor text,
  version bigint not null default 0
);
-- Source removal (including account deletion) also destroys the Vault entry.
create function compass_private.delete_calendar_secret() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end $$;
create trigger calendar_secret_cleanup after delete on compass_private.calendar_credentials
for each row execute function compass_private.delete_calendar_secret();

create table public.calendar_events (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  source_id uuid not null,
  external_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  unique(source_id, external_id),
  foreign key (source_id, user_id) references public.calendar_sources (id, user_id) on delete cascade
);
create index calendar_events_owner on public.calendar_events(user_id, starts_at);

create table public.calendar_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  match_text text not null check (length(btrim(match_text)) between 1 and 160),
  quest_id uuid,
  attr public.attribute,
  check (num_nonnulls(quest_id, attr) = 1),
  foreign key (quest_id, user_id) references public.quests(id, user_id) on delete cascade
);
create index calendar_rules_owner on public.calendar_rules(user_id);
create unique index calendar_checkpoint_once on public.checkpoints(user_id, source_ref)
  where source = 'calendar' and source_ref is not null;

alter table public.calendar_sources enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_rules enable row level security;
revoke all on public.calendar_sources, public.calendar_events, public.calendar_rules from anon, authenticated;
grant select, delete on public.calendar_sources to authenticated;
grant select on public.calendar_events to authenticated;
grant select, insert, delete on public.calendar_rules to authenticated;
grant select on public.calendar_sources to service_role;

create policy calendar_sources_owner_read on public.calendar_sources for select to authenticated using (user_id = (select auth.uid()));
create policy calendar_sources_owner_delete on public.calendar_sources for delete to authenticated using (user_id = (select auth.uid()));
create policy calendar_events_owner_read on public.calendar_events for select to authenticated using (user_id = (select auth.uid()));
create policy calendar_rules_owner on public.calendar_rules for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- These provider operations are callable only by the server-side service role.
create function public.calendar_connect(p_user uuid, p_kind text, p_name text, p_secret text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  sid uuid;
  vault_id uuid;
  feed bytea;
begin
  if p_secret is null or length(p_secret) = 0 then raise exception 'Missing calendar credential'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if p_kind = 'ics' then feed := sha256(convert_to(p_secret, 'UTF8')); end if;
  select s.id,c.secret_id into sid,vault_id from public.calendar_sources s
    join compass_private.calendar_credentials c on c.source_id = s.id
    where s.user_id = p_user and s.kind = p_kind and (p_kind = 'google' or c.feed_hash = feed)
    for update of s,c;
  if sid is null then
    insert into public.calendar_sources(user_id,kind,label) values(p_user,p_kind,p_name) returning id into sid;
    insert into compass_private.calendar_credentials(source_id,secret_id,feed_hash)
      values(sid,vault.create_secret(p_secret),feed);
  elsif p_kind = 'google' then
    perform vault.update_secret(vault_id,p_secret);
    update compass_private.calendar_credentials set sync_cursor = null, version = version + 1 where source_id = sid;
    update public.calendar_sources set label = p_name, last_synced_at = null where id = sid;
    delete from public.calendar_events where source_id = sid;
  end if;
  return sid;
end $$;

create function public.calendar_sync_read(p_user uuid, p_id uuid)
returns table(id uuid,kind text,name text,"lastSyncedAt" timestamptz,secret text,cursor_value text,version bigint,timezone text)
language sql stable security definer set search_path = '' as $$
  select s.id,s.kind,s.label,s.last_synced_at,v.decrypted_secret,c.sync_cursor,c.version,p.timezone
  from public.calendar_sources s join compass_private.calendar_credentials c on c.source_id = s.id
  join vault.decrypted_secrets v on v.id = c.secret_id join public.profiles p on p.user_id = s.user_id
  where s.id = p_id and s.user_id = p_user;
$$;

create function public.calendar_sync_apply(p_user uuid,p_id uuid,p_version bigint,p_events jsonb,
  p_deleted text[],p_replace boolean,p_cursor text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- Acquire locks in the same order as reconnect and disconnect. The version
  -- makes an older concurrent sync harmless, including after reauthorization.
  perform 1 from public.calendar_sources where id = p_id and user_id = p_user for update;
  if not found then return false; end if;
  update compass_private.calendar_credentials set version = version + 1, sync_cursor = p_cursor
    where source_id = p_id and version = p_version;
  if not found then return false; end if;
  if p_replace then
    delete from public.calendar_events where source_id = p_id;
  else
    delete from public.calendar_events where source_id = p_id and external_id = any(p_deleted);
  end if;
  insert into public.calendar_events(id,user_id,source_id,external_id,title,starts_at,ends_at)
    select r.id,p_user,p_id,r."externalId",r.title,r.start_time,r.end_time
      from jsonb_to_recordset(p_events) as r(id uuid,"externalId" text,title text,start_time timestamptz,end_time timestamptz)
    on conflict (source_id,external_id) do update set title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at;
  update public.calendar_sources set last_synced_at = now() where id = p_id;
  return true;
end $$;

revoke all on function public.calendar_connect(uuid,text,text,text), public.calendar_sync_read(uuid,uuid),
  public.calendar_sync_apply(uuid,uuid,bigint,jsonb,text[],boolean,text) from public, anon, authenticated;
grant execute on function public.calendar_connect(uuid,text,text,text), public.calendar_sync_read(uuid,uuid),
  public.calendar_sync_apply(uuid,uuid,bigint,jsonb,text[],boolean,text) to service_role;

-- The client supplies only identities. The verified owner's event and matching
-- rule determine the checkpoint details. Both retries and double clicks are safe.
create function public.calendar_confirm(p_event uuid,p_quest uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.checkpoints where source = 'calendar' and source_ref = p_event::text and user_id = auth.uid())
    then return; end if;
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
revoke all on function public.calendar_confirm(uuid,uuid) from public, anon;
grant execute on function public.calendar_confirm(uuid,uuid) to authenticated;

create function public.calendar_clear() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.calendar_sources where user_id = auth.uid();
  delete from public.calendar_rules where user_id = auth.uid();
  update public.profiles set waking_start = '07:00', waking_end = '23:00' where user_id = auth.uid();
end $$;
revoke all on function public.calendar_clear() from public, anon;
grant execute on function public.calendar_clear() to authenticated;
