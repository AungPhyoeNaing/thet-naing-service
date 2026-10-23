import { finalStatuses, type Job } from '../data/types'
export function todaysWork(jobs: Job[], day: string, technician = '') {
  const localDay = (at: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Rangoon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at))
  return jobs.filter(job => !finalStatuses.includes(job.status) && (
    !job.dueDate || job.dueDate <= day || job.priority === 'Urgent' ||
    ['In repair', 'Waiting for parts', 'Awaiting approval', 'Ready to collect'].includes(job.status) ||
    localDay(job.createdAt) === day || (!!technician && job.technician === technician)
  )).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
}
