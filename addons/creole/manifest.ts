import { fileAssociations } from '../../shared/file-associations'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'creole',
  name: 'Creole',
  apiVersion: 2,
  version: '1.0.0',
  kind: 'extension',
  description: 'Edit, preview, and export Creole documents.',
  fileExtensions: fileAssociations.creole.ext,
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
