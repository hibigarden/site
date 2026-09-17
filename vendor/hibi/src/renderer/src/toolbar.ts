import type {
  ToolbarApi,
  ToolbarItem,
  ToolbarPreferences,
} from '../../ui/toolbar'

const key = 'hibi:toolbar'
const validOrder = (value: unknown): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === 'string' &&
              /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(id),
          ),
        ),
      ]
    : []
let preferences: ToolbarPreferences = {
  visible: true,
  mode: 'icons',
  autoHide: true,
}
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? '{}')
  if (typeof saved?.visible === 'boolean') preferences.visible = saved.visible
  if (typeof saved?.autoHide === 'boolean')
    preferences.autoHide = saved.autoHide
  if (['icons', 'icons-and-text', 'text'].includes(saved?.mode))
    preferences.mode = saved.mode
  preferences.order = validOrder(saved?.order)
} catch {
  /* Keep defaults when stored preferences cannot be read. */
}
const items = new Map<string, ToolbarItem>()
let snapshot = { preferences, items: [] as ToolbarItem[] }
const listeners = new Set<() => void>()
const publish = () => {
  const rank = new Map(
    (preferences.order ?? []).map((id, index) => [id, index]),
  )
  snapshot = {
    preferences,
    items: [...items.values()].sort(
      (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
    ),
  }
  for (const listener of listeners) listener()
}
function setPreferences(changes: Partial<ToolbarPreferences>) {
  preferences = {
    autoHide:
      typeof changes.autoHide === 'boolean'
        ? changes.autoHide
        : (preferences.autoHide ?? true),
    order:
      changes.order === undefined
        ? (preferences.order ?? [])
        : validOrder(changes.order),
    visible:
      typeof changes.visible === 'boolean'
        ? changes.visible
        : preferences.visible,
    mode:
      changes.mode && ['icons', 'icons-and-text', 'text'].includes(changes.mode)
        ? changes.mode
        : preferences.mode,
  }
  localStorage.setItem(key, JSON.stringify(preferences))
  publish()
}

export const toolbar = {
  snapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  setPreferences,
  move(id: string, target: string, after = false) {
    if (id === target || !items.has(id) || !items.has(target)) return
    const order = [
      ...new Set([...(preferences.order ?? []), ...items.keys()]),
    ].filter((item) => item !== id)
    order.splice(order.indexOf(target) + Number(after), 0, id)
    setPreferences({ order })
  },
  scope(owner: string, onError: (error: unknown) => void) {
    let disposed = false
    const owned = new Set<() => void>()
    const api: ToolbarApi = {
      getPreferences: () => ({
        ...preferences,
        order: [...(preferences.order ?? [])],
      }),
      setPreferences(changes) {
        if (!disposed) setPreferences(changes)
      },
      register(initial) {
        if (disposed) return { update() {}, dispose() {} }
        const id = `${owner}.${initial.id}`
        if (!/^[a-z][a-z0-9-]*$/.test(initial.id) || items.has(id))
          throw new Error(`duplicate or invalid toolbar item: ${id}`)
        let active = true
        let item = initial
        const render = () => {
          items.set(id, {
            ...item,
            id,
            async onClick() {
              if (!active || disposed || item.disabled) return
              try {
                await item.onClick()
              } catch (error) {
                onError(error)
              }
            },
          })
          publish()
        }
        const dispose = () => {
          if (!active) return
          active = false
          items.delete(id)
          owned.delete(dispose)
          publish()
        }
        owned.add(dispose)
        render()
        return {
          dispose,
          update(changes) {
            if (!active || disposed) return
            if (
              Object.entries(changes).every(
                ([key, value]) => item[key as keyof ToolbarItem] === value,
              )
            )
              return
            item = { ...item, ...changes }
            render()
          },
        }
      },
    }
    return {
      api,
      dispose() {
        disposed = true
        for (const remove of owned) remove()
      },
    }
  },
}
