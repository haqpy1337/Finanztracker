import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastState {
  message: string
  actionLabel?: string
  action?: () => void
}

const ToastContext = createContext<(toast: ToastState) => void>(() => undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((next: ToastState) => {
    window.clearTimeout(timer.current)
    setToast(next)
    timer.current = window.setTimeout(() => setToast(null), next.action ? 6000 : 3000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast.message}
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.()
                setToast(null)
              }}
            >
              {toast.actionLabel ?? 'Rückgängig'}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
