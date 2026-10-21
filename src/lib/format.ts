export const money = (amount: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount) + ' Ks'
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Rangoon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
export function dateOffset(days: number) { const date = new Date(today() + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
export function shortDate(date: string) { return date ? new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Rangoon' }) : 'No date set' }
export function timeLabel(date: string) { return new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Rangoon' }) }
export const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('')
export const uid = () => crypto.randomUUID()
export function download(name: string, body: string, type: string) { const url = URL.createObjectURL(new Blob([body], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
export function csv(rows: (string | number)[][]) { return '\uFEFF' + rows.map(row => row.map(value => { let s = String(value); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"' }).join(',')).join('\r\n') }
