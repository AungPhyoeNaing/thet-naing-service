import { createClient } from '@supabase/supabase-js'

export const WORKSHOP_API_PATH = '/workshop-api'
export const AUTH_STORAGE_KEY = 'thet-naing.auth.v1'

export function createWorkshopClient(projectUrl: string, anonKey: string, browserOrigin?: string) {
  const upstream = projectUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
  // Supplying the proxy URL to the SDK also keeps generated signed photo URLs
  // on the website. Rewriting fetch alone would leave media on Supabase.
  const endpoint = browserOrigin ? new URL(WORKSHOP_API_PATH, browserOrigin).href : upstream
  return createClient(endpoint, anonKey.trim(), {
    auth: { storageKey: AUTH_STORAGE_KEY },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      }),
    },
  })
}
