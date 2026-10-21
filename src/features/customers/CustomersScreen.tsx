import { sampleLabel } from '../../lib/sample-labels'
import { useText } from '../../lib/language-context'
import { useState } from 'react'
import { ArrowUpRight, Search, Users } from 'lucide-react'
import { PageHeading, useActions } from '../../app/AppShell'
import { useWorkshop } from '../../app/workshop-context'
import { balance } from '../../data/operations'
import type { Job } from '../../data/types'
import { initials, money, shortDate } from '../../lib/format'
export default function CustomersScreen() {
  const tr = useText()

  const { data } = useWorkshop(); const { openJob } = useActions(); const [query, setQuery] = useState(''); const [expanded, setExpanded] = useState('')
  const groups = new Map<string, Job[]>()
  for (const job of data!.jobs) { const key = job.customer.toLowerCase().trim() + ':' + job.phone.replace(/\D/g, ''); groups.set(key, [...(groups.get(key) ?? []), job]) }
  const customers = [...groups.entries()].filter(([,jobs]) => [jobs[0].customer, jobs[0].phone].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b) => a[1][0].customer.localeCompare(b[1][0].customer))
  return <><PageHeading title={tr("Customers")} description={tr("A service history for every household and business you help.")} /><section className="surface"><div className="surface-heading"><h2>{tr("Customer directory")}<span className="count-pill">{groups.size}</span></h2><div className="search-field"><Search size={16} /><input aria-label={tr("Search customers")} placeholder={tr("Search name or phone…")} value={query} onChange={e => setQuery(e.target.value)} /></div></div><div className="customer-list">{customers.map(([key,jobs]) => { const customer = jobs[0]; return <div className="customer-group" key={key}><button className="customer-row" onClick={() => setExpanded(expanded === key ? '' : key)} aria-expanded={expanded === key}><span className="avatar">{initials(customer.customer)}</span><span className="customer-name"><strong>{sampleLabel(customer,'customer',tr)}</strong><small>{customer.phone}</small></span><span><small>{tr("Service jobs")}</small><strong>{jobs.length}</strong></span><span className="customer-balance"><small>{tr("Outstanding balance")}</small><strong>{money(jobs.filter(j => j.estimateStatus === 'Approved' && j.status !== 'Cancelled').reduce((s,j) => s + balance(j),0))}</strong></span><ArrowUpRight size={17} /></button>{expanded === key && <div className="customer-history"><p>{customer.address || tr('No address recorded')}</p>{jobs.map(j => <button key={j.id} onClick={() => openJob(j.id)}><strong>{j.code}</strong><span>{sampleLabel(j,'equipment',tr)}</span><small>{shortDate(j.createdAt.slice(0,10))}</small><span>{tr(j.status)}</span><ArrowUpRight size={14} /></button>)}</div>}</div> })}{!customers.length && <div className="empty-state"><Users size={32} /><h3>{tr("No customers found")}</h3><p>{tr("Customer records are created automatically from service requests.")}</p></div>}</div></section><p className="page-note">{tr("Requests with the same customer name and phone number are grouped into one service history.")}</p></>
}
