import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/public-sans'
import '@fontsource/noto-sans-myanmar/400.css'
import './index.css'
import './refinements.css'
import App from './app/App'
import { AppProviders } from './app/providers'

createRoot(document.getElementById('root')!).render(<StrictMode><AppProviders><App /></AppProviders></StrictMode>)
