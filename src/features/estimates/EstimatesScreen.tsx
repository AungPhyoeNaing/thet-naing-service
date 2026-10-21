import { useState } from 'react'
import { FileCheck2, FileClock, FileText } from 'lucide-react'
import { PageHeading, useActions } from '../../app/AppShell'
import { useWorkshop } from '../../app/providers'
import StatusBadge from '../../components/StatusBadge'
import { balance, total } from '../../data/operations'
import { money, shortDate } from '../../lib/format'
export default function EstimatesScreen() {
  const { data } = useWorkshop(); const { openJob } = useActions(); const [filter, setFilter] = useState('All estimates')
  const estimates = data!.jobs.filter(j => j.lines.length > 0 && (filter === 'All estimates' || j.estimateStatus === filter))
  const pending = data!.jobs.filter(j => j.estimateStatus === 'Sent')
  return <><PageHeading title="Estimates & approvals" description="Clear quotes, customer decisions and the cost of every repair." /><div className="summary-cards"><div><FileClock size={23} /><span>Awaiting approval<strong>{pending.length} estimates</strong></span></div><div><FileText size={23} /><span>Pending quote value<strong>{money(pending.reduce((s,j) => s + total(j), 0))}</strong></span></div><div><FileCheck2 size={23} /><span>Approved repair value<strong>{money(data!.jobs.filter(j => j.estimateStatus === 'Approved').reduce((s,j) => s + total(j), 0))}</strong></span></div></div><section className="surface"><div className="surface-heading"><h2>Repair estimates</h2><select value={filter} aria-label="Filter estimates" onChange={e => setFilter(e.target.value)}><option>All estimates</option><option>Draft</option><option>Sent</option><option>Approved</option><option>Declined</option></select></div><div className="table-container"><table><thead><tr><th>Job / customer</th><th>Equipment</th><th>Estimate status</th><th>Quote total</th><th>Balance due</th><th>Target date</th></tr></thead><tbody>{estimates.map(j => <tr key={j.id}><td><button className="table-job" onClick={() => openJob(j.id, 'estimate')}><strong>{j.code}</strong><span>{j.customer}</span></button></td><td>{j.equipment}</td><td><StatusBadge status={j.estimateStatus} /></td><td>{money(total(j))}</td><td>{money(balance(j))}</td><td>{shortDate(j.dueDate)}</td></tr>)}</tbody></table>{!estimates.length && <div className="empty-state"><FileText size={32} /><h3>No estimates here yet</h3><p>Open a service job and add parts and labour to prepare an estimate.</p></div>}</div></section><p className="page-note">Sharing and approval are recorded by staff. Contact the customer directly to discuss their estimate.</p></>
}
