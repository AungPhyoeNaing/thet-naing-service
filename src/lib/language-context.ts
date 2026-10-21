import { createContext, useContext } from 'react'
import type { Language } from './translations'
export interface LanguageState { language: Language; setLanguage: (language: Language) => void; t: (text: string) => string }
export const LanguageContext = createContext<LanguageState | null>(null)
export function useLanguage() { const context = useContext(LanguageContext); if (!context) throw new Error('Missing language provider'); return context }
export const useText = () => useLanguage().t
