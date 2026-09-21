import type { MenuApi, MenuItem } from './menus'

type OpenMenu = {
  owner: symbol
  label: string
  x: number
  y: number
  anchor: HTMLElement | null
  items: readonly MenuItem[]
}
let current: OpenMenu | null = null
const listeners = new Set<() => void>()
const publish = () => {
  for (const listener of listeners) listener()
}
export const menus = {
  snapshot: () => current,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  close() {
    current = null
    publish()
  },
  scope(onError: (error: unknown) => void) {
    const owner = Symbol('menu owner')
    let disposed = false
    const api: MenuApi = {
      open(options) {
        if (disposed) return { close() {} }
        const anchor =
          options.anchor instanceof HTMLElement ? options.anchor : null
        const point = anchor?.getBoundingClientRect()
        const coordinates = options.anchor as { x: number; y: number }
        const menu: OpenMenu = {
          owner,
          label: options.label,
          anchor,
          x: point?.left ?? coordinates.x,
          y: point?.bottom ?? coordinates.y,
          items: options.items.map((item) => ({
            ...item,
            async onSelect() {
              if (disposed || item.disabled) return
              menus.close()
              try {
                await item.onSelect()
              } catch (error) {
                onError(error)
              }
            },
          })),
        }
        current = menu
        publish()
        return {
          close() {
            if (current === menu) menus.close()
          },
        }
      },
    }
    return {
      api,
      dispose() {
        disposed = true
        if (current?.owner === owner) menus.close()
      },
    }
  },
}
