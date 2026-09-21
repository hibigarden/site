import type { JSONContent } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { ReplaceStep } from '@tiptap/pm/transform'
import {
  acceptedStorageChange,
  type PreparedSourceOperation,
  type SourceSnapshot,
  type SourceStorageChange,
} from '../../shared/source-buffer.ts'
import type { RawEdit } from '../../shared/source-operations.ts'
import { type SourceOwner, SourceOwners } from '../../shared/source-owners.ts'
import { normalizeSource } from './source-text.ts'

const maximumParagraphUnits = 16 * 1024
type AsciiParagraph = Readonly<{ content: number; indent: number }>
type AsciiEdit = Readonly<{
  index: number
  length: number
  ascii: AsciiParagraph
}>
function asciiContent(text: string) {
  let content = 0
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code === 32) continue
    if (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122)
    )
      content++
    else return null
  }
  return content
}
function asciiParagraph(text: string): AsciiParagraph | null {
  const content = asciiContent(text)
  if (!content) return null
  let indent = 0
  while (text.charCodeAt(indent) === 32) indent++
  return { content, indent }
}
type Block = Readonly<{
  index: number
  richDelta: number
  suffix: number
  following: boolean
  ascii: AsciiParagraph | null
}>
type Serialized = {
  source: string
  blocks: readonly { source: string }[] | null
}
const plain = (node: Node, source: string) =>
  node.type.name === 'paragraph' &&
  !node.marks.length &&
  node.childCount === 1 &&
  node.firstChild!.isText &&
  !node.firstChild!.marks.length &&
  node.firstChild!.text === source

/** A successful full parse proves these exact serialized block boundaries.
 * Only text-only replacements keep their source/PM length deltas unchanged. */
