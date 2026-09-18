import { fileAssociations } from '../../shared/file-associations'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'djot',
  name: 'Djot',
  apiVersion: 2,
  version: '1.0.0',
  kind: 'extension',
  description: 'Edit, preview, and export Djot documents.',
  fileExtensions: fileAssociations.djot.ext,
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
