import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useWorkshop } from '../app/providers'
export default function Modal({ title, children, onClose, wide = false, drawer = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { error, clearError } = useWorkshop()
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; dialog.close() } }, [])
  return <dialog className={'modal ' + (wide ? 'wide ' : '') + (drawer ? 'drawer' : '')} ref={ref} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }} aria-labelledby="modal-title"><header className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></header>{error && <div className="modal-error" role="alert"><p>{error}</p><button className="icon-button" aria-label="Dismiss dialog error" onClick={clearError}><X size={16} /></button></div>}{children}</dialog>
}
