import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from '@/lib/store'
import { ToastProvider } from '@/lib/toast'
import { EntryEditorProvider } from '@/components/EntryEditor'
import { App } from './App'
import { applyInitialTheme } from '@/lib/theme'
import './styles.css'

applyInitialTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <EntryEditorProvider>
          <App />
        </EntryEditorProvider>
      </ToastProvider>
    </StoreProvider>
  </StrictMode>
)
