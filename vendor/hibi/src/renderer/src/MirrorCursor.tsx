import { EditorView } from '@codemirror/view'
import type { Editor } from '@tiptap/core'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { markdownPositions } from './markdown-positions'

export function MirrorCursor({
  editor,
  root,
  source,
  body,
  active,
}: {
  editor: Editor | null
  root: RefObject<HTMLDivElement | null>
  source: string
  body: string
  active: boolean
}) {
  const latest = useRef({ source, body })
  latest.current = { source, body }
  const [position, setPosition] = useState<{
    pane: HTMLElement
    x: number
    y: number
    height: number
  } | null>(null)
  useEffect(() => {
    if (!active || !editor) {
      setPosition(null)
      return
    }
    let frame = 0
    let cached: {
      doc: typeof editor.state.doc
      source: string
      map: ReturnType<typeof markdownPositions>
    } | null = null
    const measure = () => {
      frame = 0
      const focused = document.activeElement
      const sourceElement =
        root.current?.querySelector<HTMLElement>('.cm-content')
      const sourceView = sourceElement && EditorView.findFromDOM(sourceElement)
      const richFocus = focused === editor.view.dom
      const sourceFocus = focused === sourceElement
      if (
        !document.hasFocus() ||
        !sourceView ||
        (!richFocus && !sourceFocus) ||
        editor.view.composing ||
        sourceView.composing ||
        (richFocus
          ? !editor.state.selection.empty
          : !sourceView.state.selection.main.empty)
      ) {
        setPosition(null)
        return
      }
      const { source, body } = latest.current
      const bodyOffset = source.indexOf(body)
      if (
        bodyOffset < 0 ||
        (sourceFocus && sourceView.state.selection.main.head < bodyOffset)
      ) {
        setPosition(null)
        return
      }
      if (!cached || cached.doc !== editor.state.doc || cached.source !== body)
        cached = {
          doc: editor.state.doc,
          source: body,
          map: markdownPositions(body, editor.state.doc),
        }
      const target = cached.map(
        richFocus
          ? editor.state.selection.head
          : sourceView.state.selection.main.head - bodyOffset,
        richFocus ? 'rich' : 'source',
      )
      const pane = root.current?.querySelector<HTMLElement>(
        richFocus ? '.source-pane' : '.rich-pane',
      )
      if (target === null || !pane) {
        setPosition(null)
        return
      }
      const caret = richFocus
        ? sourceView.coordsAtPos(
            Math.min(sourceView.state.doc.length, target + bodyOffset),
          )
        : editor.view.coordsAtPos(target)
      const bounds = pane.getBoundingClientRect()
      if (
        !caret ||
        caret.top < bounds.top ||
        caret.bottom > bounds.bottom ||
        caret.left < bounds.left ||
        caret.left > bounds.right
      ) {
        setPosition(null)
        return
      }
      setPosition({
        pane,
        x: caret.left - bounds.left + pane.scrollLeft,
        y: caret.top - bounds.top + pane.scrollTop,
        height: caret.bottom - caret.top,
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(schedule)
    if (root.current) observer.observe(root.current)
    for (const event of [
      'selectionchange',
      'input',
      'focusin',
      'focusout',
      'compositionend',
    ])
      document.addEventListener(event, schedule)
    document.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    editor.on('transaction', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      for (const event of [
        'selectionchange',
        'input',
        'focusin',
        'focusout',
        'compositionend',
      ])
        document.removeEventListener(event, schedule)
      document.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      editor.off('transaction', schedule)
    }
  }, [active, editor, root])
  return (
    position &&
    createPortal(
      <span
        aria-hidden="true"
        className="mirror-cursor"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          height: position.height,
        }}
      />,
      position.pane,
    )
  )
}
