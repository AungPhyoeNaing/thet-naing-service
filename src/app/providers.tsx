import { useEffect, useRef, useState, type ReactNode } from 'react'
import { WorkshopContext as Context } from './workshop-context'
import type { WorkshopData } from '../data/types'
import { createLocalRepository } from '../data/local'
import { client, cloudConfigured, createCloudRepository } from '../data/supabase'
const repo = cloudConfigured ? createCloudRepository() : createLocalRepository(localStorage)
export function AppProviders({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkshopData | null>(null)
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false)
  const [error, setError] = useState(''); const [toast, setToast] = useState('')
  const [signedIn, setSignedIn] = useState(!cloudConfigured)
  const lock = useRef(false); const dataRef = useRef(data); dataRef.current = data
  async function refresh() { if (lock.current) return; try { setData(await repo.load()); setError('') } catch (e) { setError((e as Error).message) } finally { setLoading(false) } }
  useEffect(() => {
    if (!client) return
    void client.auth.getSession().then(({ data: session, error: err }) => { if (err) setError(err.message); setSignedIn(!!session.session); if (!session.session) setLoading(false) }).catch(() => { setError('Could not check your cloud session.'); setLoading(false) })
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => { setSignedIn(!!session); if (!session) { setData(null); setLoading(false) } })
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => { if (signedIn) { setLoading(true); void refresh() } }, [signedIn])
  useEffect(() => {
    if (!signedIn) return
    const update = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('storage', update); window.addEventListener('focus', update)
    const interval = cloudConfigured ? setInterval(update, 30000) : null
    return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update); if (interval) clearInterval(interval) }
  }, [signedIn])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer) }, [toast])
  async function mutate(fn: (data: WorkshopData) => void, message = 'Changes saved') {
    if (!dataRef.current || lock.current) return false
    lock.current = true; setBusy(true)
    try { const current = dataRef.current; const next = structuredClone(current); fn(next); const saved = await repo.save(next, current.revision); dataRef.current = saved; setData(saved); setError(''); setToast(message); return true }
    catch (e) { setError((e as Error).message); return false }
    finally { lock.current = false; setBusy(false) }
  }
  return <Context.Provider value={{ data, loading, busy, error, toast, signedIn, mutate, refresh, notify: setToast, clearError: () => setError('') }}>{children}</Context.Provider>
}
