import type { ComponentType } from 'react'

export type MenuItem = {
  id: string
  label: string
  icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  disabled?: boolean
  separatorBefore?: boolean
  onSelect: () => void | Promise<void>
}
export type MenuApi = {
  open: (options: {
    label: string
    anchor: HTMLElement | { x: number; y: number }
    items: readonly MenuItem[]
  }) => { close: () => void }
}
