import { photoStages, statuses, type WorkshopData } from './types'
export function parseWorkshop(value: unknown): WorkshopData {
  const fail = () => { throw new Error('This is not a valid Thet Naing Service backup. Your current data has not been changed.') }
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 20000
  const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
  const date = (v: unknown) => text(v) && (v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v))))
  const timestamp = (v: unknown) => text(v) && v.length > 0 && !isNaN(Date.parse(v))
  const photos = (v: unknown, kind: 'jobs' | 'parts', id: string) => {
    if (v === undefined) return true
    if (!Array.isArray(v) || v.length > (kind === 'jobs' ? 8 : 4)) return false
    const seen = new Set<string>()
    for (const p of v) {
      if (!object(p) || !text(p.id) || !/^[a-zA-Z0-9-]{1,80}$/.test(p.id) || seen.has(p.id) || !text(p.name) || p.name.length > 200 || !text(p.caption) || p.caption.length > 300 || !text(p.uploadedBy) || !timestamp(p.createdAt) || !photoStages.includes(p.stage as never)) return false
      if (kind === 'parts' ? p.stage !== 'Inventory' : p.stage === 'Inventory') return false
      if (p.storagePath !== undefined) {
        if (p.dataUrl !== undefined || p.storagePath !== `${kind}/${id}/${p.uploadedBy}/${p.id}.jpg`) return false
      } else if (typeof p.dataUrl !== 'string' || p.dataUrl.length > 400000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(p.dataUrl)) return false
      seen.add(p.id)
    }
    return true
  }
  if (!object(value) || value.version !== 1 || !integer(value.revision) || typeof value.demo !== 'boolean' || !Array.isArray(value.jobs) || !Array.isArray(value.parts) || !Array.isArray(value.technicians)) return fail()
  if (value.jobs.length > 50000 || value.parts.length > 10000 || value.technicians.length > 100 || !value.technicians.every(text)) return fail()
  const ids = new Set<string>(); const codes = new Set<string>(); const partIds = new Set<string>(); const skus = new Set<string>()
  for (const p of value.parts) {
    if (!object(p) || !['id', 'sku', 'name', 'category', 'location'].every(k => text(p[k])) || !p.id || !p.sku || !p.name || !integer(p.stock) || !integer(p.minimum) || !integer(p.price) || partIds.has(p.id as string) || skus.has(p.sku as string)) return fail()
    partIds.add(p.id as string); skus.add(p.sku as string)
    if (!photos(p.photos, 'parts', p.id as string)) return fail()
  }
  for (const j of value.jobs) {
    if (!object(j) || !['id', 'code', 'customer', 'phone', 'address', 'equipment', 'brand', 'serial', 'issue', 'technician', 'diagnosis'].every(k => text(j[k])) || !j.id || !/^TN-\d+$/.test(j.code as string) || ids.has(j.id as string) || codes.has(j.code as string) || !statuses.includes(j.status as never) || !['Home appliance', 'Industrial machine'].includes(j.category as string) || !['Normal', 'High', 'Urgent'].includes(j.priority as string) || !['Workshop drop-off', 'On-site visit'].includes(j.serviceType as string) || !['Draft', 'Sent', 'Approved', 'Declined'].includes(j.estimateStatus as string) || !integer(j.paid) || !date(j.dueDate) || !timestamp(j.createdAt) || !Array.isArray(j.lines) || !Array.isArray(j.checks) || j.checks.length !== 3 || !j.checks.every(v => typeof v === 'boolean') || !Array.isArray(j.history)) return fail()
    if (j.lines.length > 500 || j.history.length > 10000) return fail()
    if (!photos(j.photos, 'jobs', j.id as string)) return fail()
    let sum = 0
    for (const l of j.lines) {
      if (!object(l) || !text(l.id) || !text(l.description) || !integer(l.quantity) || l.quantity < 1 || !integer(l.unitPrice) || (l.partId !== undefined && (!text(l.partId) || !partIds.has(l.partId)))) return fail()
      sum += l.quantity * l.unitPrice
    }
    if (!Number.isSafeInteger(sum) || j.paid > sum || (j.paid > 0 && j.estimateStatus !== 'Approved')) return fail()
    if ((j.status === 'In repair' || j.status === 'Ready to collect' || j.status === 'Collected') && j.estimateStatus !== 'Approved') return fail()
    if ((j.status === 'Ready to collect' || j.status === 'Collected') && !j.checks.every(Boolean)) return fail()
    if (j.status === 'Collected' && j.paid !== sum) return fail()
    for (const h of j.history) if (!object(h) || !text(h.id) || !text(h.text) || !timestamp(h.at) || (h.actorId !== undefined && !text(h.actorId)) || (h.actorName !== undefined && !text(h.actorName))) return fail()
    ids.add(j.id as string); codes.add(j.code as string)
  }
  return structuredClone(value) as unknown as WorkshopData
}
