import { useWorkshop } from '../app/workshop-context'
import { ClipboardList, FileCheck2, PackageCheck } from 'lucide-react'
import Modal from './Modal'
import { useText } from '../lib/language-context'
export default function WorkerHelp({ onClose }: { onClose: () => void }) {
  const tr = useText(); const { isAdmin } = useWorkshop()
  const steps = [
    { Icon: ClipboardList, title: '1. Receive the item', body: 'Write the customer name, phone, item and problem. Then save.' },
    { Icon: FileCheck2, title: '2. Repair the item', body: isAdmin ? 'Start the repair and record the parts and labour used.' : 'Prepare draft charges. Ask Admin to finalize them, then start the repair.' },
    { Icon: PackageCheck, title: isAdmin ? '3. Check, collect money and return' : '3. Check and hand over', body: isAdmin ? 'Tick the three checks, record money received and mark the item collected.' : 'Complete the three checks and mark ready. Admin records payment and collection.' },
  ]
  return <Modal title={tr('A simple guide for the workshop')} onClose={onClose} wide><div className="worker-help">
    {steps.map(({Icon,title,body}) => <section key={title}><span className="stat-icon blue"><Icon size={24} /></span><div><h3>{tr(title)}</h3><p>{tr(body)}</p></div></section>)}
    <p className="help-save-note">{tr("Photos are optional. Add them from repair details or an existing inventory part.")}</p><p className="help-save-note">{tr('Your records are saved automatically after each save.')}</p>
    <button type="button" className="button primary" onClick={onClose}>{tr('Got it')}</button>
  </div></Modal>
}
