import { useEffect, useRef, useState, type ReactNode } from 'react'
import { WorkshopContext as Context } from './workshop-context'
import type { Membership, WorkshopData } from '../data/types'
import { createLocalRepository } from '../data/local'
import { client, cloudConfigured, createCloudRepository } from '../data/supabase'
const repo = cloudConfigured ? createCloudRepository() : createLocalRepository(localStorage)
const localMembership: Membership = { user_id: 'local', role: 'admin', active: true, display_name: 'Local workspace', technician_name: '' }
export function AppProviders({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkshopData | null>(null)
  const [membership, setMembership] = useState<Membership | null>(cloudConfigured ? null : localMembership)
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false)
  const [error, setError] = useState(''); const [toast, setToast] = useState('')
  const [userId, setUserId] = useState<string | null>(cloudConfigured ? null : 'local')
  const userRef = useRef(userId); const generation = useRef(0)
  const lock = useRef(false); const dataRef = useRef(data)
  const memberRef = useRef(membership)

  async function refresh() {
    if (lock.current) return
    const requestGeneration = generation.current
    const id = userRef.current
    if (!id) return
    try {
      let member = localMembership
      if (client) {
        const { data: result, error: failure } = await client.from('workshop_staff').select('user_id, role, active, display_name, technician_name').eq('user_id', id).single()
        if (failure || !result?.active || !['admin','staff'].includes(result.role)) throw new Error('Your account has no active workshop access. Ask an Admin.')
        member = result as Membership
      }
      const loaded = await repo.load()
      if (requestGeneration !== generation.current) return
      if (lock.current) return
      memberRef.current = member; setMembership(member)
      if (dataRef.current && loaded.revision < dataRef.current.revision) return
      dataRef.current = loaded; setData(loaded); setError('')
    } catch (e) {
      if (requestGeneration !== generation.current) return
      if (cloudConfigured) { dataRef.current = null; memberRef.current = null; setData(null); setMembership(null) }
      setError((e as Error).message)
    } finally { if (requestGeneration === generation.current) setLoading(false) }
  }
  useEffect(() => {
    if (!client) return
    let alive = true
    const acceptSession = (id: string | null) => {
      if (!alive || userRef.current === id) { if (alive && !id) setLoading(false); return }
      generation.current++; userRef.current = id
      dataRef.current = null; memberRef.current = null
      setData(null); setMembership(null); setToast(''); setError('')
      setLoading(!!id); setUserId(id)
    }
    // Subscribe first; do not let an older getSession result replace a newer event.
    let authEventReceived = false
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => { authEventReceived = true; acceptSession(session?.user.id ?? null) })
    void client.auth.getSession().then(({ data: session, error: err }) => {
      if (!alive || authEventReceived) return
      if (err) setError(err.message)
      acceptSession(session.session?.user.id ?? null)
    }).catch(() => { if (alive && !authEventReceived) { setError('Could not check your cloud session.'); setLoading(false) } })
    const invalidateRequests = () => { generation.current++ }
    return () => { alive = false; invalidateRequests(); listener.subscription.unsubscribe() }
  }, [])
  useEffect(() => { if (userId) void refresh() }, [userId])
  useEffect(() => {
    if (!userId) return
    const update = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('storage', update); window.addEventListener('focus', update)
    const interval = cloudConfigured ? setInterval(update, 30000) : null
    return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update); if (interval) clearInterval(interval) }
  }, [userId])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer) }, [toast])
  async function signOut() {
    if (!client) return
    const { error: failure } = await client.auth.signOut({ scope: 'local' })
    if (failure) { setError(failure.message); return }
    generation.current++; userRef.current = null; dataRef.current = null; memberRef.current = null
    setData(null); setMembership(null); setUserId(null); setLoading(false); setToast(''); setError('')
  }
  async function mutate(fn: (data: WorkshopData) => void, message = 'Changes saved', expectedUserId?: string, restore = false) {
    if (expectedUserId && expectedUserId !== userRef.current) return false
    if (!dataRef.current || !memberRef.current?.active || lock.current) return false
    const requestGeneration = generation.current; const member = memberRef.current
    if (restore && member.role !== 'admin') { setError('Admin access required for this action.'); return false }
    lock.current = true; setBusy(true)
    try {
      const current = dataRef.current; const next = structuredClone(current); fn(next)
      if (!cloudConfigured && !restore) for (const job of next.jobs) for (const event of job.history) {
        if (!current.jobs.find(j => j.id === job.id)?.history.some(h => h.id === event.id)) { event.actorId = member.user_id; event.actorName = member.display_name }
      }
      const saved = await repo.save(next, current.revision, current, member.role, restore)
      if (requestGeneration !== generation.current) return false
      dataRef.current = saved; setData(saved); setError(''); setToast(message); return true
    } catch (e) { if (requestGeneration === generation.current) setError((e as Error).message); return false }
    finally { lock.current = false; setBusy(false) }
  }
  const restoreBackup = (backup: WorkshopData) => mutate(state => Object.assign(state, backup), 'Workshop backup restored', undefined, true)
  return <Context.Provider value={{ data, membership, isAdmin: membership?.role === 'admin', signOut, restoreBackup, loading, busy, error, toast, signedIn: !!userId, mutate, refresh, notify: setToast, clearError: () => setError('') }}>{children}</Context.Provider>
}
