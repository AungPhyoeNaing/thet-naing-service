import { sampleLabel } from '../../lib/sample-labels'
import { useText } from '../../lib/language-context'
import { useState } from 'react'
import { FileCheck2, FileClock, FileText } from 'lucide-react'
import { PageHeading, useActions } from '../../app/AppShell'
import { useWorkshop } from '../../app/workshop-context'
import StatusBadge from '../../components/StatusBadge'
import { balance, total } from '../../data/operations'
import { money, shortDate } from '../../lib/format'
export default function EstimatesScreen() {
  const tr = useText()

  const { data } = useWorkshop(); const { openJob } = useActions(); const [filter, setFilter] = useState('All estimates')
  const estimates = data!.jobs.filter(j => j.lines.length > 0 && (filter === 'All estimates' || j.estimateStatus === filter))
  const pending = data!.jobs.filter(j => j.estimateStatus === 'Sent')
  return <><PageHeading title={tr("Estimates & approvals")} description={tr("Clear quotes, customer decisions and the cost of every repair.")} /><div className="summary-cards"><div><FileClock size={23} /><span>{tr("Awaiting approval")}<strong>{pending.length} {tr("estimates")}</strong></span></div><div><FileText size={23} /><span>{tr("Pending quote value")}<strong>{money(pending.reduce((s,j) => s + total(j), 0))}</strong></span></div><div><FileCheck2 size={23} /><span>{tr("Approved repair value")}<strong>{money(data!.jobs.filter(j => j.estimateStatus === 'Approved').reduce((s,j) => s + total(j), 0))}</strong></span></div></div><section className="surface"><div className="surface-heading"><h2>{tr("Repair estimates")}</h2><select value={filter} aria-label={tr("Filter estimates")} onChange={e => setFilter(e.target.value)}><option value="All estimates">{tr("All estimates")}</option><option value="Draft">{tr("Draft")}</option><option value="Sent">{tr("Sent")}</option><option value="Approved">{tr("Approved")}</option><option value="Declined">{tr("Declined")}</option></select></div><div className="table-container"><table className="worker-table"><thead><tr><th>{tr("Job / customer")}</th><th>{tr("Equipment")}</th><th>{tr("Estimate status")}</th><th>{tr("Quote total")}</th><th>{tr("Balance due")}</th><th>{tr("Target date")}</th></tr></thead><tbody>{estimates.map(j => <tr key={j.id}><td><button className="table-job" onClick={() => openJob(j.id, 'estimate')}><strong>{j.code}</strong><span>{sampleLabel(j,'customer',tr)}</span></button></td><td data-label={tr('Equipment')}>{sampleLabel(j,'equipment',tr)}</td><td data-label={tr("Estimate status")}><StatusBadge status={j.estimateStatus} /></td><td data-label={tr("Quote total")}>{money(total(j))}</td><td data-label={tr("Balance due")}>{money(balance(j))}</td><td data-label={tr("Target date")}>{shortDate(j.dueDate)}</td></tr>)}</tbody></table>{!estimates.length && <div className="empty-state"><FileText size={32} /><h3>{tr("No estimates here yet")}</h3><p>{tr("Open a service job and add parts and labour to prepare an estimate.")}</p></div>}</div></section><p className="page-note">{tr("Sharing and approval are recorded by staff. Contact the customer directly to discuss their estimate.")}</p></>
}
