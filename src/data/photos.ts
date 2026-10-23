import { client } from './supabase'
export const PHOTO_BUCKET = 'workshop-photos'
export async function preparePhoto(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.')
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.')
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { throw new Error('This photo could not be opened. Try another image.') }
  try {
    const canvas = document.createElement('canvas'); const context = canvas.getContext('2d')!
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, (1280 * Math.pow(0.78, attempt)) / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78))
      if (blob && blob.size <= 220000) {
        const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob) })
        return { blob, dataUrl }
      }
    }
    throw new Error('This photo is too detailed to save. Try a smaller image.')
  } finally { bitmap.close() }
}
export async function photoUrl(path: string) {
  const { data, error } = await client!.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
