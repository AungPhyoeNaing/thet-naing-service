import type { JobStatus } from '../data/types'
export default function StatusBadge({ status }: { status: JobStatus | string }) { return <span className={'status-badge status-' + status.toLowerCase().replaceAll(' ', '-') }><i />{status}</span> }
