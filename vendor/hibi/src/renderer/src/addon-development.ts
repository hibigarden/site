import { prepareBundledAddon } from './addon-registry'
import type { AddonReloadResult } from './addon-reload'

/** Loaded only by the development client; production has no subscription. */
export function watchAddonDevelopment(
  hot: NonNullable<ImportMeta['hot']>,
  reload: (
    id: string,
    scope: 'code' | 'styles',
    prepare: () => Promise<() => void>,
  ) => Promise<AddonReloadResult>,
) {
  if (window.hibiAddonWindow) return () => {}
  let pending = Promise.resolve()
  const update = (request: {
    id: string
    scope: 'code' | 'styles'
    contract: string
    revision: number
    catalog: string
    css: { after: string }[]
  }) => {
    pending = pending
      .then(async () => {
        const { default: catalog } = await import(
          /* @vite-ignore */ request.catalog
        )
        const item = catalog.find(
          (entry: { manifest: { id: string } }) =>
            entry.manifest.id === request.id,
        )
        if (
          request.scope === 'code' &&
          (await window.hibi.getAddonStates()).some(
            (state) => state.id === request.id && state.enabled,
          )
        ) {
          await item.load()
          await item.loadSettings?.()
        }
        const replacements = await Promise.all(
          request.css.map(async ({ after }) => {
            const next = await import(/* @vite-ignore */ after)
            return [next.previousCss, next.default, next.applyCss] as const
          }),
        )
        const publish = prepareBundledAddon(item, request.scope)
        const manifest = { ...item.manifest, entry: 'index.js' }
        let committed = false
        const result = await reload(request.id, request.scope, async () => {
          if (request.scope === 'code')
            await window.hibi.updateDevelopmentAddon?.(
              manifest,
              request.contract,
            )
          return () => {
            publish()
            committed = true
            for (const element of document.querySelectorAll<HTMLStyleElement>(
              'style[data-addon-style]',
            ))
              if (element.dataset.addonStyle?.startsWith(`${request.id}.`))
                for (const [before, after] of replacements)
                  if (
                    typeof before === 'string' &&
                    before &&
                    typeof after === 'string'
                  )
                    element.textContent = (
                      element.textContent ?? ''
                    ).replaceAll(before, after)
            for (const [, , apply] of replacements) apply?.()
          }
        })
        if (committed && request.scope === 'code')
          await window.hibi.updateDevelopmentAddon?.(
            manifest,
            request.contract,
            true,
          )
        hot.send('hibi:addon-result', {
          id: request.id,
          revision: request.revision,
          status: result.status,
        })
        if (result.status === 'refused' || result.status === 'failed') {
          console.warn(`addon ${request.id}: ${result.message}`)
        } else if (result.status !== 'superseded') {
          console.info(`addon ${request.id}: ${request.scope} ${result.status}`)
        }
      })
      .catch((error) =>
        console.error('addon update failed; keeping the running addon:', error),
      )
  }
  const failed = (error: string) =>
    console.error('addon update failed; keeping the running addon:', error)
  hot.on('hibi:addon-update', update)
  hot.on('hibi:addon-error', failed)
  return () => {
    hot.off('hibi:addon-update', update)
    hot.off('hibi:addon-error', failed)
  }
}
