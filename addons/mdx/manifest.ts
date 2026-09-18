import { fileAssociations } from '../../shared/file-associations'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'mdx',
  name: 'MDX',
  apiVersion: 2,
  version: '1.0.0',
  kind: 'extension',
  description: 'Edit and preview MDX; run embedded code when you choose.',
  fileExtensions: fileAssociations.mdx.ext,
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
