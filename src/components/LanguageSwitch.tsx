import { useLanguage } from '../lib/language-context'
export default function LanguageSwitch() {
  const { language, setLanguage } = useLanguage()
  return <div className="language-switch" role="group" aria-label="ဘာသာစကား / Language">
    <button type="button" lang="my" aria-pressed={language === 'my'} onClick={() => setLanguage('my')}>မြန်မာ</button>
    <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
  </div>
}
