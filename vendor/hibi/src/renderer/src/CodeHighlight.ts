import { Extension } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { type CodeSpan, codeLanguages, highlightCode } from './code-languages'

/** Decorations never change the document, Markdown serialization, selection, or history. */
export const CodeHighlight = Extension.create({
  name: 'codeHighlight',
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>('codeHighlight')
    const cache = new WeakMap<Node, { version: number; spans: CodeSpan[] }>()
    function decorate(doc: Node) {
      const decorations: Decoration[] = []
      doc.descendants((node, pos) => {
        if (node.type.name !== 'codeBlock') return
        let result = cache.get(node)
        if (result?.version !== codeLanguages.version()) {
          result = {
            version: codeLanguages.version(),
            spans: highlightCode(
              node.textContent,
              String(node.attrs.language ?? ''),
            ),
          }
          cache.set(node, result)
        }
        for (const span of result.spans)
          decorations.push(
            Decoration.inline(pos + 1 + span.from, pos + 1 + span.to, {
              class: span.classes,
            }),
          )
        return false
      })
      return DecorationSet.create(doc, decorations)
    }
    return [
      new Plugin({
        key,
        state: {
          init: (_config, state) => decorate(state.doc),
          apply: (transaction, previous) =>
            transaction.docChanged || transaction.getMeta(key)
              ? decorate(transaction.doc)
              : previous,
        },
        props: { decorations: (state) => key.getState(state) },
        view(view) {
          const unsubscribe = codeLanguages.subscribe(() =>
            view.dispatch(
              view.state.tr.setMeta(key, true).setMeta('addToHistory', false),
            ),
          )
          return { destroy: unsubscribe }
        },
      }),
    ]
  },
})
