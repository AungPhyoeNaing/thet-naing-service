import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { createSeed } from './seed'
import { parseWorkshop } from './validation'
import { saveRepairCharges, startRepair } from './operations'
import type { WorkshopData } from './types'

const admin = '11111111-1111-4111-8111-111111111111'
const staff = '22222222-2222-4222-8222-222222222222'
const outsider = '33333333-3333-4333-8333-333333333333'
function fixture(): WorkshopData {
  const data = createSeed(); data.revision = 0; data.demo = false; data.technicians = ['Aung']
  data.jobs = [{ ...data.jobs[0], id: 'repair', code: 'TN-1001', technician: 'Aung', status: 'Received', lines: [], estimateStatus: 'Draft', checks: [false,false,false], paid: 0, history: [] }]
  return data
}
describe('server-enforced Admin and Staff permissions', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('${admin}','admin@example.test'),('${staff}','staff@example.test'),('${outsider}','outsider@example.test');
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated,anon; grant select,insert,update,delete on storage.objects to authenticated,anon;`)
    const sql = readFileSync(new URL('../../supabase/schema.sql', import.meta.url),'utf8')
    await db.exec(sql); await db.exec(sql) // upgrades are rerunnable
  }, 30000)
  beforeEach(async () => {
    await db.exec('reset role; delete from public.workshop_staff; delete from public.workshop_audit; delete from storage.objects;')
    await db.query("insert into public.workshop_staff(user_id,role,display_name,technician_name) values ($1,'admin','Owner',''),($2,'staff','Worker','Aung')",[admin,staff])
    await db.query("update public.workshop_state set revision=0,data=$1::jsonb where id='main'",[JSON.stringify(fixture())])
  })
  afterAll(async () => { await db?.close() })
  async function asUser(id: string) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated') }
  async function state() { return (await db.query<{ data: WorkshopData }>("select data from public.workshop_state where id='main'")).rows[0].data }
  async function action(name: string, payload: unknown, revision = 0) {
    const result = await db.query<{ data: WorkshopData }>('select public.staff_workshop_action($1,$2::jsonb,$3) as data',[name,JSON.stringify(payload),revision])
    return parseWorkshop(result.rows[0].data)
  }
  async function save(data: WorkshopData, revision = 0) { return (await db.query<{ data: WorkshopData }>('select public.save_workshop($1::jsonb,$2) as data',[JSON.stringify(data),revision])).rows[0].data }

  it('denies unapproved and anonymous access to all write endpoints', async () => {
    await asUser(outsider)
    expect((await db.query('select * from public.workshop_state')).rows).toHaveLength(0)
    await expect(save(fixture())).rejects.toThrow('Staff access required')
    await expect(action('add_note',{job_id:'repair',text:'x'})).rejects.toThrow('Staff access required')
    await db.exec('reset role; set role anon')
    await expect(save(fixture())).rejects.toThrow('permission denied')
    await expect(action('add_note',{job_id:'repair',text:'x'})).rejects.toThrow('permission denied')
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(0)
  })
  it('allows Admin saves, rejects stale versions and protects the private commit helper', async () => {
    await asUser(admin); expect((await save(fixture())).revision).toBe(1)
    await expect(save(fixture())).rejects.toThrow('revision conflict')
    await expect(db.exec("update public.workshop_state set revision=10")).rejects.toThrow('permission denied')
    await expect(db.query("select public.commit_workshop('{}','{}',0,'forged')")).rejects.toThrow('permission denied')
    expect((await state()).revision).toBe(1)
    await expect(save({version:1} as WorkshopData,1)).rejects.toThrow('Invalid workshop data')
    expect((await state()).revision).toBe(1)
  })
  it('blocks Staff snapshot saves, role escalation, accounts and audit access', async () => {
    await asUser(staff)
    expect((await state()).jobs).toHaveLength(1)
    expect((await db.query('select * from public.workshop_staff')).rows).toHaveLength(1)
    await expect(save(fixture())).rejects.toThrow('Admin access required')
    await expect(db.query('select public.restore_workshop($1::jsonb,0)',[JSON.stringify(fixture())])).rejects.toThrow('Admin access required')
    await expect(db.exec("update public.workshop_staff set role='admin'")).rejects.toThrow('permission denied')
    await expect(db.exec('select public.list_workshop_members()')).rejects.toThrow('Admin access required')
    await expect(db.query("select public.manage_workshop_member('staff@example.test','admin',true,'Me','')")).rejects.toThrow('Admin access required')
    expect((await db.query('select * from public.workshop_audit')).rows).toHaveLength(0)
  })
  it('preserves original history on Admin restore and keeps an independent record of who restored it', async () => {
    await asUser(admin)
    const backup=fixture();backup.jobs[0].history=[{id:'legacy',at:'2020-01-01T00:00:00Z',text:'Historical intake'}]
    const restored=await db.query<{data:WorkshopData}>('select public.restore_workshop($1::jsonb,0) as data',[JSON.stringify(backup)])
    expect(restored.rows[0].data.jobs[0].history).toEqual(backup.jobs[0].history)
    expect((await db.query('select actor_id,action from public.workshop_audit')).rows).toEqual([{actor_id:admin,action:'admin_restore'}])
  })
  it('creates canonical repairs and ignores injected payments, roles, history and stock', async () => {
    await asUser(staff)
    const j = fixture().jobs[0]
    const result = await action('create_job',{...j,id:'new-repair',paid:999,role:'admin',status:'Collected',history:[{text:'forged',actorId:admin}]})
    expect(result.jobs[0]).toMatchObject({id:'new-repair',code:'TN-1002',status:'Received',paid:0,lines:[],estimateStatus:'Draft'})
    expect(result.parts).toEqual(fixture().parts)
    expect(result.jobs[0].history[0]).toMatchObject({actorId:staff,actorName:'Worker',text:'Service request received.'})
    await expect(action('create_job',{...j,id:'bad',dueDate:'2026-02-30'},1)).rejects.toThrow()
    expect((await state()).revision).toBe(1)
  })
  it('limits plan updates to operational fields and preserves existing history', async () => {
    await asUser(staff)
    const result = await action('update_plan',{job_id:'repair',diagnosis:'Motor checked',technician:'Aung',dueDate:'2026-10-23',paid:999,lines:[{}],history:[]})
    expect(result.jobs[0]).toMatchObject({diagnosis:'Motor checked',paid:0,lines:[]})
    const second = await action('add_note',{job_id:'repair',text:'Called customer',actorId:admin,at:'2000-01-01'},1)
    expect(second.jobs[0].history).toHaveLength(2)
    expect(second.jobs[0].history[0]).toMatchObject({actorId:staff,actorName:'Worker'})
    await expect(action('update_plan',{job_id:'repair',technician:'Aung',dueDate:'',diagnosis:null},2)).rejects.toThrow()
  })
  it('lets Staff draft charges without issuing stock or finalizing prices', async () => {
    await asUser(staff)
    const lines = [{id:'line',description:'Part',quantity:1,unitPrice:100,partId:fixture().parts[0].id}]
    const draft = await action('draft_charges',{job_id:'repair',lines,estimateStatus:'Approved',paid:100})
    expect(draft.jobs[0]).toMatchObject({estimateStatus:'Draft',paid:0,lines})
    expect(draft.parts).toEqual(fixture().parts)
    await expect(action('set_status',{job_id:'repair',status:'In repair'},1)).rejects.toThrow('Waiting for Admin')
    await expect(action('draft_charges',{job_id:'repair',lines:[{...lines[0],unitPrice:-1}]},1)).rejects.toThrow()
    await expect(action('draft_charges',{job_id:'repair',lines:[{...lines[0],quantity:null}]},1)).rejects.toThrow()
  })
  it('lets Staff progress finalized repairs but blocks payments, collection, cancellation and charge changes', async () => {
    await asUser(admin)
    const initial = fixture(); saveRepairCharges(initial,initial.jobs[0],[{id:'l',description:'Labour',quantity:1,unitPrice:100}]); startRepair(initial,initial.jobs[0]); await save(initial)
    await asUser(staff)
    await expect(action('set_status',{job_id:'repair',status:'Ready to collect'},1)).rejects.toThrow('quality checks')
    for (let index = 0; index < 3; index++) await action('set_check',{job_id:'repair',index,checked:true},index+1)
    expect((await action('set_status',{job_id:'repair',status:'Ready to collect'},4)).jobs[0].status).toBe('Ready to collect')
    for (const status of ['Collected','Cancelled']) await expect(action('set_status',{job_id:'repair',status},5)).rejects.toThrow('Admin access required')
    await expect(action('record_payment',{job_id:'repair',amount:100},5)).rejects.toThrow('Admin access required')
    await expect(action('draft_charges',{job_id:'repair',lines:[]},5)).rejects.toThrow('Admin access required')
    expect((await state()).jobs[0].paid).toBe(0)
    await asUser(admin)
    expect((await db.query('select * from public.workshop_audit')).rows).toHaveLength(5)
    await expect(db.exec('delete from public.workshop_audit')).rejects.toThrow('permission denied')
  })
  it('protects the last Admin, approves individual accounts and disables old sessions immediately at the database', async () => {
    await asUser(admin)
    await expect(db.query("select public.manage_workshop_member('admin@example.test','staff',true,'Owner','')")).rejects.toThrow('at least one')
    await expect(db.query("select public.manage_workshop_member('admin@example.test','admin',false,'Owner','')")).rejects.toThrow('at least one')
    await db.query("select public.manage_workshop_member('outsider@example.test','staff',true,'New worker','Aung')")
    expect((await db.query('select * from public.list_workshop_members()')).rows).toHaveLength(3)
    await db.query("select public.manage_workshop_member('staff@example.test','staff',false,'Worker','Aung')")
    await asUser(staff)
    expect((await db.query('select * from public.workshop_state')).rows).toHaveLength(0)
    await expect(action('add_note',{job_id:'repair',text:'old session'})).rejects.toThrow('Staff access required')
  })
  it('enforces photo paths and ownership, preserves originals and rejects forged attachments', async () => {
    await asUser(staff)
    const path = `jobs/repair/${staff}/photo-1.jpg`
    await db.query("insert into storage.objects(bucket_id,name) values ('workshop-photos',$1)",[path])
    await expect(db.query("insert into storage.objects(bucket_id,name) values ('workshop-photos',$1)",[`parts/${fixture().parts[0].id}/${staff}/photo-1.jpg`])).rejects.toThrow('row-level security')
    await expect(db.query("insert into storage.objects(bucket_id,name) values ('workshop-photos',$1)",[`jobs/repair/${admin}/photo-1.jpg`])).rejects.toThrow('row-level security')
    const photo = {id:'photo-1',name:'motor.jpg',caption:'Before repair',stage:'Intake',storagePath:path,uploadedBy:staff,createdAt:new Date().toISOString(),dataUrl:'forged'}
    const result = await action('attach_photo',{job_id:'repair',photo})
    expect(result.jobs[0].photos?.[0]).toMatchObject({storagePath:path,uploadedBy:staff})
    expect(result.jobs[0].photos?.[0].dataUrl).toBeUndefined()
    await expect(db.query("delete from storage.objects where name=$1 returning *",[path])).resolves.toMatchObject({rows:[]})
    await asUser(admin)
    const withOtherPhoto = await state(); withOtherPhoto.jobs[0].photos![0].uploadedBy = admin
    withOtherPhoto.jobs[0].photos![0].storagePath = `jobs/repair/${admin}/photo-1.jpg`; await save(withOtherPhoto,1)
    await asUser(staff)
    await expect(action('remove_photo',{job_id:'repair',photo_id:'photo-1'},2)).rejects.toThrow('your own')
    await expect(action('attach_photo',{job_id:'repair',photo:{...photo,id:'photo-2',storagePath:`jobs/repair/${staff}/photo-2.jpg`}},2)).rejects.toThrow('Invalid photo')
  })
})
