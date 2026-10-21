import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LanguageContext } from '../lib/language-context'
import { LANGUAGE_KEY, readLanguage, translate, type Language } from '../lib/translations'
export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, changeLanguage] = useState<Language>(readLanguage)
  const value = useMemo(() => ({ language, setLanguage: (next: Language) => {
    try { localStorage.setItem(LANGUAGE_KEY, next) } catch { /* A blocked preference write must not block using the app. */ }
    changeLanguage(next)
  }, t: (text: string) => translate(text, language) }), [language])
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dataset.language = language
    document.title = language === 'my' ? 'သက်နိုင် ပြုပြင်ရေး | ဆိုင်စာရင်း' : 'Thet Naing Service | Repairs'
    const onInvalid = (event: Event) => {
      const field = event.target
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return
      let message = 'Check this value and try again.'
      if (field.validity.valueMissing) message = 'Please fill in this field.'
      else if (field.validity.typeMismatch) message = 'Enter a valid email address.'
      else if (field.validity.stepMismatch || field.validity.badInput) message = 'Enter a whole number.'
      else if (field.validity.rangeUnderflow) message = 'The amount is below the allowed minimum.'
      else if (field.validity.rangeOverflow) message = 'The amount is more than the remaining balance or allowed maximum.'
      field.setCustomValidity(translate(message,language))
    }
    const onInput = (event: Event) => {
      const field = event.target
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.setCustomValidity('')
    }
    // Language changes must also update validation that was previously shown.
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select').forEach(field => field.setCustomValidity(''))
    document.addEventListener('invalid',onInvalid,true)
    document.addEventListener('input',onInput,true)
    document.addEventListener('change',onInput,true)
    return () => { document.removeEventListener('invalid',onInvalid,true); document.removeEventListener('input',onInput,true); document.removeEventListener('change',onInput,true) }
  }, [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
