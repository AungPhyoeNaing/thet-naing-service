// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import LanguageProvider from './LanguageProvider'
import { WorkshopContext, type AppState } from './workshop-context'
import { createSeed } from '../data/seed'
import { LANGUAGE_KEY } from '../lib/translations'
import JobDrawer from '../features/jobs/JobDrawer'
import type { WorkshopRole } from '../data/types'

vi.mock('../data/supabase', () => ({ cloudConfigured: true, client: {
  rpc: vi.fn().mockResolvedValue({data:[],error:null}),
  from: () => ({select: () => ({order: () => ({limit: async () => ({data:[],error:null})})})}),
} }))
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open','') }
  HTMLDialogElement.prototype.close = function() { this.removeAttribute('open') }
})
beforeEach(() => { localStorage.clear(); localStorage.setItem(LANGUAGE_KEY,'en'); window.history.replaceState(null,'','/') })
afterEach(cleanup)
function context(role: WorkshopRole): AppState {
  return { data:createSeed(), membership:{user_id:'worker-id',role,active:true,display_name:'Workshop user',technician_name:''}, isAdmin:role==='admin',signedIn:true,loading:false,busy:false,error:'',toast:'',mutate:vi.fn().mockResolvedValue(true),restoreBackup:vi.fn(),refresh:vi.fn(),notify:vi.fn(),clearError:vi.fn(),signOut:vi.fn() }
}
const wrap = (state: AppState, element: React.ReactNode) => <LanguageProvider><WorkshopContext.Provider value={state}>{element}</WorkshopContext.Provider></LanguageProvider>

describe('role-aware screens and repair handoffs', () => {
  it('shows only Today’s work and Repairs to Staff and keeps sign-out available', async () => {
    const state=context('staff'); render(wrap(state,<App />))
    expect(within(screen.getByRole('navigation',{name:'Main navigation'})).getAllByRole('link').map(link=>link.textContent)).toEqual(['Today’s work','Repairs10'])
    expect(screen.queryByRole('link',{name:'Settings & backup'})).toBeNull()
    expect(screen.queryByRole('button',{name:'Export'})).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'Sign out / Switch account'})); expect(state.signOut).toHaveBeenCalledOnce()
  })
  it.each(['/parts','/customers','/reports','/settings'])('redirects Staff away from a direct %s URL', async path => {
    window.history.replaceState(null,'',path); render(wrap(context('staff'),<App />))
    await screen.findByRole('heading',{name:'Today’s work'})
    await waitFor(()=>expect(window.location.pathname).toBe('/'))
  })
  it('keeps Admin navigation and nested route actions connected', async () => {
    window.history.replaceState(null,'','/customers'); render(wrap(context('admin'),<App />))
    expect(screen.getByRole('link',{name:'Reports'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'Add a repair'}))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('lets Staff prepare draft charges and shows the handoff before repair starts', () => {
    const state=context('staff'); const job=state.data!.jobs[0];job.status='Diagnosing'
    render(wrap(state,<JobDrawer id={job.id} initialTab="charges" onClose={()=>{}} />))
    expect(screen.getByRole('button',{name:'Save draft charges'})).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Save charges'})).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Waiting for Admin')
    expect(screen.queryByRole('button',{name:'Start repair'})).toBeNull()
  })
  it('prevents Staff editing finalized charges and recording payments or collection', () => {
    const state=context('staff');const job=state.data!.jobs[0]
    Object.assign(job,{status:'Ready to collect',estimateStatus:'Approved',lines:[{id:'line',description:'Labour',quantity:1,unitPrice:100}],checks:[true,true,true],paid:0})
    render(wrap(state,<JobDrawer id={job.id} initialTab="charges" onClose={()=>{}} />))
    expect(screen.queryByRole('button',{name:'Record payment'})).toBeNull()
    expect(screen.queryByRole('button',{name:'Save draft charges'})).toBeNull()
    expect(screen.getByRole('spinbutton',{name:'Unit price for Labour'}).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('Ask an Admin')
  })
  it('offers optional camera/gallery photos in repair details without a required file field', () => {
    const state=context('staff');const job=state.data!.jobs[0]
    const view=render(wrap(state,<JobDrawer id={job.id} initialTab="details" onClose={()=>{}} />))
    expect(screen.getByRole('button',{name:'Take photo'})).toBeTruthy()
    expect(screen.getByRole('button',{name:'Choose photo'})).toBeTruthy()
    const files=[...view.container.querySelectorAll<HTMLInputElement>('input[type="file"]')]
    expect(files).toHaveLength(2);expect(files.every(input=>!input.required)).toBe(true)
    expect(files[0].getAttribute('capture')).toBe('environment')
  })
})
