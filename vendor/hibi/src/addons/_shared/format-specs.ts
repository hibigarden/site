export type FormatSpec = {
  id: string
  name: string
  extensions: string[]
  reader: string
  engine?: 'latex' | 'mdx' | 'mdsvex' | 'rmarkdown' | 'quarto'
}

const backends: Record<string, Pick<FormatSpec, 'reader' | 'engine'>> = {
  math: { reader: 'latex', engine: 'latex' },
  mdx: { reader: 'mdx', engine: 'mdx' },
  mdsvex: { reader: 'mdsvex', engine: 'mdsvex' },
  rmarkdown: { reader: 'markdown', engine: 'rmarkdown' },
  quarto: { reader: 'markdown', engine: 'quarto' },
}

export const formatSpec = (
  manifest: import('../api').AddonManifest,
): FormatSpec => ({
  id: manifest.id,
  name: manifest.name,
  extensions: [...(manifest.fileExtensions ?? [])],
  ...(backends[manifest.id] ?? { reader: manifest.id }),
})

export type LatexPackages = { names: string[]; downloaded: string[] }

export type FormatResult = {
  packages?: LatexPackages
  executed?: boolean
  html?: string
  pdf?: Uint8Array
  diagnostics?: string
}
