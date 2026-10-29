import type { Node } from '@tiptap/pm/model'

/** Built-in fenced previews cache spelling in raw; source carries their meaning. */
export function sameRichSourceDocument(
  parsed: Node | null,
  expected: Node,
  builtInGrammar: boolean,
): boolean {
  if (!parsed) return false
  if (parsed.eq(expected)) return true
  if (!builtInGrammar) return false
  const attrs =
    expected.type.name === 'typstBlock' || expected.type.name === 'mermaidBlock'
      ? { ...expected.attrs, raw: parsed.attrs.raw }
      : expected.attrs
  if (
    !parsed.hasMarkup(expected.type, attrs, expected.marks) ||
    parsed.text !== expected.text ||
    parsed.childCount !== expected.childCount
  )
    return false
  for (let index = 0; index < parsed.childCount; index++)
    if (
      !sameRichSourceDocument(parsed.child(index), expected.child(index), true)
    )
      return false
  return true
}

/** Apply a rich edit to the original Markdown only when parsing proves it. */
export function preserveRichSource(
  original: string,
  before: string,
  after: string,
  matches: (candidate: string) => boolean,
  maximumParses = 8,
) {
  let prefix = 0
  while (prefix < before.length && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  )
    suffix++
  const removed = before.slice(prefix, before.length - suffix)
  const inserted = after.slice(prefix, after.length - suffix)
  const eol = original.includes('\r\n') ? '\r\n' : '\n'
  const replacements =
    !removed && /^\n{2,}$/.test(inserted)
      ? Array.from({ length: inserted.length }, (_, index) =>
          eol.repeat(index + 1),
        )
      : [inserted.replaceAll('\n', eol)]

  const expected = (prefix * original.length) / (before.length || 1)
  const unique = new Set<number>()
  const ambiguous = new Set<number>()
  const occurrenceDistance = new Map<number, number>()
  for (const width of [32, 16, 8, 4, 3, 2, 1, 0]) {
    const left = before.slice(Math.max(0, prefix - width), prefix)
    const right = before.slice(
      before.length - suffix,
      before.length - suffix + width,
    )
    // Normalized delimiters can hide either adjacent source character.
    const contexts: [string, string][] =
      !width && !removed
        ? [
            [before[prefix - 1] ?? '', ''],
            ['', before[before.length - suffix] ?? ''],
          ]
        : [[left, right]]
    const positions = new Set<number>()
    for (const [contextBefore, contextAfter] of contexts) {
      const needle = contextBefore + removed + contextAfter
      if (!needle) continue
      let occurrence = 0
      for (
        let at = before.indexOf(needle);
        at !== -1 && at < prefix - contextBefore.length;
        at = before.indexOf(needle, at + 1)
      )
        occurrence++
      let index = 0
      for (
        let at = original.indexOf(needle);
        at !== -1;
        at = original.indexOf(needle, at + 1)
      ) {
        const position = at + contextBefore.length
        positions.add(position)
        occurrenceDistance.set(
          position,
          Math.min(
            occurrenceDistance.get(position) ?? Infinity,
            Math.abs(index++ - occurrence),
          ),
        )
      }
    }
    for (const position of positions)
      (positions.size === 1 ? unique : ambiguous).add(position)
  }
  const groups = [...unique].map((position) => [position])
  const nearest = [...ambiguous]
    .filter((position) => !unique.has(position))
    .sort(
      (a, b) =>
        occurrenceDistance.get(a)! - occurrenceDistance.get(b)! ||
        Math.abs(a - expected) - Math.abs(b - expected),
    )
  // Match occurrence order before distance: normalization can shrink whole blocks.
  // A full parse establishes meaning; equally ranked proven edits stay ambiguous.
  for (const position of nearest) {
    const group = groups.at(-1)
    if (
      group &&
      !unique.has(group[0]!) &&
      occurrenceDistance.get(group[0]!) === occurrenceDistance.get(position) &&
      Math.abs(group[0]! - expected) === Math.abs(position - expected)
    )
      group.push(position)
    else groups.push([position])
  }
  const tested = new Map<string, boolean>()
  for (const positions of groups) {
    for (const replacement of replacements) {
      const proven = new Set<string>()
      for (const from of positions) {
        const candidate =
          original.slice(0, from) +
          replacement +
          original.slice(from + removed.length)
        if (!tested.has(candidate)) {
          if (tested.size >= maximumParses) return null
          tested.set(candidate, false)
          try {
            tested.set(candidate, matches(candidate))
          } catch {
            // Invalid candidate Markdown is not a source edit proof.
          }
        }
        if (tested.get(candidate)) proven.add(candidate)
      }
      if (proven.size === 1) return proven.values().next().value ?? null
      if (proven.size > 1) return null
    }
  }
  return null
}
