export type CodeSpan = { from: number; to: number; closed: boolean }

/**
 * Inline code spans in `text`, backticks included: a heuristic that follows
 * CommonMark's code span rules for backticks only. A backtick run opens a
 * span that only the next run of equal length closes. A backslash outside
 * code escapes the first backtick of an opening run; inside a span
 * backslashes are literal, so they never stop a closing run. A run with no
 * closer gives a span that is not `closed` and extends to the end of `text`,
 * as while code is still being typed; CommonMark would treat it as literal
 * once the paragraph ends, so a later pair is hidden (example 349). Raw HTML
 * and autolinks are not recognized, so backticks inside them still make
 * spans (examples 344 and 346).
 */
export function codeSpans(text: string): readonly CodeSpan[] {
  const runs = [...text.matchAll(/`+/g)].map((match) => {
    let slashes = 0
    while (text[match.index - 1 - slashes] === '\\') slashes++
    return {
      start: match.index,
      length: match[0].length,
      escaped: slashes % 2 === 1,
    }
  })
  const spans: CodeSpan[] = []
  for (let index = 0; index < runs.length; index++) {
    const run = runs[index]
    if (!run) break
    const from = run.start + Number(run.escaped)
    const length = run.length - Number(run.escaped)
    if (!length) continue
    const closer = runs.find(
      (other, later) => later > index && other.length === length,
    )
    if (!closer) {
      spans.push({ from, to: text.length, closed: false })
      break
    }
    spans.push({ from, to: closer.start + length, closed: true })
    index = runs.indexOf(closer)
  }
  return spans
}
