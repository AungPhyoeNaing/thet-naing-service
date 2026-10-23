import type { Job, WorkshopData } from './types'

export interface StaffAction { action: 'create_job' | 'update_plan' | 'add_note' | 'set_status' | 'set_check' | 'draft_charges' | 'attach_photo' | 'remove_photo'; payload: Record<string, unknown> }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const pick = (job: Job, keys: (keyof Job)[]) => Object.fromEntries(keys.map(key => [key, job[key]]))
export const intakeFields: (keyof Job)[] = ['customer', 'phone', 'address', 'category', 'equipment', 'brand', 'serial', 'issue', 'serviceType', 'priority', 'technician', 'dueDate']

// Translate existing UI mutations into small commands. The database independently
// validates each command and builds the result from its own locked snapshot.
export function staffAction(previous: WorkshopData, next: WorkshopData): StaffAction {
  const deny = () => { throw new Error('Admin access required for this action.') }
  if (!same(previous.parts, next.parts) || !same(previous.technicians, next.technicians) || previous.demo !== next.demo) return deny()
  const added = next.jobs.filter(job => !previous.jobs.some(old => old.id === job.id))
  if (added.length === 1 && next.jobs.length === previous.jobs.length + 1 && previous.jobs.every(old => same(old, next.jobs.find(job => job.id === old.id)))) {
    return { action: 'create_job', payload: { id: added[0].id, ...pick(added[0], intakeFields) } }
  }
  if (next.jobs.length !== previous.jobs.length || added.length) return deny()
  const changed = next.jobs.filter(job => !same(job, previous.jobs.find(old => old.id === job.id)))
  if (changed.length !== 1) return deny()
  const job = changed[0]; const old = previous.jobs.find(j => j.id === job.id)!
  const fields = (Object.keys(job) as (keyof Job)[]).filter(key => key !== 'history' && !same(old[key], job[key]))
  const payload = { job_id: job.id }
  if (fields.length === 1 && fields[0] === 'photos') {
    const before = old.photos ?? []; const after = job.photos ?? []
    const addedPhotos = after.filter(photo => !before.some(p => p.id === photo.id))
    const removedPhotos = before.filter(photo => !after.some(p => p.id === photo.id))
    if (addedPhotos.length === 1 && !removedPhotos.length && before.every(photo => same(photo, after.find(p => p.id === photo.id)))) return { action: 'attach_photo', payload: { ...payload, photo: addedPhotos[0] } }
    if (removedPhotos.length === 1 && !addedPhotos.length && after.every(photo => same(photo, before.find(p => p.id === photo.id)))) return { action: 'remove_photo', payload: { ...payload, photo_id: removedPhotos[0].id } }
  }
  if (!fields.length && job.history.length === old.history.length + 1) return { action: 'add_note', payload: { ...payload, text: job.history[0].text } }
  if (fields.length && fields.every(key => ['technician', 'dueDate', 'diagnosis'].includes(key))) return { action: 'update_plan', payload: { ...payload, ...pick(job, ['technician', 'dueDate', 'diagnosis']) } }
  if (fields.length === 1 && fields[0] === 'status') return { action: 'set_status', payload: { ...payload, status: job.status } }
  if (fields.length === 1 && fields[0] === 'checks') {
    const indexes = job.checks.map((v, i) => v !== old.checks[i] ? i : -1).filter(i => i >= 0)
    if (indexes.length === 1) return { action: 'set_check', payload: { ...payload, index: indexes[0], checked: job.checks[indexes[0]] } }
  }
  if (fields.length && fields.every(key => ['lines', 'estimateStatus'].includes(key)) && old.estimateStatus !== 'Approved' && job.estimateStatus === 'Draft') return { action: 'draft_charges', payload: { ...payload, lines: job.lines } }
  return deny()
}
