import {
  type Input,
  NodeType,
  Parser,
  type PartialParse,
  Tree,
  type TreeFragment,
} from '@lezer/common'
import type { MarkdownParser } from '@lezer/markdown'

/** Parse the proven body range while keeping prefix ownership in full coordinates. */
export class FrontmatterParser extends Parser {
  readonly #markdown: MarkdownParser
  readonly #prefix: Tree
  constructor(markdown: MarkdownParser, contentFrom: number) {
    super()
    if (!Number.isSafeInteger(contentFrom) || contentFrom < 1)
      throw new Error('Invalid frontmatter body boundary.')
    this.#markdown = markdown.nodeSet.types.some(
      (type) => type.name === 'Frontmatter',
    )
      ? markdown
      : markdown.configure({
          defineNodes: [{ name: 'Frontmatter', block: true }],
        })
    const type = this.#markdown.nodeSet.types.find(
      (type) => type.name === 'Frontmatter',
    )!
    this.#prefix = new Tree(type, [], [], contentFrom)
  }
  createParse(
    input: Input,
    fragments: readonly TreeFragment[],
    ranges: readonly { from: number; to: number }[],
  ): PartialParse {
    if (
      ranges.length !== 1 ||
      ranges[0]?.from !== 0 ||
      ranges[0].to !== input.length ||
      this.#prefix.length > input.length
    )
      throw new Error('Frontmatter parsing requires the complete source range.')
    const prefix = this.#prefix,
      body = this.#markdown.startParse(input, fragments, [
        { from: prefix.length, to: input.length },
      ])
    return {
      get parsedPos() {
        return body.parsedPos
      },
      get stoppedAt() {
        return body.stoppedAt
      },
      stopAt: (position) => body.stopAt(position),
      advance() {
        const tree = body.advance()
        if (!tree) return null
        // Keep balancing nodes/children shared. A nested non-anonymous Document
        // would turn every local body edit into whole-body owner expansion.
        const content = new Tree(
          NodeType.none,
          tree.children,
          tree.positions,
          tree.length,
          tree.propValues,
        )
        return new Tree(
          tree.type,
          [prefix, content],
          [0, prefix.length],
          prefix.length + tree.length,
          tree.propValues,
        )
      },
    }
  }
}
