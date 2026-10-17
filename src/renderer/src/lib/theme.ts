import { createContext, useContext, useEffect, useState } from 'react'
import type { ThemePreference } from '@shared/types'
import { api } from './api'

const query = '(prefers-color-scheme: dark)'

/** Applies the theme preference to the document and returns whether dark mode is active. */
export function useAppliedTheme(preference: ThemePreference): boolean {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const dark = preference === 'dark' || (preference === 'system' && systemDark)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    void api.setTheme(preference)
  }, [dark, preference])

  return dark
}

export const DarkContext = createContext(false)

export function useDark(): boolean {
  return useContext(DarkContext)
}
