-- M0: profiles. One row per user, created when the auth user is created.
-- Row Level Security: a user can only see and change their own row.

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  character_name text,
  true_north text,
  timezone text not null default 'UTC',
  waking_start time default '07:00',
  waking_end time default '23:00',
  quiet_mode boolean not null default false,
  prologue_completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own row" on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.profiles to authenticated;

-- Create the profile row on sign-up. security definer so it can insert past RLS;
-- an empty search_path keeps it from resolving objects the caller controls.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
