import { createClient } from '@supabase/supabase-js'
import type { WorkshopRepository } from './types'
import { parseWorkshop } from './validation'
import { staffAction } from './permissions'
export const cloudConfigured = !!(import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim())
export const client = cloudConfigured ? createClient(import.meta.env.VITE_SUPABASE_URL.trim().replace(/\/+$/, ''), import.meta.env.VITE_SUPABASE_ANON_KEY.trim(), { auth: { storageKey: 'thet-naing.auth.v1' }, global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) } }) : null
export function createCloudRepository(): WorkshopRepository {
  return {
    async load() {
      const { data, error } = await client!.from('workshop_state').select('data, revision').eq('id', 'main').single()
      if (error) throw new Error('Cloud workshop is unavailable. Confirm the schema is installed and your account is approved as staff.')
      return parseWorkshop({ ...data.data, revision: data.revision })
    },
    async save(data, expectedRevision, previous, role, restore = false) {
      if (!role || (role === 'staff' && !previous)) throw new Error('Workshop access is unavailable. Refresh and sign in again.')
      const command = role === 'staff' ? staffAction(previous!, data) : null
      const { data: result, error } = command
        ? await client!.rpc('staff_workshop_action', { ...command, expected_revision: expectedRevision })
        : await client!.rpc(restore ? 'restore_workshop' : 'save_workshop', { new_data: data, expected_revision: expectedRevision })
      if (error) throw new Error(error.message.includes('conflict') ? 'Another staff member changed the workshop. Refresh the data and try again.' : error.message)
      return parseWorkshop(result)
    },
  }
}
