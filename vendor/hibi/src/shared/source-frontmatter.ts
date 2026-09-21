import { isMap, parseDocument } from 'yaml'
import type { SourceSnapshot } from './source-buffer.ts'
import type { RawEdit } from './source-operations.ts'

export type FrontmatterBounds = Readonly<{
  yamlFrom: number
  yamlTo: number
  headerTo: number
  contentFrom: number
  eol: '\n' | '\r\n'
}>
export type FrontmatterRead = Readonly<{
  bounds: FrontmatterBounds | null
  inspectedTo: number
  dependsOnEnd: boolean
}>

/** A completed read owns only scalars. Its unfinished generator owns the input. */
export function* readSourceFrontmatter(
  source: SourceSnapshot,
): Generator<void, FrontmatterRead> {
  const chunks = source.chunks()[Symbol.iterator]()
  let chunk = '',
    chunkFrom = 0,
    position = 0,
    inspectedTo = 0,
    dependsOnEnd = false
  const peek = () => {
    if (position === source.utf16Length) {
      dependsOnEnd = true
      return ''
    }
    while (position >= chunkFrom + chunk.length) {
      chunkFrom += chunk.length
      chunk = chunks.next().value!
    }
    inspectedTo = Math.max(inspectedTo, position + 1)
    return chunk[position - chunkFrom]!
  }
  const take = () => {
    const character = peek()
    if (character) position++
    return character
  }
  const finish = (bounds: FrontmatterBounds | null): FrontmatterRead =>
    Object.freeze({
      bounds: bounds && Object.freeze(bounds),
      inspectedTo,
      dependsOnEnd,
    })
  function* spaces() {
    while (peek() === ' ' || peek() === '\t') {
      take()
      if (position % 4096 === 0) yield
    }
  }
  try {
    if (peek() === '\uFEFF') take()
    for (let count = 0; count < 3; count++)
      if (take() !== '-') return finish(null)
    yield* spaces()
    const cr = peek() === '\r'
    if (cr) take()
    if (take() !== '\n') return finish(null)
    const yamlFrom = position,
      eol = cr ? '\r\n' : '\n'
    let lineStart = true
    while (position < source.utf16Length) {
      if (lineStart && (peek() === '-' || peek() === '.')) {
        const yamlTo = position,
          marker = take()
        lineStart = false
        if (peek() === marker) {
          take()
          if (peek() === marker) {
            take()
            yield* spaces()
            const ending = peek()
            if (!ending || /[\r\n\u2028\u2029]/.test(ending)) {
              let headerTo = position,
                bareCr = false
              if (ending === '\r') {
                take()
                bareCr = peek() !== '\n'
              }
              if (peek() === '\n') {
                take()
                headerTo = position
              }
              try {
                if (
                  !isMap(
                    parseDocument(source.sliceRaw(yamlFrom, yamlTo)).contents,
                  )
                )
                  return finish(null)
              } catch {
                return finish(null)
              }
              let contentFrom = headerTo
              // JS multiline $ accepts bare CR and Unicode separators; the
              // spacing expression accepts only LF/CRLF, exactly like the oracle.
              if (!bareCr) {
                for (;;) {
                  yield* spaces()
                  if (peek() === '\r') take()
                  if (peek() !== '\n') break
                  take()
                  contentFrom = position
                }
              }
              return finish({ yamlFrom, yamlTo, headerTo, contentFrom, eol })
            }
          }
        }
      }
      lineStart = /[\r\n\u2028\u2029]/.test(take())
      if (position % 4096 === 0) yield
    }
    // No closing marker: a future append can complete one.
    dependsOnEnd = true
    return finish(null)
  } finally {
    chunks.return?.()
  }
}

/** Changes use pre-state coordinates; insertions at an inspected EOF invalidate. */
export function reuseFrontmatterRead(
  read: FrontmatterRead,
  changes: readonly RawEdit[],
) {
  return changes.every(
    (change) =>
      change.from >= read.inspectedTo &&
      (!read.dependsOnEnd || change.from !== read.inspectedTo),
  )
}
