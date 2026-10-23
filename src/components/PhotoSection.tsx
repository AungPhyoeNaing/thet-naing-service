import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { useWorkshop } from '../app/workshop-context'
import { client } from '../data/supabase'
import { photoStages, type WorkshopPhoto } from '../data/types'
import { PHOTO_BUCKET, photoUrl, preparePhoto } from '../data/photos'
import { note } from '../data/operations'
import { useText } from '../lib/language-context'
import { timeLabel, uid } from '../lib/format'

export default function PhotoSection({ kind, id }: { kind: 'jobs' | 'parts'; id: string }) {
  const tr = useText(); const { data, membership, isAdmin, busy, mutate } = useWorkshop()
  const entity = data![kind].find(item => item.id === id)
  const photos = entity?.photos ?? []
  const jobStatus = data!.jobs.find(job => job.id === id)?.status
  const initialStage = kind === 'parts' ? 'Inventory' : jobStatus === 'Received' ? 'Intake' : jobStatus === 'Diagnosing' ? 'Diagnosis' : jobStatus === 'Ready to collect' ? 'Quality check' : 'Repair'
  const [stage, setStage] = useState<WorkshopPhoto['stage']>(initialStage)
  const [caption, setCaption] = useState(''); const [pending, setPending] = useState(false); const [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null); const gallery = useRef<HTMLInputElement>(null)
  const maximum = kind === 'jobs' ? 8 : 4
  const canAdd = !!membership && (isAdmin || kind === 'jobs') && (kind !== 'jobs' || !['Collected','Cancelled'].includes(data!.jobs.find(j => j.id === id)!.status))
  async function upload(file: File | undefined) {
    if (!file || !membership || !canAdd || pending || photos.length >= maximum) return
    setPending(true); setError('')
    try {
      const prepared = await preparePhoto(file); const photoId = uid()
      const photo: WorkshopPhoto = { id: photoId, name: file.name.slice(0, 200), stage, caption: caption.trim(), createdAt: new Date().toISOString(), uploadedBy: membership.user_id }
      if (client) {
        const uploadedPath = `${kind}/${id}/${membership.user_id}/${photoId}.jpg`
        const { error: failure } = await client.storage.from(PHOTO_BUCKET).upload(uploadedPath, prepared.blob, { contentType: 'image/jpeg', upsert: false })
        if (failure) throw failure
        photo.storagePath = uploadedPath
      } else photo.dataUrl = prepared.dataUrl
      const saved = await mutate(state => {
        const target = state[kind].find(item => item.id === id)
        if (!target || (target.photos?.length ?? 0) >= maximum) throw new Error('Photo limit reached.')
        target.photos = [...(target.photos ?? []), photo]
        if (kind === 'jobs') note(state.jobs.find(job => job.id === id)!, 'Repair photo added.')
      }, 'Photo saved', membership.user_id)
      if (!saved) throw new Error('Photo was not attached. Refresh the workshop and try again.')
      setCaption('')
    } catch (failure) {
      setError((failure as Error).message)
      // Private unlinked uploads can be cleaned up later by the workshop owner.
      // Retain an uncertain upload: the database may have committed before a network failure.
    } finally { setPending(false) }
  }
  async function remove(photo: WorkshopPhoto) {
    setPending(true); setError('')
    try {
      const saved = await mutate(state => {
        const target = state[kind].find(item => item.id === id)!
        target.photos = target.photos?.filter(p => p.id !== photo.id)
        if (kind === 'jobs') note(state.jobs.find(job => job.id === id)!, 'Repair photo removed.')
      }, 'Photo removed')
      if (saved) setRemoving(null)
      // Cloud originals remain private for audit/backup recovery. No destructive
      // storage delete follows a successful attachment or removal.
    } catch (failure) { setError((failure as Error).message) }
    finally { setPending(false) }
  }
  return <section className="detail-section photo-section"><div className="section-heading"><h3>{tr('Photos (optional)')}</h3><span className="subtle-tag">{photos.length}/{maximum}</span></div>
    <p className="muted small">{tr(kind === 'jobs' ? 'Record item condition, findings, repair progress, or final checks.' : 'Add a clear photo of the part, label, or packaging.')}</p>
    {!!photos.length && <div className="photo-grid">{photos.map(photo => <figure key={photo.id}><PhotoImage photo={photo} /><figcaption><strong>{tr(photo.stage)}</strong>{photo.caption && <p>{photo.caption}</p>}<small>{timeLabel(photo.createdAt)}</small></figcaption>{canAdd && (isAdmin || photo.uploadedBy === membership?.user_id) && <>{removing === photo.id ? <div className="photo-remove-confirm"><span>{tr('Remove this photo?')}</span><button type="button" className="button compact" disabled={pending || busy} onClick={() => void remove(photo)}>{tr('Remove photo')}</button><button type="button" className="text-button" onClick={() => setRemoving(null)}>{tr('Cancel')}</button></div> : <button type="button" className="button compact" disabled={pending || busy} aria-label={tr('Remove photo')} onClick={() => setRemoving(photo.id)}><Trash2 size={14} />{tr('Remove photo')}</button>}</>}</figure>)}</div>}
    {canAdd && photos.length < maximum && <div className="photo-upload"><div className="form-grid">{kind === 'jobs' && <label>{tr('Photo stage')}<select value={stage} onChange={e => setStage(e.target.value as WorkshopPhoto['stage'])}>{photoStages.filter(s => s !== 'Inventory').map(s => <option key={s} value={s}>{tr(s)}</option>)}</select></label>}<label>{tr('Photo note (optional)')}<input value={caption} maxLength={300} onChange={e => setCaption(e.target.value)} placeholder={tr('What does this photo show?')} /></label></div><div className="photo-buttons"><button type="button" className="button compact" disabled={pending || busy} onClick={() => camera.current?.click()}><Camera size={16} />{tr('Take photo')}</button><button type="button" className="button compact" disabled={pending || busy} onClick={() => gallery.current?.click()}><ImagePlus size={16} />{tr('Choose photo')}</button><span className="muted small">{tr(pending ? 'Saving photo…' : 'JPG, PNG, WebP · up to 10 MB. Photos are resized before saving.')}</span></div><input ref={camera} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label={tr('Take photo')} onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} /><input ref={gallery} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label={tr('Choose photo')} onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} /></div>}
    {error && <p className="form-error" role="alert">{tr(error)}</p>}
  </section>
}
function PhotoImage({ photo }: { photo: WorkshopPhoto }) {
  const tr = useText(); const [url, setUrl] = useState(photo.dataUrl ?? ''); const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!photo.storagePath) return
    let alive = true
    const load = () => { void photoUrl(photo.storagePath!).then(value => { if (alive) { setUrl(value); setFailed(false) } }).catch(() => { if (alive) setFailed(true) }) }
    load(); const timer = setInterval(load, 45 * 60 * 1000)
    return () => { alive = false; clearInterval(timer) }
  }, [photo.storagePath])
  return failed ? <p role="status">{tr('Photo unavailable. Check your connection and reopen this repair.')}</p> : url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={photo.caption || photo.name} loading="lazy" onError={() => setFailed(true)} /></a> : <p>{tr('Loading photo…')}</p>
}
