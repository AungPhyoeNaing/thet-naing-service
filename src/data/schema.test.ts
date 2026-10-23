/// <reference types="node" />
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const approved = '11111111-1111-4111-8111-111111111111'; const outsider = '22222222-2222-4222-8222-222222222222'
const empty = { version:1, revision:0, demo:false, jobs:[], parts:[], technicians:[] }
describe('Supabase schema access and atomic updates', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite(); await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key, email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values ('${approved}','approved@example.test'), ('${outsider}','outsider@example.test');`)
    await db.exec(`create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(bucket_id text,name text); alter table storage.objects enable row level security;`);
    await db.exec(readFileSync(new URL('../../supabase/schema.sql', import.meta.url),'utf8')); await db.query("insert into public.workshop_staff(user_id,role) values ($1,'admin')",[approved])
  },30000)
  afterAll(async () => { await db?.close() })
  async function asUser(id: string) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated') }
  it('hides data from unapproved users and rejects their saves', async () => { await asUser(outsider); expect((await db.query('select * from public.workshop_state')).rows).toHaveLength(0); await expect(db.query('select public.save_workshop($1::jsonb,0)',[JSON.stringify(empty)])).rejects.toThrow('Staff access required') })
  it('allows approved staff to read, saves atomically and rejects stale versions', async () => {
    await asUser(approved); expect((await db.query('select * from public.workshop_state')).rows).toHaveLength(1)
    const saved = await db.query<{state:typeof empty}>('select public.save_workshop($1::jsonb,0) as state',[JSON.stringify(empty)]); expect(saved.rows[0].state.revision).toBe(1)
    await expect(db.query('select public.save_workshop($1::jsonb,0)',[JSON.stringify(empty)])).rejects.toThrow('revision conflict')
    await expect(db.exec("update public.workshop_state set revision = 10 where id = 'main'")).rejects.toThrow('permission denied')
    expect((await db.query<{revision:number}>('select revision from public.workshop_state')).rows[0].revision).toBe(1)
  })
  it('rejects malformed snapshots without advancing the revision', async () => { await asUser(approved); await expect(db.query('select public.save_workshop($1::jsonb,1)',[JSON.stringify({version:1})])).rejects.toThrow('Invalid workshop data'); expect((await db.query<{revision:number}>('select revision from public.workshop_state')).rows[0].revision).toBe(1) })
  it('does not grant anonymous access', async () => { await db.exec('reset role; set role anon;'); await expect(db.exec('select * from public.workshop_state')).rejects.toThrow('permission denied'); await expect(db.query('select public.save_workshop($1::jsonb,1)',[JSON.stringify(empty)])).rejects.toThrow('permission denied'); await db.exec('reset role') })
})
