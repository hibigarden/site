import { fileAssociations } from '../../shared/file-associations'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'html',
  name: 'HTML',
  apiVersion: 2,
  version: '1.0.1',
  kind: 'extension',
  description: 'Edit, preview, and export HTML documents.',
  fileExtensions: fileAssociations.html.ext,
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
