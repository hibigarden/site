import type { MarkdownManager } from '@tiptap/markdown'
import type { Node } from '@tiptap/pm/model'
import { Transform } from '@tiptap/pm/transform'

/** Prove a source range corresponds to one literal rich-text replacement. Never use navigation maps. */
export function exactRichRange(
  document: Node,
  manager: MarkdownManager,
  body: string,
  from: number,
  to: number,
) {
  if (from < 0 || to < from || to > body.length) return null
  const marker = '\uE000hibi-range-probe\uE001'
  if (body.includes(marker)) return null
  try {
    const baseline = document.type.schema.nodeFromJSON(manager.parse(body))
    if (!baseline.eq(document)) return null
    const probe = document.type.schema.nodeFromJSON(
      manager.parse(body.slice(0, from) + marker + body.slice(to)),
    )
    const start = document.content.findDiffStart(probe.content)
    const end = document.content.findDiffEnd(probe.content)
    if (
      start === null ||
      !end ||
      end.b - start !== marker.length ||
      end.a < start
    )
      return null
    const left = document.resolve(start),
      right = document.resolve(end.a)
    if (
      !left.sameParent(right) ||
      !left.parent.isTextblock ||
      left.parent.type.spec.code ||
      document.textBetween(start, end.a, '', '\uFFFC') !==
        body.slice(from, to) ||
      probe.textBetween(start, end.b, '', '\uFFFC') !== marker
    )
      return null
    const marks = probe.resolve(start).nodeAfter?.marks ?? []
    if (marks.some((mark) => mark.type.spec.code)) return null
    const replaced = new Transform(document).replaceWith(
      start,
      end.a,
      document.type.schema.text(marker, marks),
    ).doc
    if (!replaced.eq(probe)) return null
    return { from: start, to: end.a, marks }
  } catch {
    return null
  }
}
