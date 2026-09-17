import type { TooltipApi, TooltipOptions } from './tooltips'

type ActiveTooltip = TooltipOptions & { owner: object }
let current: ActiveTooltip | null = null
const listeners = new Set<() => void>()
function publish(next: ActiveTooltip | null) {
  current = next
  for (const listener of listeners) listener()
}
export function createTooltipScope() {
  const owner = {}
  let disposed = false
  const api: TooltipApi = {
    show(options) {
      if (disposed || !options.text || !options.anchor.isConnected)
        return () => {}
      const request = { ...options, owner }
      publish(request)
      return () => {
        if (current === request) publish(null)
      }
    },
    hide() {
      if (current?.owner === owner) publish(null)
    },
  }
  return {
    api,
    dispose() {
      disposed = true
      api.hide()
    },
  }
}
const root = createTooltipScope()
/** Built-ins can use this hook; addons receive a lifecycle-owned context.tooltips. */
export function useTooltips(): TooltipApi {
  return root.api
}
export const tooltipStore = {
  snapshot: () => current,
  hide: () => publish(null),
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
