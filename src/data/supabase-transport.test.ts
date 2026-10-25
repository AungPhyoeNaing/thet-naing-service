// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, createWorkshopClient, WORKSHOP_API_PATH } from './supabase-transport'
import routing from '../../vercel.json'

const clients: SupabaseClient[] = []
const projectUrl = 'https://sydhltbgymwutkvuhmpl.supabase.co'
const base = () => window.location.origin + WORKSHOP_API_PATH
function setup() {
  const requests: { url: string; init?: RequestInit }[] = []
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); requests.push({ url, init })
    let body: unknown = []
    if (url.includes('/auth/v1/token')) body = {
      access_token: 'staff-access-token', refresh_token: 'staff-refresh-token', token_type: 'bearer', expires_in: 3600,
      user: { id: 'staff-id', email: 'staff@example.test' },
    }
    else if (url.includes('/storage/v1/object/sign/')) body = { signedURL: '/object/sign/workshop-photos/jobs/repair/staff/photo.jpg?token=private-token' }
    else if (url.includes('/storage/v1/')) body = { Key: 'workshop-photos/jobs/repair/staff/photo.jpg' }
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetcher)
  const client = createWorkshopClient(projectUrl, 'public-anon-key', window.location.origin)
  void client.auth.stopAutoRefresh(); clients.push(client)
  return { client, requests }
}
afterEach(async () => {
  for (const client of clients.splice(0)) { await client.auth.signOut({ scope: 'local' }); await client.auth.stopAutoRefresh() }
  localStorage.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs()
})

describe('same-origin workshop transport', () => {
  it('keeps password login, refresh, table queries, RPCs and logout on the website with the user token', async () => {
    const { client, requests } = setup()
    expect((await client.auth.signInWithPassword({email:'staff@example.test',password:'test-password'})).error).toBeNull()
    await client.from('workshop_staff').select('role, active').eq('user_id','staff-id')
    await client.rpc('staff_workshop_action',{action:'add_note',payload:{job_id:'repair',text:'Checked motor'},expected_revision:1})
    expect(requests[0].url).toBe(base() + '/auth/v1/token?grant_type=password')
    expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({email:'staff@example.test',password:'test-password'})
    const query = new URL(requests[1].url)
    expect(query.pathname).toBe(WORKSHOP_API_PATH + '/rest/v1/workshop_staff')
    expect(query.searchParams.get('user_id')).toBe('eq.staff-id')
    expect(requests[2].url).toBe(base() + '/rest/v1/rpc/staff_workshop_action')
    expect(new Headers(requests[2].init?.headers).get('authorization')).toBe('Bearer staff-access-token')
    expect(new Headers(requests[2].init?.headers).get('apikey')).toBe('public-anon-key')
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toContain('staff-refresh-token')
    await client.auth.refreshSession()
    expect(requests.at(-1)?.url).toBe(base() + '/auth/v1/token?grant_type=refresh_token')
    await client.auth.signOut({scope:'local'})
    expect(requests.at(-1)?.url).toBe(base() + '/auth/v1/logout?scope=local')
    expect(requests.every(request=>new URL(request.url).origin===window.location.origin)).toBe(true)
  })

  it('sends photo uploads and signed image links through the same-origin Storage proxy', async () => {
    const { client, requests } = setup()
    const file = new File([new Uint8Array(220000)],'photo.jpg',{type:'image/jpeg'})
    expect((await client.storage.from('workshop-photos').upload('jobs/repair/staff/photo.jpg',file,{contentType:'image/jpeg',upsert:false})).error).toBeNull()
    expect(requests[0].url).toBe(base()+'/storage/v1/object/workshop-photos/jobs/repair/staff/photo.jpg')
    expect(requests[0].init?.method).toBe('POST')
    expect(requests[0].init?.body).toBeInstanceOf(FormData)
    expect(((requests[0].init?.body as FormData).get('') as File).size).toBe(220000)
    const signed = await client.storage.from('workshop-photos').createSignedUrl('jobs/repair/staff/photo.jpg',3600)
    expect(signed.error).toBeNull()
    expect(signed.data?.signedUrl).toBe(base()+'/storage/v1/object/sign/workshop-photos/jobs/repair/staff/photo.jpg?token=private-token')
    expect(requests[1].url).toBe(base()+'/storage/v1/object/sign/workshop-photos/jobs/repair/staff/photo.jpg')
  })

  it('places fixed workshop-only upstream routes before the SPA and disables browser/CDN caching', () => {
    for (const service of ['auth','rest','storage']) {
      const index = routing.rewrites.findIndex(route=>route.source===`${WORKSHOP_API_PATH}/${service}/v1/:path*`)
      expect(index).toBeGreaterThanOrEqual(0); expect(index).toBeLessThan(routing.rewrites.length-1)
      expect(routing.rewrites[index].destination).toBe(`${projectUrl}/${service}/v1/:path*`)
    }
    const fallback = routing.rewrites.at(-1)!
    const pattern = new RegExp('^'+fallback.source+'$')
    expect(pattern.test('/settings')).toBe(true)
    expect(pattern.test('/workshop-api/rest/v1/workshop_state')).toBe(false)
    const headers = routing.headers.find(route=>route.source===WORKSHOP_API_PATH+'/:path*')!.headers
    expect(headers).toContainEqual({key:'Cache-Control',value:'private, no-store'})
    expect(headers).toContainEqual({key:'CDN-Cache-Control',value:'no-store'})
    expect(headers).toContainEqual({key:'Vercel-CDN-Cache-Control',value:'no-store'})
    expect(headers).toContainEqual({key:'x-vercel-enable-rewrite-caching',value:'0'})
    expect(AUTH_STORAGE_KEY).toBe('thet-naing.auth.v1')
  })

})
