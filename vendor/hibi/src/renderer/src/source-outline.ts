import type { SyntaxNode } from '@lezer/common'
import { GFM, type MarkdownParser, parser } from '@lezer/markdown'
import { decodeHTML } from 'entities'
import type { Token } from 'marked'
import { FrontmatterParser } from '../../shared/frontmatter-parser.ts'
import { createPlainTextRunExtension } from '../../shared/markdown-plain-text-runs.ts'
import { markdownSourceParser } from '../../shared/markdown-source-references.ts'
import type {
  PreparedSourceOperation,
  SourceSnapshot,
  SourceStorageChange,
} from '../../shared/source-buffer.ts'
import {
  type FrontmatterRead,
  readSourceFrontmatter,
  reuseFrontmatterRead,
} from '../../shared/source-frontmatter.ts'
import { SourceParserSession } from '../../shared/source-parser.ts'
import { normalizedSource } from '../../shared/source-projection.ts'
import type { ReferenceValue } from '../../shared/source-references.ts'
import {
  outlineMathParser,
  validateOutlineMathCandidate,
} from './source-outline-math.ts'

export type SourceOutlineHeading = Readonly<{
  id: string
  from: number
  label: string
  level: number
}>
export type SourceOutlineReference = Readonly<{ reference: string }>

function rawPosition(source: SourceSnapshot, position: number) {
  const raw = source.editorToRaw(position)
  if (raw === null) throw new Error('Source heading is outside its snapshot.')
  return raw
}

function plainText(tokens: readonly Token[]): string {
  return tokens
    .map((token) => {
      if (token.type === 'html') return ''
      if ('tokens' in token && token.tokens) return plainText(token.tokens)
      if ('text' in token && typeof token.text === 'string')
        return token.type === 'codespan' ? token.text : decodeHTML(token.text)
      return token.type === 'br' ? ' ' : ''
    })
    .join('')
}

function headingText(source: SourceSnapshot, node: SyntaxNode) {
  const first = node.firstChild,
    last = node.lastChild,
    from =
      node.name.startsWith('ATX') && first?.name === 'HeaderMark'
        ? first.to
        : node.from,
    to = last?.name === 'HeaderMark' && last.from >= from ? last.from : node.to,
    boundedTo = Math.min(to, from + 512)
  // ponytail: labels inspect at most 512 UTF-16 units; full heading text stays
  // in the document. Larger labels need a separately budgeted inline reader.
  return normalizedSource(
    source.sliceRaw(rawPosition(source, from), rawPosition(source, boundedTo)),
  )
    .replace(/\n[ \t]*(?:>[ \t]*)+/g, '\n')
    .trim()
}

