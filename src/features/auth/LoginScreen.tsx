import { useState, type FormEvent } from 'react'
import { Wrench, ArrowRight } from 'lucide-react'
import { client } from '../../data/supabase'
export default function LoginScreen() {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function signIn(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setBusy(true); setError(''); const f = new FormData(e.currentTarget); try { const { error: err } = await client!.auth.signInWithPassword({ email: String(f.get('email')).trim(), password: String(f.get('password')) }); if (err) throw err } catch (err) { setError((err as Error).message) } finally { setBusy(false) } }
  return <main className="login-page"><div className="login-brand"><div className="brand-symbol"><Wrench /></div><h1>Thet Naing Service</h1><p>Home appliances. Industrial machines.<br />One connected workshop.</p></div><form onSubmit={signIn} className="login-form"><h2>Welcome to the workshop</h2><p>Sign in with your approved staff account.</p><label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></button><small>Staff access is managed in your separate Supabase project.</small></form></main>
}
