/** CodeMirror normalizes line breaks; document APIs retain the original UTF-16 source. */
export const normalizeSource = (source: string) =>
  source.replace(/\r\n?/g, '\n')
export function sourceText(
  source: string,
  lineBreak = /\r\n|\r|\n/.exec(source)?.[0] ?? '\n',
) {
  const sourceEnds: number[] = [],
    editorEnds: number[] = []
  for (const match of source.matchAll(/\r\n/g)) {
    sourceEnds.push(match.index + 2)
    editorEnds.push(match.index + 2 - sourceEnds.length)
  }
  const count = (positions: number[], at: number) => {
    let low = 0,
      high = positions.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (positions[middle]! <= at) low = middle + 1
      else high = middle
    }
    return low
  }
  const toSource = (position: number) => position + count(editorEnds, position)
  const toEditor = (position: number) => {
    if (
      position < 0 ||
      position > source.length ||
      !Number.isSafeInteger(position)
    )
      return null
    const before = count(sourceEnds, position)
    return sourceEnds[before] === position + 1 ? null : position - before
  }
  return {
    source,
    text: normalizeSource(source),
    lineBreak,
    nativeLineBreaks: lineBreak !== '\n' || source.includes('\r'),
    toSource,
    toEditor,
    apply(changes: readonly { from: number; to: number; insert: string }[]) {
      const parts: string[] = []
      let end = 0
      for (const change of changes) {
        const from = toSource(change.from),
          to = toSource(change.to)
        parts.push(
          source.slice(end, from),
          normalizeSource(change.insert).replaceAll('\n', lineBreak),
        )
        end = to
      }
      parts.push(source.slice(end))
      return parts.join('')
    },
  }
}
