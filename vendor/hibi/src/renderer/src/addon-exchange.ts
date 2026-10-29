import type {
  AddonAccessApi,
  AddonExports,
  AddonExportsApi,
  AddonManifest,
} from '../../addons/api'

/** Lifetime-scoped references shared by trusted addons in this renderer. */
export function createAddonExchange() {
  const providers = new Map<
    string,
    { active: boolean; publication?: { api: AddonExports } }
  >()
  return {
    scope(manifest: AddonManifest, activate: (id: string) => Promise<void>) {
      const provider = { active: false } as {
        active: boolean
        publication?: { api: AddonExports }
      }
      providers.set(manifest.id, provider)
      let disposed = false
      const declared = new Set(manifest.requires?.addons.map(({ id }) => id))
      const check = (id: string) => {
        if (!declared.has(id))
          throw new Error(
            `The ${manifest.id} addon must declare ${id} in requires.addons.`,
          )
      }
      const get: AddonAccessApi['get'] = <T extends AddonExports>(
        id: string,
      ) => {
        check(id)
        if (disposed) return undefined
        const target = providers.get(id)
        return target?.active
          ? (target.publication?.api as T | undefined)
          : undefined
      }
      const exports: AddonExportsApi = {
        provide(api) {
          if (disposed) throw new Error('This addon has stopped.')
          if (
            !api ||
            typeof api !== 'object' ||
            ![Object.prototype, null].includes(Object.getPrototypeOf(api)) ||
            !Number.isSafeInteger(api.version) ||
            api.version < 1
          )
            throw new Error(
              'An exported addon API must be a plain object with a positive integer version.',
            )
          const publication = { api }
          provider.publication = publication
          return () => {
            if (provider.publication === publication)
              delete provider.publication
          }
        },
      }
      const addons: AddonAccessApi = {
        get,
        async ready<T extends AddonExports>(id: string) {
          check(id)
          if (disposed) return undefined
          try {
            await activate(id)
          } catch {
            return undefined
          }
          return get<T>(id)
        },
      }
      return {
        exports,
        addons,
        commit() {
          if (!disposed) provider.active = true
        },
        dispose() {
          disposed = true
          provider.active = false
          delete provider.publication
          if (providers.get(manifest.id) === provider)
            providers.delete(manifest.id)
        },
      }
    },
  }
}
