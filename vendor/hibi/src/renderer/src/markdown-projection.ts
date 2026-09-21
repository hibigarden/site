import type { MarkdownExtension, MarkdownProjection } from '../../addons/api'

const proofs = new WeakMap<
  MarkdownExtension,
  { prefix: string; suffix: string; valid: boolean }
>()
export function projectMarkdown(
  source: string,
  adapters: readonly MarkdownExtension[],
): MarkdownProjection {
  let result: MarkdownProjection = {
    content: source,
    sourceOffset: 0,
    serialize: (content) => content,
  }
  for (const adapter of adapters) {
    const next = adapter.parse(result.content)
    if (!next) continue
    const previous = result
    const exact =
      next.sourceOffset !== undefined &&
      Number.isSafeInteger(next.sourceOffset) &&
      next.sourceOffset >= 0 &&
      previous.content.slice(
        next.sourceOffset,
        next.sourceOffset + next.content.length,
      ) === next.content
    let serialize = next.serialize
    if (adapter.preservation?.level === 'verbatim') {
      if (!exact)
        return {
          content: source,
          sourceOffset: 0,
          serialize: () => source,
          readOnly: true,
        }
      const prefix = previous.content.slice(0, next.sourceOffset)
      const suffix = previous.content.slice(
        next.sourceOffset! + next.content.length,
      )
      let proof = proofs.get(adapter)
      if (!proof || proof.prefix !== prefix || proof.suffix !== suffix) {
        const marker = 'hibi-projection-body'
        const projected = adapter.parse(prefix + marker + suffix)
        proof = {
          prefix,
          suffix,
          valid:
            projected?.content === marker &&
            projected.sourceOffset === prefix.length,
        }
        proofs.set(adapter, proof)
      }
      if (!proof.valid)
        return {
          content: source,
          sourceOffset: 0,
          serialize: () => source,
          readOnly: true,
        }
      // The host owns untouched bytes; a addon serializer cannot rewrite these regions.
      serialize = (content) => prefix + content + suffix
    }
    result = {
      content: next.content,
      ...(exact && previous.sourceOffset !== undefined
        ? { sourceOffset: previous.sourceOffset + next.sourceOffset! }
        : {}),
      serialize: (content) => previous.serialize(serialize(content)),
      readOnly: Boolean(previous.readOnly || next.readOnly),
    }
  }
  return result
}
