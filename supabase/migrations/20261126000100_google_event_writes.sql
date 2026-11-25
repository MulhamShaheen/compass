-- This connection is independent of the read-only Google calendar source.
create table compass_private.google_event_connections (
  user_id uuid primary key references auth.users on delete cascade,
  calendar_id text not null,
  secret_id uuid not null
);
create trigger google_event_secret_cleanup after delete on compass_private.google_event_connections
for each row execute function compass_private.delete_calendar_secret();

create table compass_private.google_event_publications (
  user_id uuid not null references compass_private.google_event_connections on delete cascade,
  event_id uuid not null,
  remote_id uuid not null default gen_random_uuid(),
  published boolean not null default false,
  operation_id uuid,
  locked_until timestamptz,
  primary key (user_id, event_id),
  unique (remote_id),
  constraint google_event_publication_requires_event foreign key (event_id, user_id)
    references public.compass_events(id,user_id) deferrable initially deferred
);

create function public.google_events_status(p_user uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'connected', exists(select 1 from compass_private.google_event_connections where user_id = p_user),
    'publishedIds', coalesce((select jsonb_agg(event_id) from compass_private.google_event_publications where user_id = p_user), '[]'::jsonb)
  )
$$;

create function public.google_events_connect(p_user uuid, p_calendar text, p_secret text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('google-events:' || p_user::text, 0));
  if exists(select 1 from compass_private.google_event_connections where user_id = p_user) then return false; end if;
  insert into compass_private.google_event_connections(user_id,calendar_id,secret_id)
    values (p_user, p_calendar, vault.create_secret(p_secret));
  return true;
end $$;

create function public.google_events_disconnect(p_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('google-events:' || p_user::text, 0));
  if exists(select 1 from compass_private.google_event_publications where user_id = p_user and locked_until > now()) then return false; end if;
  delete from compass_private.google_event_connections where user_id = p_user;
  return true;
end $$;

-- Reserve the remote id before calling Google. Retain it after an ambiguous response,
-- so a retry updates the same event. Unpublishing releases the id for a later republish.
create function public.google_events_begin(p_user uuid, p_event uuid, p_publish boolean)
returns table (calendar_id text, secret text, remote_id uuid, operation_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  connection compass_private.google_event_connections;
  publication compass_private.google_event_publications;
  operation uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtextextended('google-events:' || p_user::text, 0));
  select * into connection from compass_private.google_event_connections where user_id = p_user;
  if not found or not exists(select 1 from public.compass_events where id = p_event and user_id = p_user) then return; end if;
  select * into publication from compass_private.google_event_publications where user_id = p_user and event_id = p_event;
  if publication.locked_until > now() then return; end if;
  if publication.remote_id is null and not p_publish then return; end if;
  insert into compass_private.google_event_publications as target(user_id,event_id,operation_id,locked_until)
    values(p_user,p_event,operation,now()+interval '2 minutes')
    on conflict (user_id,event_id) do update set operation_id = operation, locked_until = excluded.locked_until
    returning target.* into publication;
  return query select connection.calendar_id, s.decrypted_secret, publication.remote_id, operation
    from vault.decrypted_secrets s where s.id = connection.secret_id;
end $$;

create function public.google_events_finish(p_user uuid, p_event uuid, p_operation uuid, p_publish boolean, p_ok boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_ok and not p_publish then
    delete from compass_private.google_event_publications where user_id = p_user and event_id = p_event and operation_id = p_operation;
  else
    update compass_private.google_event_publications
      set operation_id = null, locked_until = null, published = published or p_ok
      where user_id = p_user and event_id = p_event and operation_id = p_operation;
  end if;
  return found;
end $$;

revoke all on function public.google_events_status(uuid), public.google_events_connect(uuid,text,text),
  public.google_events_disconnect(uuid), public.google_events_begin(uuid,uuid,boolean),
  public.google_events_finish(uuid,uuid,uuid,boolean,boolean) from public, anon, authenticated;
grant execute on function public.google_events_status(uuid), public.google_events_connect(uuid,text,text),
  public.google_events_disconnect(uuid), public.google_events_begin(uuid,uuid,boolean),
  public.google_events_finish(uuid,uuid,uuid,boolean,boolean) to service_role;