/** Structural source headings, independent of a mounted rich editor or its DOM. */
export class SourceOutlineModel {
  readonly #markdown: MarkdownParser
  readonly #session: SourceParserSession
  readonly #frontmatter: boolean
  readonly #math: boolean
  readonly #disabled: ReadonlySet<string>
  readonly #labels: ReturnType<typeof markdownSourceParser>
  readonly #renderLabel: (
    tokens: readonly Token[],
    level: number,
  ) => string | null
  #frontmatterRead: FrontmatterRead | null = null
  #contentFrom = 0
  #epoch = 0
  #disposed = false
  #headings: readonly SourceOutlineHeading[] | null = null

  constructor(
    source: SourceSnapshot,
    options: {
      gfm: boolean
      frontmatter: boolean
      disabled?: readonly string[]
      alerts?: boolean
      textExtras?: boolean
      math?: boolean
      renderLabel?: (tokens: readonly Token[], level: number) => string | null
    },
  ) {
    this.#frontmatter = options.frontmatter
    this.#math = options.math ?? false
    this.#disabled = new Set(options.disabled)
    this.#labels = markdownSourceParser({
      gfm: options.gfm,
      alerts: options.alerts ?? false,
      textExtras: options.textExtras ?? false,
      math: options.math ?? false,
    })
    this.#renderLabel = options.renderLabel ?? ((tokens) => plainText(tokens))
    const runs = createPlainTextRunExtension()
    this.#markdown = parser.configure([
      ...(options.gfm ? GFM : []),
      ...(this.#math
        ? [
            outlineMathParser(
              (from, to) => {
                const current = this.#session.state().source
                return normalizedSource(
                  current.sliceRaw(
                    rawPosition(current, from),
                    rawPosition(current, to),
                  ),
                )
              },
              () => this.#session.state().source.normalizedLength,
            ),
          ]
        : []),
      { defineNodes: [{ name: 'Frontmatter', block: true }] },
      runs.extension,
    ])
    runs.allow(this.#markdown)
    this.#session = new SourceParserSession(
      source,
      this.#markdown,
      options.gfm ? 'gfm' : 'commonmark',
    )
  }

  counters(reset = false) {
    return this.#session.counters(reset)
  }

  apply(prepared: PreparedSourceOperation) {
    this.#session.apply(prepared)
    this.#epoch++
    this.#headings = null
    if (
      this.#frontmatterRead &&
      !reuseFrontmatterRead(this.#frontmatterRead, prepared.operation.changes)
    )
      this.#frontmatterRead = null
  }

  adoptStorage(change: SourceStorageChange) {
    this.#session.adoptStorage(change)
    this.#epoch++
  }

  *read(): Generator<
    undefined | SourceOutlineReference,
    readonly SourceOutlineHeading[],
    ReferenceValue | null | undefined
  > {
    const epoch = this.#epoch,
      source = this.#session.state().source,
      current = () => {
        if (this.#disposed || epoch !== this.#epoch)
          throw new Error('Source outline work is disposed or stale.')
      }
    current()
    if (this.#headings) return this.#headings
    if (this.#frontmatter && !this.#frontmatterRead) {
      const work = readSourceFrontmatter(source)
      try {
        for (;;) {
          current()
          const step = work.next()
          if (step.done) {
            this.#frontmatterRead = step.value
            break
          }
          yield
        }
      } finally {
        work.return(undefined as never)
      }
      const from = source.rawToEditor(
        this.#frontmatterRead.bounds?.contentFrom ?? 0,
      )
      if (from === null)
        throw new Error('Frontmatter ends inside a normalized line ending.')
      if (from !== this.#contentFrom) {
        this.#contentFrom = from
        this.#session.reconfigure(
          from ? new FrontmatterParser(this.#markdown, from) : this.#markdown,
          this.#session.state().dialect,
        )
      }
    }
    while (!this.#session.state().complete) {
      current()
      this.#session.advance()
      yield
    }
    current()
    const tree = this.#session.state().tree
    if (!tree) throw new Error('Source outline requires a completed tree.')
    const cursor = tree.cursor(),
      headings: SourceOutlineHeading[] = [],
      references = new Map<string, ReferenceValue | null>()
    let visited = 0
    for (;;) {
      const name = cursor.name,
        heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(name),
        disabled =
          (name === 'Blockquote' && this.#disabled.has('core.quotes')) ||
          (name === 'BulletList' && this.#disabled.has('core.bullet-lists')) ||
          (name === 'OrderedList' && this.#disabled.has('core.numbered-lists'))
      if (
        this.#math &&
        (name === 'Paragraph' || name.startsWith('SetextHeading'))
      ) {
        for (let from = cursor.from; from < cursor.to; from += 4096) {
          const to = Math.min(cursor.to, from + 4097)
          validateOutlineMathCandidate(
            normalizedSource(
              source.sliceRaw(
                rawPosition(source, from),
                rawPosition(source, to),
              ),
            ),
          )
          yield
          current()
        }
      }
      if (heading && !this.#disabled.has(`core.heading-${heading[1]}`)) {
        const from = rawPosition(source, cursor.from),
          text = headingText(source, cursor.node),
          level = Number(heading[1])
        let tokens: Token[]
        for (;;) {
          const missing = new Set<string>(),
            lexer = new this.#labels.Lexer({
              ...this.#labels.defaults,
              tokenizer: null,
            })
          lexer.tokens.links = new Proxy(Object.create(null), {
            get: (_target, key) => {
              if (typeof key !== 'string') return undefined
              if (!references.has(key)) missing.add(key)
              return references.get(key) ?? undefined
            },
          })
          tokens = lexer.inlineTokens(text)
          if (!missing.size) break
          for (const reference of missing) {
            const value = yield { reference }
            current()
            references.set(reference, value ?? null)
          }
        }
        const label = this.#renderLabel(tokens, level)
        if (label === null)
          throw new Error('Source outline cannot represent the active syntax.')
        headings.push(
          Object.freeze({
            id: `source:${from}`,
            from,
            label: label.replace(/\s+/g, ' ').trim() || 'Untitled heading',
            level,
          }),
        )
        yield
        current()
      }
      if (++visited % 64 === 0) {
        yield
        current()
      }
      if (!disabled && !heading && cursor.firstChild()) continue
      while (!cursor.nextSibling()) {
        if (!cursor.parent()) {
          current()
          this.#headings = Object.freeze(headings)
          return this.#headings
        }
      }
    }
  }

  dispose() {
    this.#disposed = true
    this.#epoch++
    this.#headings = null
    this.#frontmatterRead = null
    this.#session.dispose()
  }
}
