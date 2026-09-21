import { useEffect, useState } from 'react'

export const MIN_SIDEBAR_WIDTH = 152
const MAX_SIDEBAR_WIDTH = 480

export function useSidebarResize(defaultWidth: number) {
  const [preferred, setPreferred] = useState<number | null>(() => {
    try {
      const value = Number(localStorage.getItem('sidebar-width'))
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
    Math.min(MAX_SIDEBAR_WIDTH, Math.floor(viewport * 0.6)),
  )
  useEffect(() => {
    const update = () => setViewport(innerWidth)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  useEffect(() => {
    try {
      if (preferred === null) localStorage.removeItem('sidebar-width')
      else localStorage.setItem('sidebar-width', String(preferred))
    } catch {
      // Resizing still works when the browser blocks local storage.
    }
  }, [preferred])
  return {
    width: Math.min(preferred ?? defaultWidth, maxWidth),
    maxWidth,
    onChange: (width: number) =>
      setPreferred(
        Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth, Math.round(width))),
      ),
    onReset: () => setPreferred(null),
  }
}
