-- Run in the Supabase project dedicated to Thet Naing Service.
-- Rerunnable migration: existing accounts default to staff. Bootstrap Admin below.
begin;
create table if not exists public.workshop_staff (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.workshop_staff add column if not exists role text not null default 'staff' check (role in ('admin','staff'));
alter table public.workshop_staff add column if not exists active boolean not null default true;
alter table public.workshop_staff add column if not exists display_name text not null default '' check (length(display_name) <= 120);
alter table public.workshop_staff add column if not exists technician_name text not null default '' check (length(technician_name) <= 80);
alter table public.workshop_staff enable row level security;
drop policy if exists staff_self on public.workshop_staff;
create policy staff_self on public.workshop_staff for select to authenticated using (user_id = auth.uid());
revoke all on public.workshop_staff from public, anon, authenticated;
grant select on public.workshop_staff to authenticated;

create or replace function public.is_workshop_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workshop_staff where user_id = auth.uid() and active);
$$;
create or replace function public.is_workshop_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workshop_staff where user_id = auth.uid() and active and role = 'admin');
$$;
revoke all on function public.is_workshop_staff(), public.is_workshop_admin() from public, anon;
grant execute on function public.is_workshop_staff(), public.is_workshop_admin() to authenticated;

create table if not exists public.workshop_state (
  id text primary key check (id = 'main'), revision bigint not null default 0 check (revision >= 0),
  data jsonb not null check (data->>'version' = '1' and jsonb_typeof(data->'jobs') = 'array'
    and jsonb_typeof(data->'parts') = 'array' and jsonb_typeof(data->'technicians') = 'array'
    and jsonb_typeof(data->'demo') = 'boolean'), updated_at timestamptz not null default now()
);
insert into public.workshop_state(id, data) values ('main', '{"version":1,"revision":0,"demo":false,"jobs":[],"parts":[],"technicians":[]}') on conflict do nothing;
alter table public.workshop_state enable row level security;
drop policy if exists workshop_read on public.workshop_state;
create policy workshop_read on public.workshop_state for select to authenticated using (public.is_workshop_staff());
revoke all on public.workshop_state from public, anon, authenticated;
grant select on public.workshop_state to authenticated;

-- Independent append-only audit survives restores. No client writes are granted.
create table if not exists public.workshop_audit (
  id bigint generated always as identity primary key, at timestamptz not null default now(),
  actor_id uuid not null, actor_name text not null, actor_role text not null,
  action text not null, revision bigint, details jsonb not null
);
alter table public.workshop_audit enable row level security;
drop policy if exists admin_audit on public.workshop_audit;
create policy admin_audit on public.workshop_audit for select to authenticated using (public.is_workshop_admin());
revoke all on public.workshop_audit from public, anon, authenticated;
grant select on public.workshop_audit to authenticated;

