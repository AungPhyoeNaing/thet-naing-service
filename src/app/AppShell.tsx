import { useText } from '../lib/language-context'
import { useRef, useState } from 'react'
import LanguageSwitch from '../components/LanguageSwitch'
import WorkerHelp from '../components/WorkerHelp'
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom'
import { Activity, ArrowUpRight, Bell, CircleHelp, ClipboardList, Download, LayoutDashboard, LogOut, Menu, Package, Plus, Search, Settings, ShieldCheck, Users, Wrench, X } from 'lucide-react'
import { useWorkshop } from './workshop-context'
import { cloudConfigured } from '../data/supabase'
import { download, timeLabel } from '../lib/format'
import { STORAGE_KEY } from '../data/local'
import NewJobSheet from '../features/jobs/NewJobSheet'
import JobDrawer from '../features/jobs/JobDrawer'
export interface AppActions { openJob: (id: string, tab?: string) => void; newRequest: () => void }
export const useActions = () => useOutletContext<AppActions>()
const navigation = [
  { to: '/', label: 'Today’s work', icon: LayoutDashboard }, { to: '/jobs', label: 'Repairs', icon: ClipboardList },
  { to: '/parts', label: 'Parts inventory', icon: Package },
  { to: '/customers', label: 'Customers', icon: Users }, { to: '/reports', label: 'Reports', icon: Activity },
]
export default function AppShell() {
  const tr = useText()

  const { data, error, toast, busy, refresh, clearError, membership, isAdmin, signOut } = useWorkshop()
  const [newJob, setNewJob] = useState(false); const [selected, setSelected] = useState<{ id: string; tab: string } | null>(null)
  const [help, setHelp] = useState(false)
  const [mobile, setMobile] = useState(false); const [activity, setActivity] = useState(false)
  const navigate = useNavigate(); const search = useRef<HTMLInputElement>(null)
  const openJob = (id: string, tab = 'details') => { setSelected({ id, tab }); setActivity(false) }
  const entries = data?.jobs.flatMap(job => job.history.map(h => ({ ...h, job }))).sort((a,b) => b.at.localeCompare(a.at)).slice(0, 6) ?? []
  return <div className="app-shell">
    {mobile && <button className="nav-scrim" onClick={() => setMobile(false)} aria-label={tr("Close navigation")} />}
    <aside id="workshop-navigation" className={'sidebar ' + (mobile ? 'is-open' : '')}>
      <Link className="brand" to="/" onClick={() => setMobile(false)}><span className="brand-symbol"><Wrench size={23} /></span><span>{tr("Thet Naing")}<span className="brand-sub">{tr("Service & repair")}</span></span></Link>
      <nav aria-label={tr("Main navigation")}>{navigation.filter(item => isAdmin || ['/', '/jobs'].includes(item.to)).map(({to, label, icon: Icon}) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobile(false)}><Icon size={19} /><span>{tr(label)}</span>{to === '/jobs' && <span className="nav-count">{data?.jobs.filter(j => !['Collected', 'Cancelled'].includes(j.status)).length ?? 0}</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom">{isAdmin && <NavLink className="settings-link" to="/settings" onClick={() => setMobile(false)}><Settings size={18} />{tr("Settings & backup")}</NavLink>}<div className="sidebar-footer"><span className="avatar shop-avatar">{tr("TN")}</span><div><strong>{tr("Thet Naing Service")}</strong><span>{tr("Mandalay, Myanmar")}</span></div></div></div>
    </aside>
    <div className="workspace"><header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobile(true)} aria-label={tr("Open navigation")} aria-expanded={mobile} aria-controls="workshop-navigation"><Menu size={22} /></button><div className="breadcrumbs">{tr("Workspace")}{' '}<span>/</span><strong>{tr("Workshop")}</strong></div><form className="global-search" onSubmit={e => { e.preventDefault(); navigate('/jobs?q=' + encodeURIComponent(search.current?.value ?? '')) }}><Search size={17} /><input ref={search} aria-label={tr("Search all service jobs")} placeholder={tr("Search jobs, customers, equipment…")} /><kbd>{tr("Enter")}</kbd></form><div className="topbar-actions"><LanguageSwitch /><button className="button help-button" onClick={() => setHelp(true)}><CircleHelp size={18} />{tr('How to use')}</button><div className="activity-wrap"><button className={'icon-button ' + (activity ? 'active' : '')} aria-label={tr("Recent workshop activity")} aria-expanded={activity} onClick={() => setActivity(!activity)}><Bell size={19} /></button>{activity && <div className="activity-popover"><header><strong>{tr("Workshop activity")}</strong><button className="icon-button" aria-label={tr("Close activity")} onClick={() => setActivity(false)}><X size={17} /></button></header>{entries.length ? entries.map(e => <button key={e.id} onClick={() => openJob(e.job.id, 'activity')}><span>{e.job.code}<small>{timeLabel(e.at)}</small></span><p>{tr(e.text)}</p></button>) : <p className="muted">{tr("New workshop activity will appear here.")}</p>}</div>}</div><span className="account-label" title={membership?.display_name}>{membership?.display_name}<small>{tr(isAdmin ? 'Admin' : 'Staff')}</small></span>{cloudConfigured && <button className="icon-button" onClick={() => void signOut()} aria-label={tr("Sign out / Switch account")} title={tr("Sign out / Switch account")}><LogOut size={19} /></button>}</div></header>
      {data?.demo && <div className="demo-banner"><span><span className="demo-dot" />{tr("You’re exploring sample workshop data.")}</span>{isAdmin && <Link to="/settings">{tr("Set up your workshop")}<ArrowUpRight size={14} /></Link>}</div>}
      {error && <div className="error-banner" role="alert"><span>{tr(error)}</span><div><button onClick={() => void refresh()}>{tr("Refresh data")}</button><button onClick={clearError} aria-label={tr("Dismiss error")}><X size={16} /></button></div></div>}
      <main className="main-content">{data ? <Outlet context={{openJob, newRequest: () => setNewJob(true)} satisfies AppActions} /> : <div className="empty-state"><CircleHelp size={36} /><h1>{tr("Workshop data needs attention")}</h1><p>{tr(error || 'Refresh to reconnect to the workshop.')}</p><button className="button" onClick={() => void refresh()}>{tr("Try again")}</button>{!cloudConfigured && <button className="button" onClick={() => download('thet-naing-recovery.txt', localStorage.getItem(STORAGE_KEY) ?? '', 'text/plain')}><Download size={16} />{tr("Export original storage")}</button>}</div>}</main>

    </div>
    {help && <WorkerHelp onClose={() => setHelp(false)} />}
    {newJob && data && <NewJobSheet onClose={() => setNewJob(false)} onCreated={id => { setNewJob(false); openJob(id) }} />}
    {selected && data && <JobDrawer key={selected.id} id={selected.id} initialTab={selected.tab} onClose={() => setSelected(null)} />}
    {toast && <div className="toast" role="status"><ShieldCheck size={18} />{tr(toast)}</div>}
    {busy && <div className="saving-indicator" role="status">{tr("Saving…")}</div>}
  </div>
}
export function PageHeading({ title, action = true }: { title: string; description: string; action?: boolean }) {
  const tr = useText()
 const { newRequest } = useActions(); return <div className="page-heading"><div><h1>{tr(title)}</h1></div>{action && <button className="button primary" onClick={newRequest}><Plus size={18} />{tr("New service request")}</button>}</div> }
