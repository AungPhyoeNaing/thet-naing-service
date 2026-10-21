-- Install in a NEW Supabase project dedicated to Thet Naing Service.
-- No clinic tables, credentials, policies or records are reused.
begin;
create table if not exists public.workshop_staff (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.workshop_staff enable row level security;
drop policy if exists staff_self on public.workshop_staff;
create policy staff_self on public.workshop_staff for select to authenticated using (user_id = auth.uid());
revoke all on public.workshop_staff from anon, authenticated;
grant select on public.workshop_staff to authenticated;

create or replace function public.is_workshop_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workshop_staff where user_id = auth.uid());
$$;
revoke all on function public.is_workshop_staff() from public, anon;
grant execute on function public.is_workshop_staff() to authenticated;

create table if not exists public.workshop_state (
  id text primary key check (id = 'main'),
  revision bigint not null default 0 check (revision >= 0),
  data jsonb not null check (
    data->>'version' = '1' and jsonb_typeof(data->'jobs') = 'array'
    and jsonb_typeof(data->'parts') = 'array' and jsonb_typeof(data->'technicians') = 'array'
    and jsonb_typeof(data->'demo') = 'boolean'
  ),
  updated_at timestamptz not null default now()
);
insert into public.workshop_state(id, data) values ('main', '{"version":1,"revision":0,"demo":false,"jobs":[],"parts":[],"technicians":[]}') on conflict do nothing;
alter table public.workshop_state enable row level security;
drop policy if exists workshop_read on public.workshop_state;
create policy workshop_read on public.workshop_state for select to authenticated using (public.is_workshop_staff());
revoke all on public.workshop_state from anon, authenticated;
grant select on public.workshop_state to authenticated;

-- One transaction covers job changes, estimate approval, stock issue and payments.
-- No client can update rows directly. A stale revision never overwrites another save.
create or replace function public.save_workshop(new_data jsonb, expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_revision bigint; next_data jsonb;
begin
  if not public.is_workshop_staff() then raise exception 'Staff access required'; end if;
  select revision into current_revision from public.workshop_state where id = 'main' for update;
  if current_revision is null then raise exception 'Workshop not initialized'; end if;
  if expected_revision is distinct from current_revision then raise exception 'Workshop revision conflict'; end if;
  if new_data is null or octet_length(new_data::text) > 26214400
    or new_data->>'version' is distinct from '1'
    or jsonb_typeof(new_data->'jobs') is distinct from 'array'
    or jsonb_typeof(new_data->'parts') is distinct from 'array'
    or jsonb_typeof(new_data->'technicians') is distinct from 'array'
    or jsonb_typeof(new_data->'demo') is distinct from 'boolean'
  then raise exception 'Invalid workshop data'; end if;
  next_data := jsonb_set(new_data, '{revision}', to_jsonb(current_revision + 1), true);
  update public.workshop_state set data = next_data, revision = current_revision + 1, updated_at = now() where id = 'main';
  return next_data;
end;
$$;
revoke all on function public.save_workshop(jsonb,bigint) from public, anon;
grant execute on function public.save_workshop(jsonb,bigint) to authenticated;
commit;

-- After creating a user in Supabase Auth, approve them using SQL Editor:
-- insert into public.workshop_staff(user_id)
-- select id from auth.users where email = 'your-staff@example.com'
-- on conflict do nothing;
-- Disable public sign-ups in the Supabase Auth settings.
