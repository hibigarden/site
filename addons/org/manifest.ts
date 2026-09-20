import { fileAssociations } from '../../shared/file-associations'
import { pandocDependency } from '../_shared/tool-dependencies'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'org',
  name: 'Org mode',
  apiVersion: 2,
  version: '1.0.2',
  dependencies: [pandocDependency],
  kind: 'extension',
  description: 'Edit, preview, and export Org mode documents.',
  fileExtensions: fileAssociations.org.ext,
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
