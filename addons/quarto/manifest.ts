import { fileAssociations } from '../../shared/file-associations'
import {
  pandocDependency,
  quartoDependency,
} from '../_shared/tool-dependencies'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'quarto',
  name: 'Quarto Markdown',
  apiVersion: 2,
  version: '1.0.3',
  dependencies: [pandocDependency, quartoDependency],
  kind: 'extension',
  description: 'Edit and preview Quarto; run embedded code when you choose.',
  fileExtensions: fileAssociations.quarto.ext,
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
