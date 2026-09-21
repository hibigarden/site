import type { Editor } from '@tiptap/core'
import { type RefObject, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MarkdownPositionLookup } from './markdown-positions'
import {
  editorPosition,
  sourceView as findSourceView,
  sourcePosition,
} from './source-view'

export function MirrorCursor({
  editor,
  root,
  content,
  active,
  positions,
}: {
  editor: Editor | null
  root: RefObject<HTMLDivElement | null>
  content: () => { source: string; body: string } | null
  active: boolean
  positions: MarkdownPositionLookup
}) {
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
    const measure = () => {
      frame = 0
      if (editor.isDestroyed) {
        setPosition(null)
        return
      }
      const focused = document.activeElement
      const sourceElement =
        root.current?.querySelector<HTMLElement>('.cm-content')
      const sourceView = sourceElement && findSourceView(sourceElement)
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
      const text = content()
      if (!text) {
        setPosition(null)
        return
      }
      const { source, body } = text
      const bodyOffset = source.lastIndexOf(body)
      if (
        bodyOffset < 0 ||
        (sourceFocus &&
          sourcePosition(sourceView, sourceView.state.selection.main.head) <
            bodyOffset)
      ) {
        setPosition(null)
        return
      }
      const map = positions(body, editor.state.doc)
      const target = map(
        richFocus
          ? editor.state.selection.head
          : sourcePosition(sourceView, sourceView.state.selection.main.head) -
              bodyOffset,
        richFocus ? 'rich' : 'source',
      )
      const pane = root.current?.querySelector<HTMLElement>(
        richFocus ? '.source-pane' : '.rich-pane',
      )
      if (target === null || !pane) {
        setPosition(null)
        return
      }
      const sourceTarget = editorPosition(sourceView, target + bodyOffset)
      const caret = richFocus
        ? sourceTarget === null
          ? null
          : sourceView.coordsAtPos(sourceTarget)
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
      const next = {
        pane,
        x: caret.left - bounds.left + pane.scrollLeft,
        y: caret.top - bounds.top + pane.scrollTop,
        height: caret.bottom - caret.top,
      }
      setPosition((previous) =>
        previous?.pane === next.pane &&
        previous.x === next.x &&
        previous.y === next.y &&
        previous.height === next.height
          ? previous
          : next,
      )
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
      'hibi:source-caret',
      'hibi:rich-content',
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
        'hibi:source-caret',
        'hibi:rich-content',
      ])
        document.removeEventListener(event, schedule)
      document.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      editor.off('transaction', schedule)
    }
  }, [active, editor, root, positions, content])
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