class PlainSourceSync {
  readonly #source: SourceSnapshot
  readonly #document: Node
  readonly #owners: SourceOwners
  readonly #blocks: readonly Block[]
  readonly #ascii: WeakMap<SourceOwner, AsciiParagraph>
  constructor(
    source: SourceSnapshot,
    document: Node,
    owners: SourceOwners,
    blocks: readonly Block[],
    ascii = new WeakMap<SourceOwner, AsciiParagraph>(),
  ) {
    this.#source = source
    this.#document = document
    this.#owners = owners
    this.#blocks = blocks
    this.#ascii = ascii
  }
  matches(source: SourceSnapshot, document: Node) {
    return source === this.#source && document === this.#document
  }
  adoptStorage(change: SourceStorageChange, document: Node) {
    return acceptedStorageChange(change) &&
      this.matches(change.before, document)
      ? new PlainSourceSync(
          change.after,
          document,
          this.#owners,
          this.#blocks,
          this.#ascii,
        )
      : null
  }
  #asciiEdit({ from, to, insert }: RawEdit): AsciiEdit | null {
    if (to - from + insert.length > maximumParagraphUnits) return null
    const row = this.#owners.at(from)
    if (row?.owner.kind !== 'plain') return null
    const block = this.#blocks[row.index]!
    const ascii =
      row.owner.revision === 0 ? block.ascii : this.#ascii.get(row.owner)
    if (!ascii || to > row.to - block.suffix || from < row.from + ascii.indent)
      return null
    const inserted = asciiContent(insert)
    if (inserted === null) return null
    const removed = asciiContent(this.#source.sliceRaw(from, to))
    if (removed === null || ascii.content - removed + inserted <= 0) return null
    if (from === row.from + ascii.indent) {
      const first =
        insert[0] ??
        this.#source.sliceRaw(to, Math.min(to + 1, this.#source.utf16Length))
      if (!first || first === ' ') return null
    }
    return {
      index: row.index,
      length: row.owner.length + insert.length - (to - from),
      ascii: {
        content: ascii.content - removed + inserted,
        indent: ascii.indent,
      },
    }
  }
  #withAscii(source: SourceSnapshot, document: Node, edit: AsciiEdit) {
    const owners = this.#owners.update(edit.index, {
      kind: 'plain',
      length: edit.length,
      parsed: true,
    })
    this.#ascii.set(owners.get(edit.index)!.owner, edit.ascii)
    return new PlainSourceSync(
      source,
      document,
      owners,
      this.#blocks,
      this.#ascii,
    )
  }
  /** A closed lexical subset: no inline/block markers, URLs, or new lines.
   * Only changed bytes are inspected after the initial paragraph classification. */
  planVisual(
    source: SourceSnapshot,
    state: EditorState,
    transaction: Transaction,
    document: Node,
    encodeText: (text: string) => string,
  ) {
    if (
      !this.matches(source, state.doc) ||
      transaction.before !== state.doc ||
      document !== transaction.doc ||
      transaction.steps.length !== 1
    )
      return null
    const step = transaction.steps[0]
    if (
      !(step instanceof ReplaceStep) ||
      step.slice.openStart ||
      step.slice.openEnd ||
      step.slice.content.childCount > 1
    )
      return null
    const text = step.slice.content.firstChild
    if (text && (!text.isText || text.marks.length)) return null
    const insert = text?.text ?? ''
    if (step.to - step.from + insert.length > maximumParagraphUnits) return null
    if (step.toJSON().structure) return null
    const from = this.map(source, state.doc, step.from, 'rich')
    const to = this.map(source, state.doc, step.to, 'rich')
    if (from === null || to === null) return null
    const change: RawEdit = Object.freeze({ from, to, insert })
    const ascii = this.#asciiEdit(change)
    if (!ascii || encodeText(insert) !== insert) return null
    return {
      change,
      certify: (prepared: PreparedSourceOperation) => {
        const actual = prepared.operation.changes[0]
        if (
          prepared.before !== source ||
          prepared.operation.changes.length !== 1 ||
          !actual ||
          actual.from !== from ||
          actual.to !== to ||
          actual.insert !== insert
        )
          return null
        return this.#withAscii(prepared.after, document, ascii)
      },
    }
  }
  map(
    source: SourceSnapshot,
    document: Node,
    position: number,
    from: 'source' | 'rich',
  ): number | null {
    if (
      !this.matches(source, document) ||
      !Number.isSafeInteger(position) ||
      position < 0
    )
      return null
    if (from === 'source') {
      const row = this.#owners.at(position)
      if (row?.owner.kind !== 'plain' || !source.isEditBoundary(position))
        return null
      const block = this.#blocks[row.index]!
      if (position > row.to - block.suffix) return null
      return source.rawToEditor(position)! + block.richDelta + 1
    }
    if (position > document.content.size) return null
    const resolved = document.resolve(position)
    if (resolved.depth !== 1) return null
    const index = resolved.index(0)
    let low = 0,
      high = this.#blocks.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (this.#blocks[middle]!.index < index) low = middle + 1
      else high = middle
    }
    if (this.#blocks[low]?.index !== index) return null
    const row = this.#owners.get(low)
    if (row?.owner.kind !== 'plain') return null
    const raw = source.editorToRaw(
      source.rawToEditor(row.from)! + resolved.parentOffset,
    )
    return raw !== null && source.isEditBoundary(raw) ? raw : null
  }
  prepare(
    prepared: PreparedSourceOperation,
    state: EditorState,
    parse: (source: string) => JSONContent,
  ) {
    if (
      prepared.before !== this.#source ||
      state.doc !== this.#document ||
      prepared.operation.changes.length !== 1
    )
      return null
    const edit = prepared.operation.changes[0]!
    const ascii = this.#asciiEdit(edit)
    if (ascii) {
      const from = this.map(prepared.before, state.doc, edit.from, 'source')
      const to = this.map(prepared.before, state.doc, edit.to, 'source')
      if (from !== null && to !== null) {
        const transaction = state.tr.replaceWith(
          from,
          to,
          edit.insert ? state.schema.text(edit.insert) : [],
        )
        return {
          transaction,
          next: this.#withAscii(prepared.after, transaction.doc, ascii),
        }
      }
    }
    const row = this.#owners.at(edit.from)
    if (row?.owner.kind !== 'plain') return null
    const block = this.#blocks[row.index]!
    const end = row.to - block.suffix
    const delta = edit.insert.length - (edit.to - edit.from)
    if (
      edit.from < row.from ||
      edit.to > end ||
      row.owner.length > maximumParagraphUnits ||
      row.owner.length + delta > maximumParagraphUnits ||
      /[\r\n]/.test(edit.insert) ||
      /[\r\n]/.test(prepared.before.sliceRaw(edit.from, edit.to))
    )
      return null
    const source = normalizeSource(
      prepared.after.sliceRaw(row.from, end + delta),
    )
    // References depend on definitions outside this block. HTML may consume
    // following blocks. Neither has a block-local semantic proof here.
    if (source.includes('[') || source.includes('<')) return null
    const from = prepared.before.rawToEditor(edit.from)
    const to = prepared.before.rawToEditor(edit.to)
    const start = prepared.before.rawToEditor(row.from)
    if (from === null || to === null || start === null) return null
    const richStart = start + block.richDelta
    const current = state.doc.nodeAt(richStart)
    // Changing indentation can absorb this paragraph into a preceding list,
    // even when the isolated region still parses as an ordinary paragraph.
    if (
      !current ||
      /^[ \t]*/.exec(current.textContent)?.[0] !== /^[ \t]*/.exec(source)?.[0]
    )
      return null
    // Keep the original line-ending envelope: a final backslash before a
    // newline is a hard break, while parsing that backslash at EOF is literal.
    const envelope = normalizeSource(
      prepared.after.sliceRaw(end + delta, row.to + delta),
    )
    const context = block.following ? 'hibi sync context' : ''
    const parsed = state.schema.nodeFromJSON(parse(source + envelope + context))
    if (
      parsed.childCount !== (context ? 2 : 1) ||
      !plain(parsed.firstChild!, source) ||
      (context && !plain(parsed.lastChild!, context)) ||
      !current.sameMarkup(parsed.firstChild!)
    )
      return null
    const transaction = state.tr.replaceWith(
      from + block.richDelta + 1,
      to + block.richDelta + 1,
      edit.insert ? state.schema.text(edit.insert) : [],
    )
    const owners = this.#owners.update(row.index, {
      kind: 'plain',
      length: row.owner.length + delta,
      parsed: true,
    })
    const classified = asciiParagraph(source)
    if (classified) this.#ascii.set(owners.get(row.index)!.owner, classified)
    return {
      transaction,
      next: new PlainSourceSync(
        prepared.after,
        transaction.doc,
        owners,
        this.#blocks,
        this.#ascii,
      ),
    }
  }
  advance(
    prepared: PreparedSourceOperation,
    state: EditorState,
    transaction: Transaction,
    document: Node,
    parse: (source: string) => JSONContent,
  ) {
    if (
      transaction.before !== state.doc ||
      transaction.steps.length !== 1 ||
      document !== transaction.doc
    )
      return null
    const step = transaction.steps[0]
    if (!(step instanceof ReplaceStep)) return null
    const planned = this.prepare(prepared, state, parse)
    const expected = planned?.transaction.steps[0]
    if (
      !planned ||
      !(expected instanceof ReplaceStep) ||
      step.from !== expected.from ||
      step.to !== expected.to ||
      step.toJSON().structure !== expected.toJSON().structure ||
      !step.slice.eq(expected.slice)
    )
      return null
    return new PlainSourceSync(
      prepared.after,
      document,
      planned.next.#owners,
      this.#blocks,
      this.#ascii,
    )
  }
}

