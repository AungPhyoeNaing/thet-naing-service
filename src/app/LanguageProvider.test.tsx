// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LanguageProvider from './LanguageProvider'
import { AppProviders } from './providers'
import App from './App'
import { LANGUAGE_KEY } from '../lib/translations'
import { STORAGE_KEY } from '../data/local'
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open','') }
  HTMLDialogElement.prototype.close = function() { this.removeAttribute('open') }
})
beforeEach(() => { localStorage.clear(); window.history.replaceState(null,'','/') })
afterEach(cleanup)
const start = () => render(<LanguageProvider><AppProviders><App /></AppProviders></LanguageProvider>)
describe('worker language and intake', () => {
  it('starts in Burmese, remembers English and preserves saved workshop records', async () => {
    const view=start()
    await screen.findByRole('heading',{name:'ပြုပြင်ရမည့်အလုပ်များ'})
    const original=localStorage.getItem(STORAGE_KEY)
    fireEvent.click(screen.getByRole('button',{name:'English'}))
    await screen.findByRole('heading',{name:'Repairs to take care of'})
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original)
    view.unmount();start()
    await screen.findByRole('heading',{name:'Repairs to take care of'})
    fireEvent.click(screen.getByRole('button',{name:'မြန်မာ'}))
    await screen.findByRole('heading',{name:'ပြုပြင်ရမည့်အလုပ်များ'})
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original)
  })
  it('saves Burmese intake with optional details collapsed and canonical status/category values', async () => {
    start();await screen.findByRole('heading',{name:'ပြုပြင်ရမည့်အလုပ်များ'})
    fireEvent.click(screen.getByRole('button',{name:'ပြုပြင်အလုပ် အသစ်ထည့်ရန်'}))
    const dialog=screen.getByRole('dialog')
    const fill=(name: string,value: string)=>fireEvent.change(dialog.querySelector(`[name="${name}"]`)!,{target:{value}})
    fill('customer','စမ်းသပ် ဖောက်သည်');fill('phone','000-000-0000');fill('equipment','စမ်းသပ်စက်');fill('issue','စမ်းသပ်ရန် မလည်ပါ။')
    expect(dialog.querySelector('details')?.open).toBe(false)
    fireEvent.submit(dialog.querySelector('form')!)
    await waitFor(()=>expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).jobs).toHaveLength(12))
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)!).jobs[0]
    expect(saved.customer).toBe('စမ်းသပ် ဖောက်သည်');expect(saved.equipment).toBe('စမ်းသပ်စက်')
    expect(saved.category).toBe('Home appliance');expect(saved.status).toBe('Received');expect(saved.serviceType).toBe('Workshop drop-off')
  })
})
