import type { BlockContext, Line, MarkdownConfig } from '@lezer/markdown'
import { blockMath } from '../../addons/math/syntax.ts'

const lookaheadLimit = 16_384

export class SourceOutlineMathUnavailable extends Error {
  override name = 'SourceOutlineMathUnavailable'
}

/** A clipped paragraph may hide a math opener beyond the inspected prefix. */
export function validateOutlineMathCandidate(text: string, clipped = false) {
  if (clipped || text.includes('$$'))
    throw new SourceOutlineMathUnavailable(
      'The source outline is unavailable for math within a paragraph or an oversized paragraph.',
    )
}

/**
 * Recognize proven top-level math using the addon's tokenizer. The read callback
 * uses this parser's normalized coordinates, including any frontmatter offset.
 * Unsupported container and clipped matches stop publication instead of exposing
 * their contents as headings.
 */
export function outlineMathParser(
  read: (from: number, to: number) => string,
  length: () => number,
): MarkdownConfig {
  const match = (cx: BlockContext, line: Line) => {
    if (!line.text.slice(line.basePos).startsWith('$$')) return null
    if (cx.depth !== 1 || cx.parentType().name !== 'Document')
      throw new SourceOutlineMathUnavailable(
        'The source outline is unavailable for math inside a list or blockquote.',
      )
    const from = cx.lineStart + line.basePos,
      end = Math.min(length(), from + lookaheadLimit),
      text = read(from, end),
      token = blockMath(text),
      clipped = end < length()
    // A match at an artificial EOF can accept a truncated trailing space run.
    // The native limit applies to the body, not the complete token's raw length.
    if (clipped && (!token || token.raw.length === text.length))
      throw new SourceOutlineMathUnavailable(
        'The source outline is unavailable because this math block exceeds the inspection limit.',
      )
    return token ? { from, to: from + token.raw.length } : null
  }
  return {
    defineNodes: [{ name: 'HibiMathBlock', block: true }],
    parseBlock: [
      {
        name: 'HibiMathBlock',
        before: 'ATXHeading',
        parse(cx, line) {
          const range = match(cx, line)
          if (!range) return false
          do {
            if (!cx.nextLine()) break
          } while (cx.lineStart < range.to)
          cx.addElement(cx.elt('HibiMathBlock', range.from, range.to))
          return true
        },
        endLeaf: (cx, line) => match(cx, line) !== null,
      },
    ],
  }
}
