export const toastPositions = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const
export type ToastPosition = (typeof toastPositions)[number]
export type ToastPreferences = { position: ToastPosition; duration: number }
export type ToastOptions = {
  message: string
  description?: string
  variant?: 'info' | 'success' | 'error'
  /** Milliseconds; zero keeps the notification until dismissed. */
  duration?: number
}
export type ToastHandle = {
  update: (changes: Partial<ToastOptions>) => void
  dismiss: () => void
}
/** Shared sonner service. Addon scopes can only dismiss their own notifications. */
export type ToastApi = {
  show: (options: ToastOptions) => ToastHandle
  dismissAll: () => void
  getPreferences: () => ToastPreferences
  setPreferences: (changes: Partial<ToastPreferences>) => void
}
