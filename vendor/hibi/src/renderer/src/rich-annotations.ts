import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { MarkdownProjection } from '../../addons/api'
import { editorDocument } from './document-formats'
import { editorAnnotations } from './editor-annotations'
import { exactRichRange } from './rich-text-range'

export function observeRichAnnotations(
  editor: Editor,
  project: () => MarkdownProjection | null,
) {
  const key = new PluginKey<DecorationSet>('reviewAnnotations')
  editor.registerPlugin(
    new Plugin({
      key,
      state: {
        init: () => DecorationSet.empty,
        apply: (tr, value) =>
          tr.getMeta(key) ?? (tr.docChanged ? DecorationSet.empty : value),
      },
      props: { decorations: (state) => key.getState(state) },
    }),
  )
  let frame = 0
  const refresh = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (editor.isDestroyed || !editor.markdown) return
      const entries = editorAnnotations.forDocument(editorDocument.get())
      const projection = entries.length ? project() : null
      const marks =
        projection?.sourceOffset === undefined
          ? []
          : entries.flatMap((entry) => {
              const range = exactRichRange(
                editor.state.doc,
                editor.markdown!,
                projection.content,
                entry.from - projection.sourceOffset!,
                entry.to - projection.sourceOffset!,
              )
              return range
                ? [
                    Decoration.inline(range.from, range.to, {
                      class: 'editor-annotation',
                      title: entry.message,
                      'data-severity': entry.severity ?? 'warning',
                    }),
                  ]
                : []
            })
      if (!marks.length && !key.getState(editor.state)?.find().length) return
      editor.view.dispatch(
        editor.state.tr
          .setMeta(key, DecorationSet.create(editor.state.doc, marks))
          .setMeta('addToHistory', false),
      )
    })
  }
  const stop = editorAnnotations.subscribe(refresh)
  refresh()
  return () => {
    stop()
    cancelAnimationFrame(frame)
    if (!editor.isDestroyed) editor.unregisterPlugin(key)
  }
}
