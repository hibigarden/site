import { Check, CircleAlert, Info, X } from 'lucide-react'
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './Controls'
import {
  createToastService,
  defaultToastPreferences,
  toastPreferences,
} from './toast-store'
import './sonner.css'

type ToastService = ReturnType<typeof createToastService>
const ToastContext = createContext<ToastService | null>(null)
export function useToastService() {
  const service = useContext(ToastContext)
  if (!service) throw new Error('toasts require a ToastProvider')
  return service
}
/** Built-ins use this hook; extensions receive lifecycle-owned context.toasts. */
export function useToasts() {
  return useToastService().api
}

/** Keep notifications interactive in the active native modal's top layer. */
export function useToastContainer(ref: RefObject<HTMLDialogElement | null>) {
  const service = useContext(ToastContext)
  useLayoutEffect(() => {
    service?.setContainer(ref.current)
    return () => service?.setContainer(null)
  }, [service, ref])
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [service] = useState(() => {
    let initial = defaultToastPreferences
    try {
      initial = toastPreferences(
        JSON.parse(localStorage.getItem('toast-preferences') ?? '{}'),
      )
    } catch {
      /* Use defaults for unreadable preferences. */
    }
    return createToastService(initial, (preferences) =>
      localStorage.setItem('toast-preferences', JSON.stringify(preferences)),
    )
  })
  useLayoutEffect(() => {
    service.start()
    return () => service.stop()
  }, [service])
  return (
    <ToastContext.Provider value={service}>
      {children}
      <Sonner />
    </ToastContext.Provider>
  )
}

/** The single notification stack, shared by the app and every extension. */
export function Sonner() {
  const service = useToastService()
  const { items, preferences, container } = useSyncExternalStore(
    service.subscribe,
    service.snapshot,
  )
  const element = useRef<HTMLElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: changing the portal container creates a new popover element.
  useLayoutEffect(() => {
    const node = element.current
    if (items.length && node && !node.matches(':popover-open'))
      node.showPopover()
  }, [items.length, container])
  if (!items.length) return null
  return createPortal(
    <section
      ref={element}
      popover="manual"
      className="sonner"
      data-position={preferences.position}
      aria-label="notifications"
    >
      {items.map((item) => {
        const Icon =
          item.variant === 'error'
            ? CircleAlert
            : item.variant === 'success'
              ? Check
              : Info
        return (
          <div
            key={item.id}
            className="toast"
            data-closing={item.closing}
            data-variant={item.variant ?? 'info'}
            onPointerEnter={() => service.pause(item.id, 'hover', true)}
            onPointerLeave={() => service.pause(item.id, 'hover', false)}
            onFocusCapture={() => service.pause(item.id, 'focus', true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                service.pause(item.id, 'focus', false)
            }}
          >
            <Icon className="toast-icon" aria-hidden="true" />
            <div
              className="toast-copy"
              role={item.variant === 'error' ? 'alert' : 'status'}
              aria-atomic="true"
            >
              <span>{item.message}</span>
              {item.description && <p>{item.description}</p>}
            </div>
            <IconButton
              aria-label={
                item.variant === 'error' ? 'dismiss error' : 'dismiss notice'
              }
              onClick={() => service.dismiss(item.id)}
            >
              <X aria-hidden="true" />
            </IconButton>
            {item.duration > 0 && (
              <div
                key={item.revision}
                className="toast-progress"
                aria-hidden="true"
                data-paused={!!item.paused.size}
                style={
                  {
                    '--toast-progress': item.remaining / item.duration,
                    '--toast-remaining': `${item.remaining}ms`,
                  } as CSSProperties
                }
              />
            )}
          </div>
        )
      })}
    </section>,
    container ?? document.body,
  )
}
