import { Extension } from '@tiptap/core'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

function appendParagraph(view: EditorView) {
  const { doc, schema } = view.state
  if (
    !view.editable ||
    !doc.lastChild ||
    doc.lastChild.type.name === 'paragraph'
  )
    return false
  const end = doc.content.size
  const transaction = view.state.tr.insert(
    end,
    schema.nodes.paragraph!.create(),
  )
  view.dispatch(
    transaction
      .setSelection(TextSelection.create(transaction.doc, end + 1))
      .scrollIntoView(),
  )
  return true
}

/** Escape a final table/list/code block on explicit input, without rewriting notes on load. */
export const BlockExit = Extension.create({
  name: 'blockExit',
  priority: 1100,
  addProseMirrorPlugins: () => [
    new Plugin({
      props: {
        handleKeyDown(view, event) {
          const { doc, selection } = view.state
          const last = doc.lastChild
          if (
            !last ||
            event.altKey ||
            event.shiftKey ||
            selection.from < doc.content.size - last.nodeSize
          )
            return false
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
            return appendParagraph(view)
          const { $from } = selection
          if (
            event.key !== 'ArrowDown' ||
            event.metaKey ||
            event.ctrlKey ||
            !selection.empty ||
            $from.parentOffset !== $from.parent.content.size
          )
            return false
          for (let depth = 0; depth <= $from.depth; depth++)
            if ($from.indexAfter(depth) !== $from.node(depth).childCount)
              return false
          return appendParagraph(view)
        },
        handleClick(view, _position, event) {
          if (event.target !== view.dom) return false
          const last = view.state.doc.lastChild
          if (!last) return false
          const element = view.nodeDOM(
            view.state.doc.content.size - last.nodeSize,
          )
          return (
            element instanceof HTMLElement &&
            event.clientY > element.getBoundingClientRect().bottom &&
            appendParagraph(view)
          )
        },
      },
    }),
  ],
})
