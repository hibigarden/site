import type { JSONContent } from '@tiptap/core'
import type { MarkdownManager } from '@tiptap/markdown'
import type { Node } from '@tiptap/pm/model'

/** Block caching is opt-in: arbitrary addon serializers may depend on the whole document. */
export function markdownSerializer(
  manager: MarkdownManager,
  blockLocal: boolean,
) {
  const json = new WeakMap<Node, JSONContent>()
  const blocks = new WeakMap<
    Node,
    {
      previous: Node | undefined
      index: number
      attributes: Node['attrs']
      source: string
    }
  >()
  const asJSON = (node: Node) => {
    const cached = json.get(node)
    if (cached) return cached
    const value: JSONContent = node.toJSON()
    json.set(node, value)
    return value
  }
  return (doc: Node) => {
    const children: Node[] = []
    doc.forEach((node) => {
      children.push(node)
    })
    if (
      !blockLocal ||
      doc.marks.length ||
      children.some((node) => node.marks.length)
    ) {
      const source = manager.serialize(doc.toJSON())
      return {
        source,
        rendered: children.length,
        blocks: null,
      }
    }
    const parent: JSONContent = {
      type: doc.type.name,
      ...(Object.keys(doc.attrs).length ? { attrs: doc.attrs } : {}),
      content: children.map(asJSON),
    }
    let rendered = 0
    const parts = children.map((node, index) => {
      const previous = children[index - 1]
      let cached = blocks.get(node)
      if (
        !cached ||
        cached.previous !== previous ||
        cached.index !== index ||
        cached.attributes !== doc.attrs
      ) {
        const source = manager.renderNodeToMarkdown(
          asJSON(node),
          parent,
          index,
          0,
        )
        cached = {
          previous,
          index,
          attributes: doc.attrs,
          source,
        }
        blocks.set(node, cached)
        rendered++
      }
      return cached
    })
    const joined = parts.map((block) => block.source).join('\n\n')
    // Match the manager's empty-document normalization, including blank paragraphs.
    const source = /^(?:\s|&nbsp;)*$/.test(joined) ? '' : joined
    return { source, rendered, blocks: parts }
  }
}