/** Build only after successful full synchronization, under the caller's known
 * built-in grammar and identity-projection gate. Never call this for every key. */
export function createPlainSourceSync(
  source: SourceSnapshot,
  document: Node,
  serialized: Serialized,
) {
  if (!serialized.blocks || serialized.blocks.length !== document.childCount)
    return null
  const normalized = normalizeSource(source.materialize())
  if (
    !serialized.source ||
    !normalized.startsWith(serialized.source) ||
    !/^\n*$/.test(normalized.slice(serialized.source.length))
  )
    return null
  const records: { kind: string; length: number; parsed: boolean }[] = []
  const blocks: Block[] = []
  let offset = 0
  document.forEach((node, richPosition, index) => {
    const text = serialized.blocks![index]!.source
    const from = source.editorToRaw(offset)!
    const contentEnd = source.editorToRaw(offset + text.length)!
    const to =
      index === document.childCount - 1
        ? source.utf16Length
        : source.editorToRaw(offset + text.length + 2)!
    // A final empty native paragraph can own zero source units. Its predecessor
    // still keeps following-block context; no zero-length search entry is needed.
    if (to > from) {
      const isPlain = plain(node, text)
      records.push({
        kind: isPlain ? 'plain' : 'other',
        length: to - from,
        parsed: true,
      })
      blocks.push({
        index,
        richDelta: richPosition - offset,
        suffix: to - contentEnd,
        following: index + 1 < document.childCount,
        ascii: isPlain ? asciiParagraph(text) : null,
      })
    }
    offset += text.length + 2
  })
  return new PlainSourceSync(
    source,
    document,
    new SourceOwners(records),
    blocks,
  )
}
