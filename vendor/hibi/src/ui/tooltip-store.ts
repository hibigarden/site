import type { TooltipApi, TooltipOptions } from './tooltips'

type ActiveTooltip = TooltipOptions & { owner: object }
let current: ActiveTooltip | null = null
const listeners = new Set<() => void>()
function publish(next: ActiveTooltip | null) {
  if (current === next) return
  current = next
  for (const listener of listeners) listener()
}
export function tooltipAnchorVisible(anchor: TooltipOptions['anchor']) {
  if (
    !anchor.isConnected ||
    anchor.ownerDocument.hidden ||
    anchor.closest('[hidden], [inert], [aria-hidden="true"]') ||
    !anchor.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  )
    return false
  const rect = anchor.getBoundingClientRect()
  const view = anchor.ownerDocument.defaultView
  return (
    !!view &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < view.innerHeight &&
    rect.left < view.innerWidth
  )
}
export function createTooltipScope() {
  const owner = {}
  let disposed = false
  const api: TooltipApi = {
    show(options) {
      if (
        disposed ||
        !options.text.trim() ||
        !tooltipAnchorVisible(options.anchor)
      )
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
  hide: (request?: ActiveTooltip) => {
    if (!request || current === request) publish(null)
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
