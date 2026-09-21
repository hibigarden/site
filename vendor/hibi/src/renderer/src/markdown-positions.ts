import type { Node as RichNode } from '@tiptap/pm/model'
import { marked, type Token } from 'marked'

/** Map visible token text, never link destinations, image alt text, or markup. */
export function markdownPositions(source: string, document: RichNode) {
  let text = ''
  const offsets: number[] = []
  function visit(tokens: readonly Token[], raw: string, base: number) {
    let cursor = 0
    for (const token of tokens) {
      const at = raw.indexOf(token.raw, cursor)
      if (at < 0) continue
      cursor = at + token.raw.length
      const offset = base + at
      if (token.type === 'image' || token.type === 'html') continue
      if (token.type === 'list') visit(token.items, token.raw, offset)
      else if (token.type === 'table') {
        const cells = [...token.header, ...token.rows.flat()]
        visit(
          cells.flatMap((cell) => cell.tokens),
          token.raw,
          offset,
        )
      } else if ('tokens' in token && token.tokens)
        visit(token.tokens, token.raw, offset)
      else if (
        'text' in token &&
        typeof token.text === 'string' &&
        token.text
      ) {
        // Exact text only. Unmappable custom syntax is left unmarked rather than
        // guessing a position in a different word or markup delimiter.
        const start = token.raw.indexOf(token.text)
        if (start < 0) continue
        text += token.text
        for (let index = 0; index < token.text.length; index++)
          offsets.push(offset + start + index)
      }
    }
  }
  visit(marked.lexer(source), source, 0)
  const points: { source: number; rich: number }[] = []
  let cursor = 0
  document.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const start = text.indexOf(node.text, cursor)
    if (start < 0) return
    for (let i = 0; i <= node.text.length; i++) {
      const offset = offsets[start + Math.min(i, node.text.length - 1)]
      if (offset !== undefined)
        points.push({
          source: offset + Number(i === node.text.length),
          rich: pos + i,
        })
    }
    cursor = start + node.text.length
  })
  if (!source.trim() && document.firstChild?.isTextblock)
    points.push({ source: 0, rich: 1 })
  return (position: number, from: 'source' | 'rich') => {
    const to = from === 'source' ? 'rich' : 'source'
    let low = 0,
      high = points.length - 1
    while (low <= high) {
      const middle = (low + high) >>> 1
      const point = points[middle]
      if (!point) return null
      if (point[from] < position) low = middle + 1
      else high = middle - 1
    }
    const after = points[low],
      before = points[low - 1]
    const nearest = !before
      ? after
      : !after
        ? before
        : position - before[from] <= after[from] - position
          ? before
          : after
    return nearest?.[to] ?? null
  }
}
