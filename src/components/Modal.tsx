import { useText } from '../lib/language-context'
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useWorkshop } from '../app/workshop-context'
export default function Modal({ title, children, onClose, wide = false, drawer = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; drawer?: boolean }) {
  const tr = useText()

  const ref = useRef<HTMLDialogElement>(null)
  const { error, clearError } = useWorkshop()
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus(); const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; dialog.close() } }, [])
  return <dialog className={'modal ' + (wide ? 'wide ' : '') + (drawer ? 'drawer' : '')} ref={ref} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }} aria-labelledby="modal-title"><header className="modal-header"><h2 id="modal-title">{tr(title)}</h2><button className="icon-button" aria-label={tr("Close dialog")} onClick={onClose}><X size={20} /></button></header>{error && <div className="modal-error" role="alert"><p>{tr(error)}</p><button className="icon-button" aria-label={tr("Dismiss dialog error")} onClick={clearError}><X size={16} /></button></div>}{children}</dialog>
}
