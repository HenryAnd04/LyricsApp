import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Info, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { cx, uid } from '../lib/format'

type ToastKind = 'info' | 'success' | 'error'

interface ToastItem {
  id: string
  title: string
  message?: string
  kind: ToastKind
}

interface ToastApi {
  showToast: (title: string, options?: { message?: string; kind?: ToastKind }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, number>>(new Map())

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
  }, [])

  const showToast = useCallback<ToastApi['showToast']>(
    (title, options) => {
      const id = uid('toast')
      const item: ToastItem = {
        id,
        title,
        message: options?.message,
        kind: options?.kind || 'info',
      }
      setItems((prev) => [...prev.slice(-2), item])
      const timer = window.setTimeout(() => dismiss(id), options?.kind === 'error' ? 6000 : 4200)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((timer) => window.clearTimeout(timer))
      map.clear()
    }
  }, [])

  const api = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {items.map((item) => {
            const Icon = ICONS[item.kind]
            return (
              <div key={item.id} className={cx('toast', `toast--${item.kind}`)}>
                <Icon size={18} className="toast__icon" aria-hidden />
                <div className="toast__body">
                  <p className="toast__title">{item.title}</p>
                  {item.message && <p className="toast__message">{item.message}</p>}
                </div>
                <button
                  type="button"
                  className="toast__close"
                  onClick={() => dismiss(item.id)}
                  aria-label="Cerrar aviso"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}
