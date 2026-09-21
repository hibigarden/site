import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DocumentView } from '../../shared/document-types'

/** Keep source focus and pane transitions identical across editor surfaces. */
export function useEditorPanes(mode: DocumentView, markdownDocument: boolean) {
  const [focusedPane, setFocusedPane] = useState<'rich' | 'source'>('rich')
  const [sourceMounted, setSourceMounted] = useState(mode !== 'normal')
  const [sourceReady, setSourceReady] = useState(false)
  const [sourceSettled, setSourceSettled] = useState(false)
  const [initialMode] = useState(mode)
  // Only the first opening from normal view waits for source layout.
  const paneMode = sourceSettled || initialMode !== 'normal' ? mode : 'normal'
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (
      sourceReady &&
      (mode === 'markdown' || (!markdownDocument && mode !== 'normal'))
    ) {
      if (
        window.document.activeElement?.closest(
          '.settings-screen, [role="dialog"], input, textarea, select',
        )
      )
        return
      setFocusedPane('source')
      content.current?.querySelector<HTMLElement>('.cm-content')?.focus()
    }
  }, [markdownDocument, sourceReady, mode])
  const previousMode = useRef(paneMode)
  useLayoutEffect(() => {
    if (previousMode.current === paneMode) return
    previousMode.current = paneMode
    const element = content.current
    if (!element) return
    const opacity = Number(getComputedStyle(element).opacity)
    for (const animation of element.getAnimations()) animation.cancel()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const duration = getComputedStyle(element)
      .getPropertyValue('--motion-feedback')
      .trim()
    element.animate(
      [
        { opacity, offset: 0 },
        { opacity: 0, offset: 0.25 },
        { opacity: 0, offset: 0.625 },
        { opacity: 1, offset: 1 },
      ],
      {
        duration:
          Number.parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000) ||
          160,
      },
    )
  }, [paneMode])
  useEffect(() => {
    if (mode !== 'normal') setSourceMounted(true)
  }, [mode])
  return {
    content,
    paneMode,
    focusedPane,
    setFocusedPane,
    sourceMounted,
    sourceReady,
    setSourceReady,
    setSourceSettled,
  }
}
