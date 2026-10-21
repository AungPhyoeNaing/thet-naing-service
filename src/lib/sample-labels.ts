import type { Job } from '../data/types'
// Only app-supplied fixtures are translated. Staff-entered names and notes stay exact.
export function sampleLabel(job: Job, field: 'equipment' | 'customer' | 'issue', tr: (text: string) => string) {
  return job.id.startsWith('demo-job-') ? tr(job[field]) : job[field]
}
