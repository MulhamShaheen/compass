-- Keep the expected diary text in the request body. Compare it while the
-- owner's row is locked so a stale editor cannot overwrite a newer version.
create function public.write_journal_entry(p_id uuid, p_expected text, p_body text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  entry public.journal_entries;
begin
  if p_body is not null and length(trim(p_body)) not between 1 and 8000 then return false; end if;
  select * into entry from public.journal_entries
    where id = p_id and user_id = (select auth.uid()) for update;
  if not found or entry.body is distinct from p_expected then return false; end if;

  if entry.prompt = 'What will next week be about?' and exists (
    select 1 from public.weekly_reviews where user_id = entry.user_id and completed_at = entry.created_at
  ) then return false; end if;

  if p_body is null then
    delete from public.journal_entries where id = entry.id and user_id = entry.user_id;
  else
    update public.journal_entries set body = p_body where id = entry.id and user_id = entry.user_id;
  end if;
  return true;
end $$;
revoke all on function public.write_journal_entry(uuid,text,text) from public, anon;
grant execute on function public.write_journal_entry(uuid,text,text) to authenticated;
