export type AddonRequirements = {
  addons: readonly { id: string; optional?: boolean }[]
}

type Manifest = { id: string; name?: string; requires?: AddonRequirements }

export function parseAddonRequirements(
  value: unknown,
  ownerId: string,
): AddonRequirements | undefined {
  if (value === undefined) return undefined
  const invalid = (reason: string): never => {
    throw new Error(`Addon "${ownerId}" requirements: ${reason}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid('requires must be an object with an addons array.')
  const input = value as Record<string, unknown>
  if (
    !Array.isArray(input.addons) ||
    Object.keys(input).some((key) => key !== 'addons')
  )
    return invalid('requires must contain only an addons array.')
  if (input.addons.length > 32)
    return invalid('declare at most 32 addon dependencies.')
  const ids = new Set<string>()
  const addons = []
  for (const entry of input.addons) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      return invalid('each dependency must be an object with an id.')
    const item = entry as Record<string, unknown>
    if (Object.keys(item).some((key) => key !== 'id' && key !== 'optional'))
      return invalid('dependency entries may contain only id and optional.')
    if (typeof item.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.id))
      return invalid('dependency id must match /^[a-z][a-z0-9-]*$/.')
    if (item.id === ownerId)
      return invalid(`addon "${ownerId}" cannot require itself.`)
    if (ids.has(item.id)) return invalid(`duplicate dependency "${item.id}".`)
    if (item.optional !== undefined && typeof item.optional !== 'boolean')
      return invalid(`dependency "${item.id}" optional must be a boolean.`)
    ids.add(item.id)
    addons.push({
      id: item.id,
      ...(item.optional === undefined ? {} : { optional: item.optional }),
    })
  }
  return { addons }
}

function dependencyGraph(
  manifests: readonly Manifest[],
  allowMissing: boolean,
) {
  const addons = new Map<string, AddonRequirements['addons']>()
  for (const manifest of manifests) {
    if (addons.has(manifest.id))
      throw new Error(`Duplicate addon id "${manifest.id}".`)
    addons.set(
      manifest.id,
      parseAddonRequirements(manifest.requires, manifest.id)?.addons ?? [],
    )
  }
  const order: string[] = []
  const visited = new Set<string>()
  const path: string[] = []
  const visiting = new Set<string>()
  const visit = (id: string) => {
    if (visiting.has(id))
      throw new Error(
        `Addon dependency cycle: ${[...path.slice(path.indexOf(id)), id].join(' -> ')}.`,
      )
    if (visited.has(id)) return
    visiting.add(id)
    path.push(id)
    for (const dependency of addons.get(id) ?? []) {
      if (addons.has(dependency.id)) visit(dependency.id)
      else if (!dependency.optional && !allowMissing)
        throw new Error(
          `Addon "${id}" requires unknown addon "${dependency.id}".`,
        )
    }
    path.pop()
    visiting.delete(id)
    visited.add(id)
    order.push(id)
  }
  for (const id of addons.keys()) visit(id)
  return { addons, order }
}

/** Whether an addon belongs to a cycle, including optional dependencies. */
export function isAddonInDependencyCycle(
  addons: ReadonlyMap<string, Manifest>,
  id: string,
): boolean {
  const visited = new Set<string>()
  const reachesOwner = (owner: string): boolean => {
    for (const dependency of addons.get(owner)?.requires?.addons ?? []) {
      if (dependency.id === id) return true
      if (visited.has(dependency.id)) continue
      visited.add(dependency.id)
      if (reachesOwner(dependency.id)) return true
    }
    return false
  }
  return reachesOwner(id)
}

export function validateAddonRequirements(
  manifests: readonly Manifest[],
  options: { allowMissing?: boolean } = {},
): void {
  dependencyGraph(manifests, options.allowMissing ?? false)
}

export function resolveAddonDependencies(
  manifests: readonly Manifest[],
  states: readonly { id: string; enabled: boolean }[],
): { order: string[]; blocked: Map<string, string[]> } {
  const graph = dependencyGraph(manifests, true)
  const enabled = new Set(
    states.filter((state) => state.enabled).map((state) => state.id),
  )
  const blocked = new Map<string, string[]>()
  const order: string[] = []
  for (const id of graph.order) {
    if (!enabled.has(id)) continue
    const blockers = new Set<string>()
    for (const dependency of graph.addons.get(id) ?? []) {
      if (dependency.optional) continue
      const roots =
        !graph.addons.has(dependency.id) || !enabled.has(dependency.id)
          ? [dependency.id]
          : (blocked.get(dependency.id) ?? [])
      for (const root of roots) blockers.add(root)
    }
    if (blockers.size) blocked.set(id, [...blockers])
    else order.push(id)
  }
  return { order, blocked }
}

function requiredDependencies(
  addons: ReadonlyMap<string, AddonRequirements['addons']>,
  id: string,
): string[] {
  const visited = new Set<string>()
  const order: string[] = []
  const visit = (owner: string) => {
    for (const dependency of addons.get(owner) ?? []) {
      if (dependency.optional || visited.has(dependency.id)) continue
      visited.add(dependency.id)
      visit(dependency.id)
      order.push(dependency.id)
    }
  }
  visit(id)
  return order
}

/** Required dependencies in load order, including missing ids. */
export function requiredAddonDependencies(
  manifests: readonly Manifest[],
  id: string,
): string[] {
  return requiredDependencies(dependencyGraph(manifests, true).addons, id)
}

type Activation = { id: string; startup?: string; activation?: string }

/** Editor windows start only addons that start with documents, never background or command-activated ones. */
export function startsInWindow(manifest: Activation): boolean {
  return manifest.startup !== 'background' && manifest.activation !== 'command'
}

/** Required addons that start only in the background or from a command, which editor windows never do. */
export function backgroundAddonDependencies(
  manifests: readonly Activation[],
  dependencies: readonly string[],
): string[] {
  return dependencies.filter((id) =>
    manifests.some(
      (manifest) => manifest.id === id && !startsInWindow(manifest),
    ),
  )
}

/** All required closures share one graph validation. */
export function requiredAddonDependencyMap(
  manifests: readonly Manifest[],
): Map<string, string[]> {
  const { addons } = dependencyGraph(manifests, true)
  return new Map(
    [...addons.keys()].map((id) => [id, requiredDependencies(addons, id)]),
  )
}

/** Required dependents in unload order, furthest consumers first. */
export function addonDependents(
  manifests: readonly Manifest[],
  id: string,
): string[] {
  const { addons, order } = dependencyGraph(manifests, true)
  const dependents = new Set<string>()
  for (const owner of order)
    if (
      addons
        .get(owner)
        ?.some(
          (dependency) =>
            !dependency.optional &&
            (dependency.id === id || dependents.has(dependency.id)),
        )
    )
      dependents.add(owner)
  return order.filter((owner) => dependents.has(owner)).reverse()
}
