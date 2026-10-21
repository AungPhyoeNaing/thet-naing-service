import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom'
import { Activity, ArrowUpRight, Bell, CircleHelp, ClipboardList, Cloud, Download, FileText, LayoutDashboard, Menu, Package, Plus, Search, Settings, ShieldCheck, Users, Wrench, X } from 'lucide-react'
import { useWorkshop } from './providers'
import { cloudConfigured } from '../data/supabase'
import { download, timeLabel } from '../lib/format'
import { STORAGE_KEY } from '../data/local'
import NewJobSheet from '../features/jobs/NewJobSheet'
import JobDrawer from '../features/jobs/JobDrawer'
export interface AppActions { openJob: (id: string, tab?: string) => void; newRequest: () => void }
export const useActions = () => useOutletContext<AppActions>()
const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard }, { to: '/jobs', label: 'Service jobs', icon: ClipboardList },
  { to: '/estimates', label: 'Estimates', icon: FileText }, { to: '/parts', label: 'Parts inventory', icon: Package },
  { to: '/customers', label: 'Customers', icon: Users }, { to: '/reports', label: 'Reports', icon: Activity },
]
export default function AppShell() {
  const { data, error, toast, busy, refresh, clearError } = useWorkshop()
  const [newJob, setNewJob] = useState(false); const [selected, setSelected] = useState<{ id: string; tab: string } | null>(null)
  const [mobile, setMobile] = useState(false); const [activity, setActivity] = useState(false)
  const navigate = useNavigate(); const search = useRef<HTMLInputElement>(null)
  const openJob = (id: string, tab = 'details') => { setSelected({ id, tab }); setActivity(false) }
  const entries = data?.jobs.flatMap(job => job.history.map(h => ({ ...h, job }))).sort((a,b) => b.at.localeCompare(a.at)).slice(0, 6) ?? []
  return <div className="app-shell">
    {mobile && <button className="nav-scrim" onClick={() => setMobile(false)} aria-label="Close navigation" />}
    <aside id="workshop-navigation" className={'sidebar ' + (mobile ? 'is-open' : '')}>
      <Link className="brand" to="/" onClick={() => setMobile(false)}><span className="brand-symbol"><Wrench size={23} /></span><span>Thet Naing<span className="brand-sub">Service & repair</span></span></Link>
      <div className="workspace-tag"><span className="workshop-dot" />Workshop workspace</div>
      <nav aria-label="Main navigation">{navigation.map(({to, label, icon: Icon}) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobile(false)}><Icon size={19} /><span>{label}</span>{to === '/jobs' && <span className="nav-count">{data?.jobs.filter(j => !['Collected', 'Cancelled'].includes(j.status)).length ?? 0}</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="workshop-note"><span className="note-icon"><ShieldCheck size={23} /></span><strong>Good repairs start here.</strong><p>Appliances to heavy machinery.<br />Every job, taken care of.</p></div><NavLink className="settings-link" to="/settings" onClick={() => setMobile(false)}><Settings size={18} />Settings & backup</NavLink><div className="sidebar-footer"><span className="avatar shop-avatar">TN</span><div><strong>Thet Naing Service</strong><span>Mandalay, Myanmar</span></div></div></div>
    </aside>
    <div className="workspace"><header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobile(true)} aria-label="Open navigation" aria-expanded={mobile} aria-controls="workshop-navigation"><Menu size={22} /></button><div className="breadcrumbs">Workspace <span>/</span><strong>Workshop</strong></div><form className="global-search" onSubmit={e => { e.preventDefault(); navigate('/jobs?q=' + encodeURIComponent(search.current?.value ?? '')) }}><Search size={17} /><input ref={search} aria-label="Search all service jobs" placeholder="Search jobs, customers, equipment…" /><kbd>Enter</kbd></form><div className="topbar-actions"><Link className="mode-chip" to="/settings"><Cloud size={15} />{cloudConfigured ? 'Cloud workspace' : 'Local workspace'}</Link><div className="activity-wrap"><button className={'icon-button ' + (activity ? 'active' : '')} aria-label="Recent workshop activity" aria-expanded={activity} onClick={() => setActivity(!activity)}><Bell size={19} /></button>{activity && <div className="activity-popover"><header><strong>Workshop activity</strong><button className="icon-button" aria-label="Close activity" onClick={() => setActivity(false)}><X size={17} /></button></header>{entries.length ? entries.map(e => <button key={e.id} onClick={() => openJob(e.job.id, 'activity')}><span>{e.job.code}<small>{timeLabel(e.at)}</small></span><p>{e.text}</p></button>) : <p className="muted">New workshop activity will appear here.</p>}</div>}</div><Link to="/settings" className="avatar" aria-label="Workshop settings">TN</Link></div></header>
      {data?.demo && <div className="demo-banner"><span><span className="demo-dot" />You’re exploring sample workshop data.</span><Link to="/settings">Set up your workshop<ArrowUpRight size={14} /></Link></div>}
      {error && <div className="error-banner" role="alert"><span>{error}</span><div><button onClick={() => void refresh()}>Refresh data</button><button onClick={clearError} aria-label="Dismiss error"><X size={16} /></button></div></div>}
      <main className="main-content">{data ? <Outlet context={{openJob, newRequest: () => setNewJob(true)} satisfies AppActions} /> : <div className="empty-state"><CircleHelp size={36} /><h1>Workshop data needs attention</h1><p>{error || 'Refresh to reconnect to the workshop.'}</p><button className="button" onClick={() => void refresh()}>Try again</button>{!cloudConfigured && <button className="button" onClick={() => download('thet-naing-recovery.txt', localStorage.getItem(STORAGE_KEY) ?? '', 'text/plain')}><Download size={16} />Export original storage</button>}</div>}</main>
      <footer className="workspace-footer"><span><span className="online-dot" />{cloudConfigured ? 'Connected workspace' : 'Saved on this browser'}</span><span>Home appliances & industrial machines</span></footer>
    </div>
    {newJob && data && <NewJobSheet onClose={() => setNewJob(false)} onCreated={id => { setNewJob(false); openJob(id) }} />}
    {selected && data && <JobDrawer key={selected.id} id={selected.id} initialTab={selected.tab} onClose={() => setSelected(null)} />}
    {toast && <div className="toast" role="status"><ShieldCheck size={18} />{toast}</div>}
    {busy && <div className="saving-indicator" role="status">Saving…</div>}
  </div>
}
export function PageHeading({ title, description, action = true }: { title: string; description: string; action?: boolean }) { const { newRequest } = useActions(); return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action && <button className="button primary" onClick={newRequest}><Plus size={18} />New service request</button>}</div> }
