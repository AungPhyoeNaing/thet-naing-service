import type { WorkshopRepository } from './types'
import { parseWorkshop } from './validation'
import { createSeed } from './seed'
export const STORAGE_KEY = 'thet-naing.workshop.v1'
export function createLocalRepository(storage: Pick<Storage, 'getItem' | 'setItem'>): WorkshopRepository {
  function read() {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return createSeed()
    try { return parseWorkshop(JSON.parse(raw)) } catch { throw new Error('Saved workshop data could not be read. Use Settings to export the original data for recovery; it has not been overwritten.') }
  }
  return {
    async load() { const data = read(); if (!storage.getItem(STORAGE_KEY)) storage.setItem(STORAGE_KEY, JSON.stringify(data)); return data },
    async save(data, expectedRevision) {
      const write = () => {
        if (read().revision !== expectedRevision) throw new Error('Another tab changed the workshop. Refresh the data and try again.')
        const next = parseWorkshop({ ...data, revision: expectedRevision + 1 })
        storage.setItem(STORAGE_KEY, JSON.stringify(next)); return next
      }
      if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(STORAGE_KEY, write)
      return write()
    },
  }
}
