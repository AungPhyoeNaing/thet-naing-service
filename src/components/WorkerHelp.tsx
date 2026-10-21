import { ClipboardList, FileCheck2, PackageCheck } from 'lucide-react'
import Modal from './Modal'
import { useText } from '../lib/language-context'
export default function WorkerHelp({ onClose }: { onClose: () => void }) {
  const tr = useText()
  const steps = [
    { Icon: ClipboardList, title: '1. Receive the item', body: 'Write the customer name, phone, item and problem. Then save.' },
    { Icon: FileCheck2, title: '2. Agree the price and repair', body: 'Open the repair, add parts and labour, and tell the customer the total. Record their answer before repairing.' },
    { Icon: PackageCheck, title: '3. Check, collect money and return', body: 'Tick the three checks, record money received and mark the item collected.' },
  ]
  return <Modal title={tr('A simple guide for the workshop')} onClose={onClose} wide><div className="worker-help">
    {steps.map(({Icon,title,body}) => <section key={title}><span className="stat-icon blue"><Icon size={24} /></span><div><h3>{tr(title)}</h3><p>{tr(body)}</p></div></section>)}
    <p className="help-save-note">{tr('Your records are saved automatically after each save.')}</p>
    <button type="button" className="button primary" onClick={onClose}>{tr('Got it')}</button>
  </div></Modal>
}
