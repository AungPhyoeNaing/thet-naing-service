import { useState, type FormEvent } from 'react'
import { ArrowRight, ClipboardPlus } from 'lucide-react'
import Modal from '../../components/Modal'
import { useWorkshop } from '../../app/workshop-context'
import { useText } from '../../lib/language-context'
import { createJob } from '../../data/operations'
import { dateOffset } from '../../lib/format'
import type { JobDraft } from '../../data/types'
export default function NewJobSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const tr = useText()
  const { data, mutate, busy } = useWorkshop()
  const [error, setError] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const draft = Object.fromEntries(new FormData(e.currentTarget).entries()) as unknown as JobDraft
    let id = ''
    setError('')
    if (await mutate(state => { id = createJob(state, draft).id }, 'Service request created')) onCreated(id)
    else setError('The request could not be saved. Check the error message and try again.')
  }
  return <Modal title={tr('New service request')} onClose={onClose} wide>
    <form onSubmit={submit} className="modal-form easy-intake">
      <div className="form-intro"><span className="equipment-icon"><ClipboardPlus size={25} /></span><div><h3>{tr('Tell us what needs fixing.')}</h3><p>{tr('Only four details are required. The other details are optional.')}</p></div></div>
      <div className="form-grid intake-required">
        <label>{tr('Customer or business name *')}<input name="customer" required data-autofocus maxLength={120} placeholder={tr('Customer or business name')} autoComplete="name" /></label>
        <label>{tr('Phone number *')}<input name="phone" type="tel" required maxLength={40} placeholder={tr('09 …')} autoComplete="tel" /></label>
        <label className="full-width">{tr('Equipment *')}<input name="equipment" required maxLength={120} placeholder={tr('e.g. Washing machine, electric motor')} /></label>
        <label className="full-width">{tr('Reported problem *')}<textarea name="issue" required maxLength={3000} rows={3} placeholder={tr('What happens, and when did it start?')} /></label>
      </div>
      <p className="muted small">{tr("After saving, you can add optional intake photos in Repair details.")}</p><details className="optional-details"><summary>{tr('More details (optional)')}</summary><div className="form-grid">
        <label>{tr('Category')}<select name="category" defaultValue="Home appliance"><option value="Home appliance">{tr('Home appliance')}</option><option value="Industrial machine">{tr('Industrial machine')}</option></select></label>
        <label>{tr('Service type')}<select name="serviceType"><option value="Workshop drop-off">{tr('Workshop drop-off')}</option><option value="On-site visit">{tr('On-site visit')}</option></select></label>
        <label>{tr('Priority')}<select name="priority"><option value="Normal">{tr('Normal')}</option><option value="High">{tr('High')}</option><option value="Urgent">{tr('Urgent')}</option></select></label>
        <label>{tr('Assign technician')}<select name="technician"><option value="">{tr('Unassigned')}</option>{data!.technicians.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <label>{tr('Target date')}<input name="dueDate" type="date" defaultValue={dateOffset(2)} /></label>
        <label>{tr('Brand & model')}<input name="brand" maxLength={120} placeholder={tr('e.g. Samsung WW80')} /></label>
        <label>{tr('Serial number')}<input name="serial" maxLength={120} placeholder={tr('If available')} /></label>
        <label className="full-width">{tr('Address / service location')}<input name="address" maxLength={300} placeholder={tr('Street, township, city')} /></label>
      </div></details>
      {error && <p className="form-error" role="alert">{tr(error)}</p>}
      <footer className="modal-actions"><button type="button" className="button" onClick={onClose}>{tr('Cancel')}</button><button className="button primary" disabled={busy}>{tr('Create service request')}<ArrowRight size={18} /></button></footer>
    </form>
  </Modal>
}
