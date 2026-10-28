import type { MarkdownParser } from '@lezer/markdown'
import { FrontmatterParser } from './frontmatter-parser.ts'
import { MarkdownSourceModel } from './markdown-source-model.ts'
import type {
  PreparedSourceOperation,
  SourceSnapshot,
} from './source-buffer.ts'
import {
  type FrontmatterRead,
  readSourceFrontmatter,
  reuseFrontmatterRead,
} from './source-frontmatter.ts'

/** Frontmatter is opaque prefix ownership; body parsing keeps normal dialect semantics. */
export class FrontmatterSourceModel extends MarkdownSourceModel {
  readonly #markdown: MarkdownParser
  #read: FrontmatterRead | null = null
  #reading: Generator<void, FrontmatterRead> | null = null
  #contentFrom = 0
  constructor(
    source: SourceSnapshot,
    markdown: MarkdownParser,
    dialect: string,
  ) {
    super(source, markdown, dialect)
    this.#markdown = markdown
  }
  override advance() {
    if (!this.#read) {
      this.#reading ??= readSourceFrontmatter(this.state().source)
      const step = this.#reading.next()
      if (!step.done) return this.state()
      this.#read = step.value
      this.#reading = null
      const from = this.#read.bounds?.contentFrom ?? 0,
        contentFrom = this.state().source.rawToEditor(from)
      if (contentFrom === null)
        throw new Error('Frontmatter ends inside a normalized line ending.')
      if (contentFrom !== this.#contentFrom) {
        this.#contentFrom = contentFrom
        super.reconfigure(
          contentFrom
            ? new FrontmatterParser(this.#markdown, contentFrom)
            : this.#markdown,
          this.state().dialect,
        )
      }
    }
    return super.advance()
  }
  override apply(prepared: PreparedSourceOperation) {
    super.apply(prepared)
    this.#reading?.return(undefined as never)
    this.#reading = null
    if (
      this.#read &&
      !reuseFrontmatterRead(this.#read, prepared.operation.changes)
    )
      this.#read = null
  }
  override dispose() {
    this.#reading?.return(undefined as never)
    this.#reading = null
    this.#read = null
    super.dispose()
  }
}
