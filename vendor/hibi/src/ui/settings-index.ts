import { createContext } from 'react'

export const SettingsDiscovery = createContext(false)
type Setting = { id: string; label: string; category: string; keywords: string }
const rows = new Map<string, Setting>()
const listeners = new Set<() => void>()
let snapshot: Setting[] = []
const publish = () => {
  snapshot = [...rows.values()]
  for (const listener of listeners) listener()
}
/** Shared SettingRow controls register only inside a settings discovery scope. */
export const settingsIndex = {
  snapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  register(element: HTMLElement, id: string, label: string) {
    const panel = element.closest('section[role="tabpanel"]')
    const category = panel?.id.replace(/^settings-/, '')
    if (!category) return () => {}
    const key = `${category}.${id}`
    rows.set(key, {
      id,
      label,
      category,
      keywords: element.textContent ?? label,
    })
    publish()
    return () => {
      rows.delete(key)
      publish()
    }
  },
}
