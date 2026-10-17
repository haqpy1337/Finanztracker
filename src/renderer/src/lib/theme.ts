import { createContext, useContext, useEffect, useState } from 'react'
import type { ThemePreference } from '@shared/types'
import { api } from './api'

const query = '(prefers-color-scheme: dark)'
const THEME_KEY = 'finanztracker-theme'

/** Applies the last used theme before the data is loaded, so the start-up screen matches. */
export function applyInitialTheme(): void {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(THEME_KEY)
  } catch {
    // ignore
  }
  const dark = stored ? stored === 'dark' : window.matchMedia(query).matches
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

/** Applies the theme preference to the document and returns whether dark mode is active. */
export function useAppliedTheme(preference: ThemePreference, active = true): boolean {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const dark = preference === 'dark' || (preference === 'system' && systemDark)

  useEffect(() => {
    if (!active) return
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try {
      localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
    } catch {
      // only used to avoid a flash of the wrong theme at start-up
    }
    void api.setTheme(preference)
  }, [dark, preference, active])

  return dark
}

export const DarkContext = createContext(false)

export function useDark(): boolean {
  return useContext(DarkContext)
}
