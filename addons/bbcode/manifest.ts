import { fileAssociations } from '../../shared/file-associations'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'bbcode',
  name: 'BBCode',
  description: 'Edit and preview BBCode documents.',
  apiVersion: 2,
  version: '1.0.0',
  kind: 'extension',
  defaultEnabled: false,
  fileExtensions: fileAssociations.bbcode.ext,
  authors: [authors.may],
} satisfies AddonManifest
