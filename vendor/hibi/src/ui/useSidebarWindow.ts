import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  sidebarBlockTop,
  sidebarRowAt,
  type sidebarRows,
  sidebarRowTop,
  sidebarWindow,
} from './sidebar-rows'

type Rows = ReturnType<typeof sidebarRows>
const initial = { top: 0, height: 600, rowHeight: 28, sectionHeight: 36 }

/** Fixed-token geometry; the metadata model remains separate from DOM residency. */
export function useSidebarWindow(
  model: Rows,
  enabled: boolean,
  editing: string | undefined,
) {
  const scroll = useRef<HTMLDivElement>(null)
  const rowMeasure = useRef<HTMLSpanElement>(null)
  const sectionMeasure = useRef<HTMLSpanElement>(null)
  const [viewport, setViewport] = useState(initial)
  const layout = useRef({
    ...initial,
    model,
    editing: undefined as string | undefined,
  })
  const refresh = useCallback(
    (anchor: boolean) => {
      const element = scroll.current
      if (!element) return
      const before = layout.current
      const rowHeight = anchor
        ? rowMeasure.current?.getBoundingClientRect().height || before.rowHeight
        : before.rowHeight
      const sectionHeight = anchor
        ? sectionMeasure.current?.getBoundingClientRect().height ||
          before.sectionHeight
        : before.sectionHeight
      const height = element.clientHeight
      const editingIndex =
        editing === undefined ? undefined : model.indices.get(editing)
      if (enabled && anchor) {
        if (editingIndex !== undefined && editing !== before.editing) {
          const top = sidebarRowTop(
            model.rows,
            editingIndex,
            rowHeight,
            sectionHeight,
          )
          if (top < element.scrollTop) element.scrollTop = top
          else if (top + rowHeight > element.scrollTop + height)
            element.scrollTop = top + rowHeight - height
        } else if (
          before.model !== model ||
          rowHeight !== before.rowHeight ||
          sectionHeight !== before.sectionHeight
        ) {
          const oldIndex = sidebarRowAt(
            before.model.rows,
            before.top,
            before.rowHeight,
            before.sectionHeight,
          )
          const oldRow = before.model.rows[oldIndex]
          let row = oldRow
          let index = row && model.indices.get(row.item.id)
          while (index === undefined && row?.parent) {
            const parent = before.model.indices.get(row.parent)
            row = parent === undefined ? undefined : before.model.rows[parent]
            index = row && model.indices.get(row.item.id)
          }
          const nextIndex = index ?? Math.min(oldIndex, model.rows.length - 1)
          const oldSize =
            before.rowHeight + (oldRow?.item.section ? before.sectionHeight : 0)
          const fraction =
            index !== undefined && row === oldRow
              ? Math.max(
                  0,
                  Math.min(
                    1,
                    (before.top -
                      sidebarBlockTop(
                        before.model.rows,
                        oldIndex,
                        before.rowHeight,
                        before.sectionHeight,
                      )) /
                      oldSize,
                  ),
                )
              : 0
          element.scrollTop =
            nextIndex < 0
              ? 0
              : sidebarBlockTop(
                  model.rows,
                  nextIndex,
                  rowHeight,
                  sectionHeight,
                ) +
                fraction *
                  (rowHeight +
                    (model.rows[nextIndex]?.item.section ? sectionHeight : 0))
        }
      }
      const next = { top: element.scrollTop, height, rowHeight, sectionHeight }
      layout.current = { ...next, model, editing }
      if (!enabled) return
      setViewport((current) => {
        const previous = sidebarWindow(
          model.rows,
          current.top,
          current.height,
          current.rowHeight,
          current.sectionHeight,
        )
        const visible = sidebarWindow(
          model.rows,
          next.top,
          next.height,
          rowHeight,
          sectionHeight,
        )
        return previous.from === visible.from &&
          previous.to === visible.to &&
          current.height === height &&
          current.rowHeight === rowHeight &&
          current.sectionHeight === sectionHeight
          ? current
          : next
      })
    },
    [model, enabled, editing],
  )
  useLayoutEffect(() => {
    refresh(true)
    const observer = new ResizeObserver(() => refresh(true))
    for (const element of [
      scroll.current,
      rowMeasure.current,
      sectionMeasure.current,
    ])
      if (element) observer.observe(element)
    return () => observer.disconnect()
  }, [refresh])
  const reveal = (index: number) => {
    const element = scroll.current
    if (!enabled || !element || !model.rows[index]) return
    // A focus event can beat ResizeObserver after a theme or row-height change.
    refresh(true)
    const { rowHeight, sectionHeight } = layout.current
    const top = sidebarRowTop(model.rows, index, rowHeight, sectionHeight)
    if (top < element.scrollTop) element.scrollTop = top
    else if (top + rowHeight > element.scrollTop + element.clientHeight)
      element.scrollTop = top + rowHeight - element.clientHeight
    refresh(false)
  }
  return {
    scroll,
    rowMeasure,
    sectionMeasure,
    reveal,
    onScroll: () => refresh(false),
    range: sidebarWindow(
      model.rows,
      viewport.top,
      viewport.height,
      viewport.rowHeight,
      viewport.sectionHeight,
    ),
  }
}
