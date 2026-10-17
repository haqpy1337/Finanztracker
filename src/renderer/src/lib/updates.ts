import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@shared/types'
import { api } from './api'

export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  useEffect(() => api.onUpdateStatus(setStatus), [])
  return status
}

export function useAppVersion(): string {
  const [version, setVersion] = useState('')
  useEffect(() => {
    void api.getVersion().then(setVersion)
  }, [])
  return version
}

export function describeUpdate(status: UpdateStatus): string {
  switch (status.state) {
    case 'checking':
      return 'Suche nach Updates …'
    case 'none':
      return 'Du verwendest die neueste Version.'
    case 'available':
      return `Version ${status.version} gefunden, Download startet …`
    case 'downloading':
      return `Version ${status.version} wird geladen (${status.percent} %)`
    case 'ready':
      return `Version ${status.version} ist bereit zur Installation.`
    case 'error':
      return status.message
    case 'disabled':
      return status.reason
    default:
      return 'Beim Start wird automatisch nach Updates gesucht.'
  }
}
