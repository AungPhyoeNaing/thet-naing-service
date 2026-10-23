import { useEffect, useState, type FormEvent } from 'react'
import { useWorkshop } from '../../app/workshop-context'
import { client, cloudConfigured } from '../../data/supabase'
import type { Membership } from '../../data/types'
import { useText } from '../../lib/language-context'
import { timeLabel } from '../../lib/format'

type Member = Membership & { email: string }
interface Audit { id: number; at: string; actor_name: string; action: string; revision: number | null }
async function fetchAccounts() {
  if (!client) return { members: [], audit: [] }
  const [accounts, history] = await Promise.all([client.rpc('list_workshop_members'), client.from('workshop_audit').select('id, at, actor_name, action, revision').order('id', { ascending: false }).limit(30)])
  if (accounts.error || history.error) throw new Error(accounts.error?.message ?? history.error!.message)
  return { members: accounts.data as Member[], audit: history.data as Audit[] }
}
export default function AccountsSection() {
  const tr = useText(); const { data, refresh, membership } = useWorkshop()
  const [members, setMembers] = useState<Member[]>([]); const [audit, setAudit] = useState<Audit[]>([])
  const [editing, setEditing] = useState<Member | null>(null); const [error, setError] = useState(''); const [pending, setPending] = useState(false)
  async function load() {
    try { const result = await fetchAccounts(); setMembers(result.members); setAudit(result.audit) }
    catch (failure) { setError((failure as Error).message) }
  }
  useEffect(() => {
    let alive = true
    void fetchAccounts().then(result => { if (alive) { setMembers(result.members); setAudit(result.audit) } }).catch(failure => { if (alive) setError((failure as Error).message) })
    return () => { alive = false }
  }, [])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const f = new FormData(form)
    setPending(true); setError('')
    try {
      const { error: failure } = await client!.rpc('manage_workshop_member', {
        member_email: String(f.get('email')).trim(), member_name: String(f.get('display_name')).trim(),
        member_role: String(f.get('role')), member_active: f.get('active') === 'on', member_technician: String(f.get('technician_name')),
      })
      if (failure) throw failure
      setEditing(null); form.reset(); await load(); await refresh()
    } catch (failure) { setError((failure as Error).message) }
    finally { setPending(false) }
  }
  return <section className="surface"><div className="surface-heading"><h2>{tr('Accounts & access')}</h2></div><div className="settings-body">
    {!cloudConfigured ? <p>{tr('Accounts require shared cloud mode. This local workspace has Admin access on this device.')}</p> : <>
      <p>{tr('Create each person in Supabase Auth first, then approve their email here. Each person uses their own password.')}</p>
      <div className="member-list">{members.map(member => <div className="member-row" key={member.user_id}><div><strong>{member.display_name || member.email}{member.user_id === membership?.user_id && ' · ' + tr('You')}</strong><small>{member.email} · {tr(member.role === 'admin' ? 'Admin' : 'Staff')} · {tr(member.active ? 'Active' : 'Disabled')}</small></div><button className="button compact" type="button" disabled={pending} onClick={() => setEditing(member)}>{tr('Edit access')}</button></div>)}</div>
      <form key={editing?.user_id ?? 'new'} className="account-form" onSubmit={save}>
        <h3>{tr(editing ? 'Edit account access' : 'Approve an account')}</h3><div className="form-grid">
          <label>{tr('Email')}<input name="email" type="email" required readOnly={!!editing} defaultValue={editing?.email ?? ''} /></label>
          <label>{tr('Display name')}<input name="display_name" required maxLength={120} defaultValue={editing?.display_name ?? ''} /></label>
          <label>{tr('Role')}<select name="role" defaultValue={editing?.role ?? 'staff'}><option value="staff">{tr('Staff')}</option><option value="admin">{tr('Admin')}</option></select></label>
          <label>{tr('Linked technician')}<select name="technician_name" defaultValue={editing?.technician_name ?? ''}><option value="">{tr('No technician link')}</option>{data!.technicians.map(name => <option key={name}>{name}</option>)}</select></label>
        </div><label className="check-row"><input name="active" type="checkbox" defaultChecked={editing?.active ?? true} />{tr('Allow workshop access')}</label>
        <div className="estimate-actions"><button className="button primary" disabled={pending}>{tr('Save account access')}</button>{editing && <button className="button" type="button" disabled={pending} onClick={() => setEditing(null)}>{tr('Cancel')}</button>}</div>
      </form>
      {error && <p className="form-error" role="alert">{tr(error)}</p>}
      <details className="optional-details"><summary>{tr('Recent access and repair audit')}</summary><button className="button compact" type="button" onClick={() => void load()}>{tr('Refresh data')}</button><div className="member-list">{audit.map(event => <div key={event.id}><strong>{event.actor_name} · {tr(event.action === 'manage_member' ? 'Account access updated' : ['admin_save','admin_restore'].includes(event.action) ? 'Workshop updated by Admin' : 'Repair updated by Staff')}</strong><small>{timeLabel(event.at)}{event.revision !== null && ' · #' + event.revision}</small></div>)}</div></details>
    </>}
  </div></section>
}
