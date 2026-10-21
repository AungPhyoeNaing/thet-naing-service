import { readLanguage, translate, type Language } from './translations'
export const money = (amount: number, language: Language = readLanguage()) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount) + (language === 'my' ? ' ကျပ်' : ' Ks')
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Rangoon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
export function dateOffset(days: number) { const date = new Date(today() + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
const myMonths = ['ဇန်နဝါရီ','ဖေဖော်ဝါရီ','မတ်','ဧပြီ','မေ','ဇွန်','ဇူလိုင်','ဩဂုတ်','စက်တင်ဘာ','အောက်တိုဘာ','နိုဝင်ဘာ','ဒီဇင်ဘာ']
export function shortDate(date: string) {
  const language = readLanguage()
  if (!date) return translate('No date set',language)
  if (language === 'my') return `${Number(date.slice(8,10))} ${myMonths[Number(date.slice(5,7))-1]}`
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day:'numeric', month:'short', timeZone:'Asia/Rangoon' })
}
export function timeLabel(date: string) {
  const instant = new Date(date)
  if (readLanguage() === 'my') {
    const day = new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Rangoon'}).format(instant)
    const time = instant.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Rangoon'})
    return `${shortDate(day)}၊ ${time}`
  }
  return instant.toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Rangoon'})
}
export const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('')
export const uid = () => crypto.randomUUID()
export function download(name: string, body: string, type: string) { const url = URL.createObjectURL(new Blob([body], { type })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
export function csv(rows: (string | number)[][]) { return '\uFEFF' + rows.map(row => row.map(value => { let s = String(value); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"' }).join(',')).join('\r\n') }
export function csvForLanguage(rows: (string | number)[][]) {
  const language = readLanguage()
  return csv(rows.map((row,index) => index === 0 ? row.map(cell => translate(String(cell),language)) : row))
}
