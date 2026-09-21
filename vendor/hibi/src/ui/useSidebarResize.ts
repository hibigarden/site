import { useEffect, useState } from 'react'

export const MIN_SIDEBAR_WIDTH = 152
export const SIDEBAR_OVERLAY_WIDTH = 700
const MAX_SIDEBAR_WIDTH = 480

export function useSidebarResize(
  defaultWidth: number,
  storageKey = 'sidebar-width',
  maxFraction = 0.6,
) {
  const [preferred, setPreferred] = useState<number | null>(() => {
    try {
      const value = Number(localStorage.getItem(storageKey))
      return value >= MIN_SIDEBAR_WIDTH && value <= MAX_SIDEBAR_WIDTH
        ? value
        : null
    } catch {
      return null
    }
  })
  const [viewport, setViewport] = useState(innerWidth)
  const maxWidth = Math.max(
    MIN_SIDEBAR_WIDTH,
    Math.min(MAX_SIDEBAR_WIDTH, Math.floor(viewport * maxFraction)),
  )
  useEffect(() => {
    const update = () => setViewport(innerWidth)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  useEffect(() => {
    try {
      if (preferred === null) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, String(preferred))
    } catch {
      // Resizing still works when the browser blocks local storage.
    }
  }, [preferred, storageKey])
  return {
    overlay: viewport <= SIDEBAR_OVERLAY_WIDTH,
    width: Math.min(preferred ?? defaultWidth, maxWidth),
    maxWidth,
    onChange: (width: number) =>
      setPreferred(
        Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth, Math.round(width))),
      ),
    onReset: () => setPreferred(null),
  }
}
