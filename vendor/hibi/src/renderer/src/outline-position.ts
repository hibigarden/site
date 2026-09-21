/** Last heading at or before a caret, in document order (including equal offsets). */
export function outlineHeadingAt<T>(
  headings: readonly T[],
  position: number,
  offset: (heading: T) => number,
): T | undefined {
  let from = 0,
    to = headings.length
  while (from < to) {
    const middle = Math.floor((from + to) / 2)
    if (offset(headings[middle]!) <= position) from = middle + 1
    else to = middle
  }
  return headings[from - 1]
}
