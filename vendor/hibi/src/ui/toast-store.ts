import {
  type ToastApi,
  type ToastOptions,
  type ToastPreferences,
  toastPositions,
} from './toasts'

export const defaultToastPreferences: ToastPreferences = {
  position: 'bottom-right',
  duration: 5000,
}
export function toastPreferences(
  value: Partial<ToastPreferences>,
): ToastPreferences {
  return {
    position:
      value.position && toastPositions.includes(value.position)
        ? value.position
        : defaultToastPreferences.position,
    duration:
      typeof value.duration === 'number' && Number.isFinite(value.duration)
        ? Math.max(0, Math.min(600000, value.duration))
        : defaultToastPreferences.duration,
  }
}
type Entry = ToastOptions & {
  id: number
  owner: object
  duration: number
  remaining: number
  deadline: number
  closing: boolean
  revision: number
  paused: Set<string>
  timer?: ReturnType<typeof setTimeout>
}

export function createToastService(
  initial = defaultToastPreferences,
  persist = (_value: ToastPreferences) => {},
) {
  const entries = new Map<number, Entry>()
  const listeners = new Set<() => void>()
  let preferences = toastPreferences(initial),
    active = true,
    nextId = 0
  let container: HTMLElement | null = null
  let snapshot: {
    items: Entry[]
    preferences: ToastPreferences
    container: HTMLElement | null
  } = { items: [], preferences, container }
  const publish = () => {
    snapshot = { items: [...entries.values()], preferences, container }
    for (const listener of listeners) listener()
  }
  const finish = (entry: Entry) => {
    clearTimeout(entry.timer)
    entries.delete(entry.id)
    publish()
  }
  const dismiss = (entry: Entry) => {
    if (!entries.has(entry.id) || entry.closing) return
    clearTimeout(entry.timer)
    entry.closing = true
    entry.timer = setTimeout(() => finish(entry), 160)
    publish()
  }
  const freeze = (entry: Entry) => {
    if (entry.timer && !entry.paused.size)
      entry.remaining = Math.max(0, entry.deadline - performance.now())
    clearTimeout(entry.timer)
    delete entry.timer
  }
  const schedule = (entry: Entry) => {
    entry.revision++
    if (entry.duration && !entry.paused.size) {
      entry.deadline = performance.now() + entry.remaining
      entry.timer = setTimeout(() => dismiss(entry), entry.remaining)
    }
  }
  function scope() {
    const owner = {},
      owned = () =>
        [...entries.values()].filter((entry) => entry.owner === owner)
    let disposed = false
    const api: ToastApi = {
      show(options) {
        if (disposed || !active || !options.message.trim())
          return { update() {}, dismiss() {} }
        const duration = toastPreferences({
          duration: options.duration ?? preferences.duration,
        }).duration
        const entry: Entry = {
          ...options,
          id: ++nextId,
          owner,
          duration,
          remaining: duration,
          deadline: 0,
          closing: false,
          revision: 0,
          paused: new Set(),
        }
        entries.set(entry.id, entry)
        schedule(entry)
        publish()
        return {
          update(changes) {
            if (disposed || !entries.has(entry.id) || entry.closing) return
            freeze(entry)
            if (changes.message !== undefined) entry.message = changes.message
            if (changes.description !== undefined)
              entry.description = changes.description
            if (changes.variant !== undefined) entry.variant = changes.variant
            if (changes.duration !== undefined) {
              entry.duration = toastPreferences({
                duration: changes.duration,
              }).duration
              entry.remaining = entry.duration
            }
            schedule(entry)
            publish()
          },
          dismiss: () => dismiss(entry),
        }
      },
      dismissAll: () => owned().forEach(dismiss),
      getPreferences: () => ({ ...preferences }),
      setPreferences(changes) {
        if (disposed || !active) return
        preferences = toastPreferences({ ...preferences, ...changes })
        persist(preferences)
        publish()
      },
    }
    return {
      api,
      dispose() {
        disposed = true
        owned().forEach(finish)
      },
    }
  }
  const root = scope()
  return {
    api: root.api,
    scope,
    snapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    pause(id: number, reason: string, paused: boolean) {
      const entry = entries.get(id)
      if (!entry || entry.closing || entry.paused.has(reason) === paused) return
      freeze(entry)
      if (paused) entry.paused.add(reason)
      else entry.paused.delete(reason)
      schedule(entry)
      publish()
    },
    dismiss(id: number) {
      const entry = entries.get(id)
      if (entry) dismiss(entry)
    },
    setContainer(next: HTMLElement | null) {
      if (next === container) return
      for (const entry of entries.values()) {
        if (entry.closing) continue
        freeze(entry)
        entry.paused.clear()
        schedule(entry)
      }
      container = next
      publish()
    },
    start() {
      active = true
    },
    stop() {
      active = false
      for (const entry of [...entries.values()]) finish(entry)
    },
  }
}
