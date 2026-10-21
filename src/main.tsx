import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/public-sans'
import '@fontsource/noto-sans-myanmar/400.css'
import '@fontsource/noto-sans-myanmar/500.css'
import '@fontsource/noto-sans-myanmar/600.css'
import './index.css'
import './refinements.css'
import './worker-ui.css'
import App from './app/App'
import { AppProviders } from './app/providers'
import LanguageProvider from './app/LanguageProvider'

createRoot(document.getElementById('root')!).render(<StrictMode><LanguageProvider><AppProviders><App /></AppProviders></LanguageProvider></StrictMode>)
