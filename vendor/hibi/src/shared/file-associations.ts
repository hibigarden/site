/** Shared by bundled format manifests, installers, and desktop settings. */
export const fileAssociations = {
  text: { name: 'Plain text', ext: ['txt'], mimeType: 'text/plain' },
  markdown: {
    name: 'Markdown',
    ext: ['md', 'markdown'],
    mimeType: 'text/markdown',
  },
  mdx: { name: 'MDX', ext: ['mdx'], mimeType: 'text/x-mdx' },
  math: { name: 'LaTeX', ext: ['tex'], mimeType: 'text/x-tex' },
  rst: { name: 'reStructuredText', ext: ['rst'], mimeType: 'text/x-rst' },
  asciidoc: {
    name: 'AsciiDoc',
    ext: ['adoc', 'asciidoc'],
    mimeType: 'text/x-asciidoc',
  },
  org: { name: 'Org mode', ext: ['org'], mimeType: 'text/org' },
  typst: { name: 'Typst', ext: ['typ'], mimeType: 'text/x-typst' },
  html: { name: 'HTML', ext: ['html', 'htm'], mimeType: 'text/html' },
  mediawiki: {
    name: 'MediaWiki',
    ext: ['wiki', 'mediawiki'],
    mimeType: 'text/x-mediawiki',
  },
  rmarkdown: {
    name: 'R Markdown',
    ext: ['rmd'],
    mimeType: 'text/x-r-markdown',
  },
  quarto: { name: 'Quarto', ext: ['qmd'], mimeType: 'text/x-quarto' },
  mdsvex: { name: 'MDsveX', ext: ['svx'], mimeType: 'text/x-mdsvex' },
  markdoc: { name: 'Markdoc', ext: ['mdoc'], mimeType: 'text/x-markdoc' },
  djot: { name: 'Djot', ext: ['dj'], mimeType: 'text/x-djot' },
  textile: { name: 'Textile', ext: ['textile'], mimeType: 'text/x-textile' },
  creole: { name: 'Creole', ext: ['creole'], mimeType: 'text/x-creole' },
  mermaid: {
    name: 'Mermaid',
    ext: ['mmd', 'mermaid'],
    mimeType: 'text/x-mermaid',
  },
  bbcode: { name: 'BBCode', ext: ['bbcode', 'bbc'], mimeType: 'text/x-bbcode' },
}
export const DESKTOP_APP_ID = 'com.ryanaque.hibi'
export const ASSOCIATION_CHANNELS = {
  get: 'associations:get',
  set: 'associations:set',
} as const
export type FileAssociationState = {
  available: boolean
  systemSettings: boolean
  defaults: string[]
}
