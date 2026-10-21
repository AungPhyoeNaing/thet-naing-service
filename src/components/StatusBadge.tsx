import { useText } from '../lib/language-context'
import type { JobStatus } from '../data/types'
export default function StatusBadge({ status }: { status: JobStatus | string }) {
  const tr = useText()
 return <span className={'status-badge status-' + status.toLowerCase().replaceAll(' ', '-') }><i />{tr(status)}</span> }
