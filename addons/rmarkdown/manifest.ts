import { fileAssociations } from '../../shared/file-associations'
import { pandocDependency, rDependency } from '../_shared/tool-dependencies'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'rmarkdown',
  name: 'R Markdown',
  apiVersion: 2,
  version: '1.0.3',
  dependencies: [pandocDependency, rDependency],
  kind: 'extension',
  description:
    'Edit and preview R Markdown; run embedded code when you choose.',
  fileExtensions: fileAssociations.rmarkdown.ext,
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
