export type InitializationTiming = {
  id: string
  name: string
  duration: number
  load: number | null
  start: number | null
  status: string
}
export type ActivityTiming = {
  owner: string
  operation: string
  kind: 'sync' | 'async'
  count: number
  failures: number
  total: number
  max: number
  p95: number
}
export type Stall = {
  kind: 'long-task' | 'frame-gap'
  start: number
  duration: number
  callbacks: string[]
}
export type DiagnosticsSnapshot = {
  enabled: boolean
  initializations: InitializationTiming[]
  activity: ActivityTiming[]
  stalls: Stall[]
  longTasks: number
  frameGaps: number
  longTasksSupported: boolean
}

/** Read existing startup measures, including addons initialized before recording began. */
export function initializationTimings(): InitializationTiming[] {
  const measures = performance.getEntriesByType(
    'measure',
  ) as PerformanceMeasure[]
  const byName = new Map(measures.map((entry) => [entry.name, entry]))
  return measures
    .filter((entry) => entry.name.startsWith('hibi:addon:'))
    .map((entry) => {
      const id = entry.name.slice('hibi:addon:'.length)
      const phase = (name: string) => {
        const measurement = byName.get(`hibi:addon-${name}:${id}`)
        return measurement &&
          measurement.startTime >= entry.startTime &&
          measurement.startTime + measurement.duration <=
            entry.startTime + entry.duration
          ? measurement.duration
          : null
      }
      return {
        id,
        name:
          typeof entry.detail?.addonName === 'string'
            ? entry.detail.addonName
            : id,
        duration: entry.duration,
        load: phase('load'),
        start: phase('start'),
        status:
          entry.detail?.status === 'failed' ||
          entry.detail?.status === 'cancelled'
            ? entry.detail.status
            : 'ready',
      }
    })
    .sort((a, b) => b.duration - a.duration)
}

const activity = new Map<
  string,
  Omit<ActivityTiming, 'p95'> & { samples: number[] }
>()
const stalls: Stall[] = []
const recentCallbacks: { start: number; duration: number; label: string }[] = []
const listeners = new Set<() => void>()
let enabled = false
let epoch = 0
let longTasks = 0
let frameGaps = 0
let clearedAt = 0
let snapshot: DiagnosticsSnapshot = {
  enabled: false,
  initializations: [],
  activity: [],
  stalls: [],
  longTasks: 0,
  frameGaps: 0,
  longTasksSupported: false,
}
const longTasksSupported = () =>
  typeof PerformanceObserver !== 'undefined' &&
  PerformanceObserver.supportedEntryTypes.includes('longtask')
function publish() {
  snapshot = {
    enabled,
    initializations: initializationTimings(),
    activity: [...activity.values()]
      .map(({ samples, ...entry }) => ({
        ...entry,
        p95:
          [...samples].sort((a, b) => a - b)[
            Math.max(0, Math.ceil(samples.length * 0.95) - 1)
          ] ?? 0,
      }))
      .sort((a, b) => b.max - a.max),
    stalls: stalls.map((entry) => ({
      ...entry,
      callbacks: [...entry.callbacks],
    })),
    longTasks,
    frameGaps,
    longTasksSupported: longTasksSupported(),
  }
  for (const listener of listeners) listener()
}
function record(
  owner: string,
  operation: string,
  kind: ActivityTiming['kind'],
  start: number,
  failed: boolean,
  token: number,
) {
  if (!enabled || token !== epoch) return
  const duration = performance.now() - start
  const key = `${owner}:${operation}:${kind}`
  const current = activity.get(key) ?? {
    owner,
    operation,
    kind,
    count: 0,
    failures: 0,
    total: 0,
    max: 0,
    samples: [],
  }
  current.count++
  current.failures += Number(failed)
  current.total += duration
  current.max = Math.max(current.max, duration)
  current.samples.push(duration)
  if (current.samples.length > 120) current.samples.shift()
  activity.delete(key)
  activity.set(key, current)
  if (activity.size > 128) activity.delete(activity.keys().next().value!)
  if (kind === 'sync' && duration >= 8) {
    recentCallbacks.push({ start, duration, label: `${owner}: ${operation}` })
    if (recentCallbacks.length > 120) recentCallbacks.shift()
  }
}
function stall(kind: Stall['kind'], start: number, duration: number) {
  if (!enabled || start < clearedAt) return
  if (kind === 'long-task') longTasks++
  else frameGaps++
  const callbacks = [
    ...new Set(
      recentCallbacks
        .filter(
          (entry) =>
            entry.start < start + duration &&
            entry.start + entry.duration > start,
        )
        .map((entry) => entry.label),
    ),
  ]
  stalls.push({ kind, start, duration, callbacks })
  if (stalls.length > 60) stalls.shift()
}

/** Shared instrumentation; observers and timers exist only while the diagnostics addon runs. */
export const performanceDiagnostics = {
  snapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  measure<T>(owner: string, operation: string, run: () => T): T {
    if (!enabled) return run()
    const start = performance.now(),
      token = epoch
    try {
      const value = run()
      if (value instanceof Promise) {
        void Promise.resolve(value).then(
          () => record(owner, operation, 'async', start, false, token),
          () => record(owner, operation, 'async', start, true, token),
        )
      } else record(owner, operation, 'sync', start, false, token)
      return value
    } catch (error) {
      record(owner, operation, 'sync', start, true, token)
      throw error
    }
  },
  clear() {
    epoch++
    clearedAt = performance.now()
    activity.clear()
    stalls.length = 0
    recentCallbacks.length = 0
    longTasks = frameGaps = 0
    publish()
  },
  start() {
    if (enabled) return () => {}
    enabled = true
    epoch++
    let observer: PerformanceObserver | undefined
    if (longTasksSupported()) {
      observer = new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries())
          stall('long-task', entry.startTime, entry.duration)
      })
      observer.observe({ type: 'longtask' })
    }
    let frame = 0,
      previous = 0
    const resetFrame = () => {
      previous = 0
    }
    if (typeof document !== 'undefined')
      document.addEventListener('visibilitychange', resetFrame)
    const sample = (now: number) => {
      if (!enabled) return
      if (document.hidden) previous = 0
      else {
        if (previous && now - previous >= 50)
          stall('frame-gap', previous, now - previous)
        previous = now
      }
      frame = requestAnimationFrame(sample)
    }
    if (typeof requestAnimationFrame === 'function')
      frame = requestAnimationFrame(sample)
    const timer = setInterval(publish, 1000)
    let stopped = false
    publish()
    return () => {
      if (stopped) return
      stopped = true
      enabled = false
      epoch++
      clearInterval(timer)
      if (frame) cancelAnimationFrame(frame)
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', resetFrame)
      observer?.disconnect()
      publish()
    }
  },
}
