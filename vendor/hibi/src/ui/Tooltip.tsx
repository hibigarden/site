import {
  cloneElement,
  type ReactElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { createTooltipScope, tooltipStore } from './tooltip-store'
import './tooltip.css'

/** Child must forward data attributes to its DOM element. No layout wrapper. */
export function Tooltip({
  text,
  children,
}: {
  text: string
  children: ReactElement<{ 'data-tooltip'?: string }>
}) {
  return cloneElement(children, { 'data-tooltip': text })
}

/** Mount once per renderer, including renderers using native modal dialogs. */
export function TooltipHost() {
  const active = useSyncExternalStore(
    tooltipStore.subscribe,
    tooltipStore.snapshot,
  )
  const node = useRef<HTMLDivElement>(null)
  const id = useId()
  const text = useRef('')
  const container = useRef<HTMLElement>(document.body)
  if (active) text.current = active.text
  if (active)
    container.current = active.anchor.closest('dialog[open]') ?? document.body
  useEffect(() => {
    const scope = createTooltipScope()
    let timer: ReturnType<typeof setTimeout> | undefined
    let anchor: HTMLElement | null = null
    const hide = () => {
      clearTimeout(timer)
      anchor = null
      tooltipStore.hide()
    }
    const enter = (event: Event) => {
      if (event instanceof PointerEvent && event.pointerType === 'touch') return
      const next =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-tooltip]')
          : null
      if (!next || next === anchor) return
      hide()
      anchor = next
      const show = () =>
        scope.api.show({ anchor: next, text: next.dataset.tooltip ?? '' })
      if (event.type === 'focusin') show()
      else timer = setTimeout(show, 400)
    }
    const leave = (event: Event) => {
      if (!(event.target instanceof Node) || !anchor?.contains(event.target))
        return
      const related = (event as FocusEvent).relatedTarget
      if (!(related instanceof Node) || !anchor?.contains(related)) hide()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    document.addEventListener('pointerover', enter)
    document.addEventListener('focusin', enter)
    document.addEventListener('pointerout', leave)
    document.addEventListener('focusout', leave)
    document.addEventListener('pointerdown', hide)
    document.addEventListener('scroll', hide, true)
    document.addEventListener('keydown', key)
    window.addEventListener('resize', hide)
    window.addEventListener('blur', hide)
    return () => {
      hide()
      scope.dispose()
      document.removeEventListener('pointerover', enter)
      document.removeEventListener('focusin', enter)
      document.removeEventListener('pointerout', leave)
      document.removeEventListener('focusout', leave)
      document.removeEventListener('pointerdown', hide)
      document.removeEventListener('scroll', hide, true)
      document.removeEventListener('keydown', key)
      window.removeEventListener('resize', hide)
      window.removeEventListener('blur', hide)
    }
  }, [])
  useLayoutEffect(() => {
    const element = node.current
    if (!element) return
    if (!active) {
      element.hidePopover()
      return
    }
    const { anchor } = active
    element.showPopover()
    const bounds = anchor.getBoundingClientRect()
    const height = element.offsetHeight
    const below =
      active.placement !== 'top' && bounds.bottom + height + 8 < innerHeight
    element.style.left = `${Math.max(8, Math.min(innerWidth - element.offsetWidth - 8, bounds.left + (bounds.width - element.offsetWidth) / 2))}px`
    element.style.top = `${Math.max(8, below ? bounds.bottom + 6 : bounds.top - height - 6)}px`
    const ids = (anchor.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean)
    anchor.setAttribute('aria-describedby', [...ids, id].join(' '))
    const observer = new MutationObserver(() => {
      if (!anchor.isConnected) tooltipStore.hide()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      const remaining = (anchor.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((value) => value && value !== id)
        .join(' ')
      if (remaining) anchor.setAttribute('aria-describedby', remaining)
      else anchor.removeAttribute('aria-describedby')
    }
  }, [active, id])
  return createPortal(
    <div
      ref={node}
      id={id}
      role="tooltip"
      popover="manual"
      className="ui-tooltip"
      aria-hidden={!active}
    >
      {text.current}
    </div>,
    container.current,
  )
}
