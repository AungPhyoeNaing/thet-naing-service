import { createClient } from '@supabase/supabase-js'
import type { WorkshopRepository } from './types'
import { parseWorkshop } from './validation'
export const cloudConfigured = !!(import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim())
export const client = cloudConfigured ? createClient(import.meta.env.VITE_SUPABASE_URL.trim().replace(/\/+$/, ''), import.meta.env.VITE_SUPABASE_ANON_KEY.trim(), { auth: { storageKey: 'thet-naing.auth.v1' }, global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) } }) : null
export function createCloudRepository(): WorkshopRepository {
  return {
    async load() {
      const { data, error } = await client!.from('workshop_state').select('data, revision').eq('id', 'main').single()
      if (error) throw new Error('Cloud workshop is unavailable. Confirm the schema is installed and your account is approved as staff.')
      return parseWorkshop({ ...data.data, revision: data.revision })
    },
    async save(data, expectedRevision) {
      const { data: result, error } = await client!.rpc('save_workshop', { new_data: data, expected_revision: expectedRevision })
      if (error) throw new Error(error.message.includes('conflict') ? 'Another staff member changed the workshop. Refresh the data and try again.' : 'The cloud save failed. Your changes were not saved. Check your connection and staff access.')
      return parseWorkshop(result)
    },
  }
}