-- Private helper, callable only through the checked entry points.
create or replace function public.commit_workshop(next_state jsonb, old_state jsonb, current_revision bigint, action_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor public.workshop_staff; stamped_jobs jsonb := '[]'; j jsonb; old_job jsonb; history jsonb; event jsonb;
begin
  select * into actor from public.workshop_staff where user_id = auth.uid() and active for share;
  if actor.user_id is null then raise exception 'Staff access required'; end if;
  if next_state is null or octet_length(next_state::text) > 26214400
    or next_state->>'version' is distinct from '1' or jsonb_typeof(next_state->'jobs') is distinct from 'array'
    or jsonb_typeof(next_state->'parts') is distinct from 'array' or jsonb_typeof(next_state->'technicians') is distinct from 'array'
    or jsonb_typeof(next_state->'demo') is distinct from 'boolean' then raise exception 'Invalid workshop data'; end if;
  for j in select value from jsonb_array_elements(next_state->'jobs') loop
    select value into old_job from jsonb_array_elements(old_state->'jobs') where value->>'id' = j->>'id';
    history := '[]';
    for event in select value from jsonb_array_elements(coalesce(j->'history','[]')) loop
      if action_name <> 'admin_restore' and not exists (select 1 from jsonb_array_elements(coalesce(old_job->'history','[]')) h where h->>'id' = event->>'id') then
        event := event || jsonb_build_object('actorId',actor.user_id,'actorName',coalesce(nullif(actor.display_name,''),actor.role),'at',now());
      end if;
      history := history || jsonb_build_array(event);
    end loop;
    stamped_jobs := stamped_jobs || jsonb_build_array(jsonb_set(j,'{history}',history));
  end loop;
  next_state := next_state || jsonb_build_object('jobs',stamped_jobs,'revision',current_revision + 1);
  update public.workshop_state set data = next_state, revision = current_revision + 1, updated_at = now() where id = 'main';
  insert into public.workshop_audit(actor_id,actor_name,actor_role,action,revision,details)
  values (actor.user_id,coalesce(nullif(actor.display_name,''),actor.role),actor.role,action_name,current_revision + 1,
    jsonb_build_object('jobs',coalesce((select jsonb_agg(jsonb_build_object('before',b.value,'after',a.value))
      from jsonb_array_elements(old_state->'jobs') b full join jsonb_array_elements(next_state->'jobs') a
      on b.value->>'id' = a.value->>'id' where b.value is distinct from a.value),'[]'::jsonb),
      'parts',case when old_state->'parts' is distinct from next_state->'parts' then jsonb_build_object('before',old_state->'parts','after',next_state->'parts') else null end,
      'technicians',case when old_state->'technicians' is distinct from next_state->'technicians' then jsonb_build_object('before',old_state->'technicians','after',next_state->'technicians') else null end,
      'demo',jsonb_build_object('before',old_state->'demo','after',next_state->'demo')));
  return next_state;
end;
$$;
revoke all on function public.commit_workshop(jsonb,jsonb,bigint,text) from public, anon, authenticated;

-- Whole-workshop saves (including restores) are ADMIN ONLY.
create or replace function public.save_workshop(new_data jsonb, expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_revision bigint; old_state jsonb; actor public.workshop_staff;
begin
  select * into actor from public.workshop_staff where user_id = auth.uid() and active for share;
  if actor.user_id is null then raise exception 'Staff access required'; end if;
  if actor.role <> 'admin' then raise exception 'Admin access required for this action.'; end if;
  select revision,data into current_revision,old_state from public.workshop_state where id = 'main' for update;
  if current_revision is null then raise exception 'Workshop not initialized'; end if;
  if expected_revision is distinct from current_revision then raise exception 'Workshop revision conflict'; end if;
  return public.commit_workshop(new_data,old_state,current_revision,'admin_save');
end;
$$;
revoke all on function public.save_workshop(jsonb,bigint) from public, anon;
grant execute on function public.save_workshop(jsonb,bigint) to authenticated;

-- A restore retains original authors/timestamps; its actor is recorded separately.
create or replace function public.restore_workshop(new_data jsonb, expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_revision bigint; old_state jsonb; actor public.workshop_staff;
begin
  select * into actor from public.workshop_staff where user_id = auth.uid() and active for share;
  if actor.user_id is null or actor.role <> 'admin' then raise exception 'Admin access required for this action.'; end if;
  select revision,data into current_revision,old_state from public.workshop_state where id = 'main' for update;
  if current_revision is null then raise exception 'Workshop not initialized'; end if;
  if expected_revision is distinct from current_revision then raise exception 'Workshop revision conflict'; end if;
  return public.commit_workshop(new_data,old_state,current_revision,'admin_restore');
end;
$$;
revoke all on function public.restore_workshop(jsonb,bigint) from public, anon;
grant execute on function public.restore_workshop(jsonb,bigint) to authenticated;

-- Each command builds the change from the server's locked state.
-- Extra payload fields (payments, roles, stock, history...) are never merged.
create or replace function public.staff_workshop_action(action text, payload jsonb, expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor public.workshop_staff; current_revision bigint; old_state jsonb; next_state jsonb;
  j jsonb; line jsonb; job_index integer; next_code bigint; k text;
  next_status text; event_text text; check_index integer; amount numeric := 0; line_ids text[] := '{}';
begin
  select * into actor from public.workshop_staff where user_id = auth.uid() and active for share;
  if actor.user_id is null then raise exception 'Staff access required'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 1000000 then raise exception 'Invalid repair action'; end if;
  select revision,data into current_revision,old_state from public.workshop_state where id = 'main' for update;
  if current_revision is null then raise exception 'Workshop not initialized'; end if;
  if expected_revision is distinct from current_revision then raise exception 'Workshop revision conflict'; end if;
  next_state := old_state;
  if action = 'create_job' then
    if jsonb_array_length(old_state->'jobs') >= 50000 then raise exception 'Workshop job limit reached'; end if;
    foreach k in array array['id','customer','phone','address','category','equipment','brand','serial','issue','serviceType','priority','technician','dueDate'] loop
      if jsonb_typeof(payload->k) is distinct from 'string' or length(payload->>k) > 3000 then raise exception 'Invalid repair details'; end if;
    end loop;
    if length(payload->>'id') not between 1 and 80 or exists (select 1 from jsonb_array_elements(old_state->'jobs') v where v->>'id' = payload->>'id') then raise exception 'Invalid repair ID'; end if;
    if length(btrim(payload->>'customer')) = 0 or length(btrim(payload->>'phone')) = 0 or length(btrim(payload->>'equipment')) = 0 or length(btrim(payload->>'issue')) = 0
      or payload->>'category' not in ('Home appliance','Industrial machine') or payload->>'serviceType' not in ('Workshop drop-off','On-site visit') or payload->>'priority' not in ('Normal','High','Urgent') then raise exception 'Invalid repair details'; end if;
    if payload->>'dueDate' <> '' then perform (payload->>'dueDate')::date; if payload->>'dueDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid target date'; end if; end if;
    if payload->>'technician' <> '' and not (old_state->'technicians' ? (payload->>'technician')) then raise exception 'Unknown technician'; end if;
    select greatest(1000,coalesce(max(substring(v->>'code' from '^TN-([0-9]+)$')::bigint),1000)) + 1 into next_code from jsonb_array_elements(old_state->'jobs') v;
    j := jsonb_build_object('id',payload->>'id','code','TN-' || next_code,'status','Received','createdAt',now(),'diagnosis','','lines','[]'::jsonb,'estimateStatus','Draft','paid',0,'checks','[false,false,false]'::jsonb,'history','[]'::jsonb);
    foreach k in array array['customer','phone','address','category','equipment','brand','serial','issue','serviceType','priority','technician','dueDate'] loop
      j := j || jsonb_build_object(k,btrim(payload->>k));
    end loop;
    event_text := 'Service request received.';
  else
    select (ordinality - 1)::integer,value into job_index,j from jsonb_array_elements(old_state->'jobs') with ordinality where value->>'id' = payload->>'job_id';
    if j is null then raise exception 'Job no longer exists.'; end if;
    if action <> 'add_note' and j->>'status' in ('Collected','Cancelled') then raise exception 'This job is closed.'; end if;
    case action
      when 'update_plan' then
        foreach k in array array['technician','dueDate','diagnosis'] loop
          if jsonb_typeof(payload->k) is distinct from 'string' or length(payload->>k) > 5000 then raise exception 'Invalid repair plan'; end if;
        end loop;
        if payload->>'dueDate' <> '' then perform (payload->>'dueDate')::date; if payload->>'dueDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid target date'; end if; end if;
        if payload->>'technician' <> '' and not (old_state->'technicians' ? (payload->>'technician')) then raise exception 'Unknown technician'; end if;
        j := j || jsonb_build_object('technician',payload->>'technician','dueDate',payload->>'dueDate','diagnosis',btrim(payload->>'diagnosis'));
        event_text := 'Repair details updated.';
      when 'add_note' then
        if jsonb_typeof(payload->'text') is distinct from 'string' or length(btrim(payload->>'text')) not between 1 and 3000 then raise exception 'Enter a workshop note.'; end if;
        event_text := btrim(payload->>'text');
      when 'set_status' then
        next_status := payload->>'status';
        if next_status is null or next_status not in ('Diagnosing','Awaiting approval','Waiting for parts','In repair','Ready to collect') then raise exception 'Admin access required for this action.'; end if;
        if j->>'status' = 'Ready to collect' then raise exception 'This job is ready for collection.'; end if;
        if next_status in ('In repair','Ready to collect') and j->>'estimateStatus' <> 'Approved' then raise exception 'Waiting for Admin to finalize charges.'; end if;
        if next_status = 'Ready to collect' and j->'checks' <> '[true,true,true]'::jsonb then raise exception 'Complete all three quality checks first.'; end if;
        j := jsonb_set(j,'{status}',to_jsonb(next_status)); event_text := 'Status changed to ' || lower(next_status) || '.';
      when 'set_check' then
        if j->>'status' not in ('In repair','Waiting for parts') or j->>'estimateStatus' <> 'Approved' then raise exception 'Start an approved repair before recording quality checks.'; end if;
        if jsonb_typeof(payload->'index') is distinct from 'number' or payload->>'index' !~ '^[0-2]$' or jsonb_typeof(payload->'checked') is distinct from 'boolean' then raise exception 'Invalid quality check'; end if;
        check_index := (payload->>'index')::integer;
        j := jsonb_set(j,array['checks',check_index::text],payload->'checked');
        event_text := case when (payload->>'checked')::boolean then 'Completed check: ' else 'Reopened check: ' end || (array['Repair completed and equipment cleaned','Safety and operational tests passed','Accessories and customer items accounted for'])[check_index + 1];
      when 'attach_photo' then
        line := payload->'photo';
        if jsonb_typeof(line) is distinct from 'object' or jsonb_array_length(coalesce(j->'photos','[]')) >= 8 then raise exception 'Photo limit reached.'; end if;
        foreach k in array array['id','name','caption','stage','storagePath','uploadedBy','createdAt'] loop
          if jsonb_typeof(line->k) is distinct from 'string' then raise exception 'Invalid photo'; end if;
        end loop;
        if line->>'id' !~ '^[a-zA-Z0-9-]{1,80}$' or length(line->>'name') > 200 or length(line->>'caption') > 300
          or line->>'stage' not in ('Intake','Diagnosis','Repair','Quality check')
          or line->>'uploadedBy' <> auth.uid()::text
          or line->>'storagePath' <> 'jobs/' || (j->>'id') || '/' || auth.uid()::text || '/' || (line->>'id') || '.jpg'
          or exists (select 1 from jsonb_array_elements(coalesce(j->'photos','[]')) p where p->>'id' = line->>'id')
          or not exists (select 1 from storage.objects o where o.bucket_id = 'workshop-photos' and o.name = line->>'storagePath') then raise exception 'Invalid photo'; end if;
        line := jsonb_build_object('id',line->>'id','name',line->>'name','caption',line->>'caption','stage',line->>'stage','storagePath',line->>'storagePath','uploadedBy',auth.uid(),'createdAt',now());
        j := jsonb_set(j,'{photos}',coalesce(j->'photos','[]') || jsonb_build_array(line));
        event_text := 'Repair photo added.';
      when 'remove_photo' then
        select value into line from jsonb_array_elements(coalesce(j->'photos','[]')) where value->>'id' = payload->>'photo_id';
        if line is null or (actor.role <> 'admin' and line->>'uploadedBy' is distinct from auth.uid()::text) then raise exception 'You can only remove your own repair photos.'; end if;
        j := jsonb_set(j,'{photos}',coalesce((select jsonb_agg(value) from jsonb_array_elements(j->'photos') where value->>'id' <> payload->>'photo_id'),'[]'));
        event_text := 'Repair photo removed.';
      when 'draft_charges' then
        if j->>'estimateStatus' = 'Approved' or j->>'status' = 'Ready to collect' then raise exception 'Admin access required for this action.'; end if;
        if jsonb_typeof(payload->'lines') is distinct from 'array' then raise exception 'Invalid draft charges'; end if;
        if jsonb_array_length(payload->'lines') > 500 then raise exception 'Too many charge items'; end if;
        for line in select value from jsonb_array_elements(payload->'lines') loop
          foreach k in array array['id','description'] loop
            if jsonb_typeof(line->k) is distinct from 'string' or length(btrim(line->>k)) not between 1 and 200 then raise exception 'Invalid draft charges'; end if;
          end loop;
          if line->>'id' = any(line_ids) then raise exception 'Duplicate charge item'; end if;
          line_ids := array_append(line_ids,line->>'id');
          foreach k in array array['quantity','unitPrice'] loop
            if jsonb_typeof(line->k) is distinct from 'number' or line->>k !~ '^\d+$' or (line->>k)::numeric > 9007199254740991 then raise exception 'Invalid draft charges'; end if;
          end loop;
          if (line->>'quantity')::numeric < 1 then raise exception 'Invalid draft charges'; end if;
          if line ? 'partId' and (jsonb_typeof(line->'partId') is distinct from 'string' or not exists (select 1 from jsonb_array_elements(old_state->'parts') p where p->>'id' = line->>'partId')) then raise exception 'Unknown inventory part'; end if;
          amount := amount + (line->>'quantity')::numeric * (line->>'unitPrice')::numeric;
          if amount > 9007199254740991 then raise exception 'Draft total is too large'; end if;
        end loop;
        j := j || jsonb_build_object('estimateStatus','Draft','lines',coalesce((select jsonb_agg(jsonb_build_object('id',v->'id','description',v->'description','quantity',v->'quantity','unitPrice',v->'unitPrice') || case when v ? 'partId' then jsonb_build_object('partId',v->'partId') else '{}'::jsonb end) from jsonb_array_elements(payload->'lines') v),'[]'::jsonb));
        event_text := 'Draft charges prepared for Admin.';
      else raise exception 'Admin access required for this action.';
    end case;
  end if;
  if jsonb_array_length(j->'history') >= 10000 then raise exception 'Repair history limit reached'; end if;
  j := jsonb_set(j,'{history}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'at',now(),'text',event_text)) || (j->'history'));
  if action = 'create_job' then next_state := jsonb_set(next_state,'{jobs}',jsonb_build_array(j) || (next_state->'jobs'));
  else next_state := jsonb_set(next_state,array['jobs',job_index::text],j); end if;
  return public.commit_workshop(next_state,old_state,current_revision,action);
end;
$$;
revoke all on function public.staff_workshop_action(text,jsonb,bigint) from public, anon;
grant execute on function public.staff_workshop_action(text,jsonb,bigint) to authenticated;

create or replace function public.list_workshop_members()
returns table(user_id uuid,email text,role text,active boolean,display_name text,technician_name text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_workshop_admin() then raise exception 'Admin access required for this action.'; end if;
  return query select s.user_id,u.email::text,s.role,s.active,s.display_name,s.technician_name from public.workshop_staff s join auth.users u on u.id = s.user_id order by s.display_name,u.email;
end;
$$;
revoke all on function public.list_workshop_members() from public, anon;
grant execute on function public.list_workshop_members() to authenticated;

create or replace function public.manage_workshop_member(member_email text, member_role text, member_active boolean, member_name text, member_technician text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_id uuid; before_member jsonb; acting_name text;
begin
  -- Serialize edits to protect the last active admin.
  lock table public.workshop_staff in exclusive mode;
  if not public.is_workshop_admin() then raise exception 'Admin access required for this action.'; end if;
  select display_name into acting_name from public.workshop_staff where user_id = auth.uid();
  if member_role is null or member_role not in ('admin','staff') or member_active is null or member_name is null or length(btrim(member_name)) not between 1 and 120 or member_technician is null or length(member_technician) > 80 then raise exception 'Invalid account details'; end if;
  select id into target_id from auth.users where lower(email) = lower(btrim(member_email));
  if target_id is null then raise exception 'Create this account in Supabase Auth first.'; end if;
  if member_technician <> '' and not exists (select 1 from public.workshop_state where data->'technicians' ? member_technician) then raise exception 'Unknown technician'; end if;
  select to_jsonb(s) into before_member from public.workshop_staff s where s.user_id = target_id;
  if (member_role <> 'admin' or not member_active) and exists (select 1 from public.workshop_staff where user_id = target_id and active and role = 'admin')
    and not exists (select 1 from public.workshop_staff where user_id <> target_id and active and role = 'admin') then raise exception 'Keep at least one active Admin account.'; end if;
  insert into public.workshop_staff(user_id,role,active,display_name,technician_name) values (target_id,member_role,member_active,btrim(member_name),member_technician)
    on conflict (user_id) do update set role = excluded.role,active = excluded.active,display_name = excluded.display_name,technician_name = excluded.technician_name;
  insert into public.workshop_audit(actor_id,actor_name,actor_role,action,details)
    values (auth.uid(),acting_name,'admin','manage_member',jsonb_build_object('before',before_member,'after',(select to_jsonb(t) from public.workshop_staff t where t.user_id = target_id)));
end;
$$;
revoke all on function public.manage_workshop_member(text,text,boolean,text,text) from public, anon;
grant execute on function public.manage_workshop_member(text,text,boolean,text,text) to authenticated;

-- Private compressed images. No public links, overwrites, or anonymous access.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('workshop-photos','workshop-photos',false,220000,array['image/jpeg'])
on conflict (id) do update set public = false,file_size_limit = 220000,allowed_mime_types = array['image/jpeg'];
create or replace function public.can_access_workshop_photo(object_name text, for_upload boolean)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare kind text := split_part(object_name,'/',1); entity_id text := split_part(object_name,'/',2); entity jsonb;
begin
  if not public.is_workshop_staff() or kind not in ('jobs','parts') or array_length(string_to_array(object_name,'/'),1) <> 4
    or split_part(object_name,'/',4) !~ '^[a-zA-Z0-9-]{1,80}\.jpg$' then return false; end if;
  select v into entity from public.workshop_state s,jsonb_array_elements(s.data->kind) v where s.id = 'main' and v->>'id' = entity_id;
  if entity is null then return false; end if;
  if for_upload then
    return split_part(object_name,'/',3) = auth.uid()::text and
      (case when kind = 'parts' then public.is_workshop_admin() else entity->>'status' not in ('Collected','Cancelled') end);
  end if;
  return true;
end;
$$;
revoke all on function public.can_access_workshop_photo(text,boolean) from public, anon;
grant execute on function public.can_access_workshop_photo(text,boolean) to authenticated;
drop policy if exists workshop_photo_read on storage.objects;
create policy workshop_photo_read on storage.objects for select to authenticated
  using (bucket_id = 'workshop-photos' and public.can_access_workshop_photo(name,false));
drop policy if exists workshop_photo_upload on storage.objects;
create policy workshop_photo_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'workshop-photos' and public.can_access_workshop_photo(name,true));
-- Original files are retained for audit and backups; the UI removes attachments.
-- Cleanup of abandoned uploads is an owner maintenance operation, never a staff delete.
commit;

-- FIRST ADMIN ONLY, run as project owner after creating the Auth user:
-- insert into public.workshop_staff(user_id,role,display_name)
-- select id,'admin','Workshop owner' from auth.users where email = 'owner@example.com'
-- on conflict (user_id) do update set role = 'admin', active = true;
-- Disable public sign-ups. Other existing Auth users can be approved in Settings.
