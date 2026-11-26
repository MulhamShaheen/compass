-- Compare only the objects owned by the two calendar migrations.
with tables as (
  select c.oid, n.nspname || '.' || c.relname as name, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where (n.nspname = 'public' and c.relname in ('calendar_sources','calendar_events','calendar_rules','calendar_dismissals'))
     or (n.nspname = 'compass_private' and c.relname = 'calendar_credentials')
), functions as (
  select p.oid, n.nspname || '.' || p.proname as name
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname = 'public' and p.proname in (
    'calendar_connect','calendar_sync_read','calendar_sync_apply','calendar_confirm','calendar_clear','calendar_dismiss'
  )) or (n.nspname = 'compass_private' and p.proname = 'delete_calendar_secret')
)
select 'table ' || name as object, jsonb_build_array(relrowsecurity, relforcerowsecurity,
  (select jsonb_agg(has_table_privilege(role_name, tables.oid, permission) order by role_name, permission)
   from unnest(array['anon','authenticated']) as roles(role_name)
   cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as permissions(permission)),
  (select jsonb_agg(jsonb_build_array(attname, format_type(atttypid, atttypmod), attnotnull, pg_get_expr(adbin, adrelid)) order by attname)
   from pg_attribute left join pg_attrdef on adrelid = attrelid and adnum = attnum
   where attrelid = tables.oid and attnum > 0 and not attisdropped),
  (select jsonb_agg(pg_get_constraintdef(oid) order by conname) from pg_constraint where conrelid = tables.oid),
  (select jsonb_agg(pg_get_indexdef(indexrelid) order by pg_get_indexdef(indexrelid)) from pg_index where indrelid = tables.oid),
  (select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger where tgrelid = tables.oid and not tgisinternal),
  (select jsonb_agg(jsonb_build_array(polname, polcmd, polpermissive, polroles = array['authenticated'::regrole::oid], pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)) order by polname) from pg_policy where polrelid = tables.oid)
) as definition from tables
union all
select 'function ' || name || '(' || pg_get_function_identity_arguments(oid) || ')',
  jsonb_build_array(pg_get_functiondef(oid), has_function_privilege('anon', oid, 'execute'),
    has_function_privilege('authenticated', oid, 'execute'), has_function_privilege('service_role', oid, 'execute'))
from functions
union all
select 'profile column ' || attname, jsonb_build_array(format_type(atttypid, atttypmod), attnotnull, pg_get_expr(adbin, adrelid))
from pg_attribute left join pg_attrdef on adrelid = attrelid and adnum = attnum
where attrelid = 'public.profiles'::regclass and attname in ('waking_start','waking_end') and not attisdropped
union all
select 'checkpoint index', to_jsonb(pg_get_indexdef(to_regclass('public.calendar_checkpoint_once')))
union all
select 'private schema', jsonb_build_array(
  has_schema_privilege('anon', oid, 'USAGE'), has_schema_privilege('authenticated', oid, 'USAGE')
) from pg_namespace where nspname = 'compass_private'
order by object;
