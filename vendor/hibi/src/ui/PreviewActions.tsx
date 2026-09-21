import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Actions remain outside the document body's layout and stay visible while it scrolls. */
export function PreviewActions({
  target,
  children,
}: {
  target?: HTMLElement | null | undefined
  children: ReactNode
}) {
  return target ? createPortal(children, target) : null
}
