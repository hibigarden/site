import type {
  AddonManifest,
  AddonSyntaxDescriptor,
  SourcePreservation,
} from '../addons/api'

export function validatePreservation(value: SourcePreservation | undefined) {
  if (
    value !== undefined &&
    (!value ||
      !['semantic', 'verbatim'].includes(value.level) ||
      typeof value.version !== 'string' ||
      !value.version.trim() ||
      value.version.length > 40)
  )
    throw new Error(
      'Declare a valid source preservation level and serializer version.',
    )
}
export function parseSyntaxDescriptors(
  value: unknown,
): readonly AddonSyntaxDescriptor[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 32)
    throw new Error('Invalid syntax ownership metadata.')
  const ids = new Set<string>()
  return value.map((item) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !/^[a-z][a-z0-9-]*$/.test(item.id) ||
      ids.has(item.id) ||
      !['flavor', 'projection'].includes(item.kind) ||
      !Array.isArray(item.markers) ||
      !item.markers.length ||
      item.markers.length > 8 ||
      item.markers.some(
        (marker: unknown) =>
          typeof marker !== 'string' || !marker || marker.length > 80,
      ) ||
      !item.preservation ||
      !['source', 'literal'].includes(item.preservation.fallback) ||
      (item.preservation.level === 'verbatim' &&
        item.preservation.fallback !== 'source')
    )
      throw new Error('Invalid syntax ownership metadata.')
    validatePreservation(item.preservation)
    ids.add(item.id)
    return {
      id: item.id,
      kind: item.kind,
      markers: [...item.markers],
      preservation: {
        level: item.preservation.level,
        version: item.preservation.version,
        fallback: item.preservation.fallback,
      },
    }
  })
}
export function needsOwnedSource(
  source: string,
  manifests: readonly AddonManifest[],
  enabled: ReadonlySet<string>,
) {
  return manifests.some((manifest) =>
    manifest.syntax?.some(
      (syntax) =>
        syntax.markers.some((marker) => source.includes(marker)) &&
        (enabled.has(manifest.id)
          ? syntax.kind === 'flavor' && syntax.preservation.level === 'verbatim'
          : syntax.preservation.fallback === 'source'),
    ),
  )
}
