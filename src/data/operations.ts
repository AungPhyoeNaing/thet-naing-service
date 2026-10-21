import { uid } from '../lib/format'
import { finalStatuses, type Job, type JobDraft, type JobStatus, type WorkshopData, type EstimateLine } from './types'
export const total = (job: Job) => job.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
export const balance = (job: Job) => Math.max(0, total(job) - job.paid)
export function note(job: Job, text: string) { job.history.unshift({ id: uid(), at: new Date().toISOString(), text }) }
export function createJob(data: WorkshopData, draft: JobDraft) {
  if (!draft.customer.trim() || !draft.phone.trim() || !draft.equipment.trim() || !draft.issue.trim()) throw new Error('Enter the customer, phone, equipment and reported problem.')
  if (draft.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate)) throw new Error('Enter a valid target date.')
  const code = Math.max(1000, ...data.jobs.map(j => Number(j.code.replace('TN-', '')) || 1000)) + 1
  const job: Job = { ...draft, customer: draft.customer.trim(), phone: draft.phone.trim(), equipment: draft.equipment.trim(), issue: draft.issue.trim(), id: uid(), code: 'TN-' + code, status: 'Received', createdAt: new Date().toISOString(), diagnosis: '', lines: [], estimateStatus: 'Draft', paid: 0, checks: [false, false, false], history: [] }
  note(job, 'Service request received.'); data.jobs.unshift(job); return job
}
export function saveEstimate(job: Job, lines: EstimateLine[]) {
  if (job.estimateStatus === 'Approved' || finalStatuses.includes(job.status)) throw new Error('This estimate is locked. Create a new job for additional work.')
  if (!lines.length || lines.some(l => !l.description.trim() || !Number.isInteger(l.quantity) || l.quantity <= 0 || !Number.isSafeInteger(l.unitPrice) || l.unitPrice < 0)) throw new Error('Add at least one item with a description, whole quantity and non-negative whole price.')
  if (!Number.isSafeInteger(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0))) throw new Error('Estimate total is too large.')
  job.lines = lines; job.estimateStatus = 'Draft'; note(job, 'Estimate updated.')
}
export function sendEstimate(job: Job) {
  if (!job.lines.length || job.estimateStatus === 'Approved' || finalStatuses.includes(job.status)) throw new Error('Save a draft estimate first.')
  job.estimateStatus = 'Sent'; job.status = 'Awaiting approval'; note(job, 'Estimate marked as shared with the customer.')
}
export function approveEstimate(data: WorkshopData, job: Job) {
  if (job.estimateStatus !== 'Sent' || finalStatuses.includes(job.status)) throw new Error('Share the estimate before recording customer approval.')
  const required = new Map<string, number>()
  for (const line of job.lines) if (line.partId) required.set(line.partId, (required.get(line.partId) ?? 0) + line.quantity)
  for (const [id, qty] of required) { const part = data.parts.find(p => p.id === id); if (!part || part.stock < qty) throw new Error(`Insufficient stock for ${part?.name ?? 'a removed part'}. Receive stock or revise the estimate first.`) }
  for (const [id, qty] of required) data.parts.find(p => p.id === id)!.stock -= qty
  job.estimateStatus = 'Approved'; job.status = 'In repair'; note(job, 'Customer approval recorded. Quoted parts issued from inventory.')
}
export function changeStatus(job: Job, status: JobStatus) {
  if (status === job.status) return
  if (finalStatuses.includes(job.status)) throw new Error('This job is closed. Create a new request for further work.')
  if (status === 'In repair' && job.estimateStatus !== 'Approved') throw new Error('Record customer approval of the estimate before starting repair.')
  if (status === 'Ready to collect' && (job.estimateStatus !== 'Approved' || !job.checks.every(Boolean))) throw new Error('Approve the estimate and complete all three quality checks before marking ready.')
  if (status === 'Collected' && (job.status !== 'Ready to collect' || balance(job) > 0)) throw new Error('Mark the job ready and record full payment before collection.')
  if (status === 'Cancelled' && (job.paid > 0 || job.estimateStatus === 'Approved')) throw new Error('Jobs with approved work or recorded payments cannot be cancelled. Complete the job and retain its audit history.')
  job.status = status; note(job, `Status changed to ${status.toLowerCase()}.`)
}
export function recordPayment(job: Job, amount: number) {
  if (job.estimateStatus !== 'Approved' || job.status === 'Cancelled' || job.status === 'Collected') throw new Error('Payments can be recorded on approved, open repairs.')
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > balance(job)) throw new Error('Enter a whole payment greater than zero and no more than the remaining balance.')
  job.paid += amount; note(job, `Payment received: ${amount.toLocaleString('en-US')} Ks.`)
}
