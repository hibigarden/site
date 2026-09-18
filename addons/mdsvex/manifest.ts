import { fileAssociations } from '../../shared/file-associations'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'mdsvex',
  name: 'MDsveX',
  apiVersion: 2,
  version: '1.0.0',
  kind: 'extension',
  description: 'Edit and preview MDsveX; run embedded code when you choose.',
  fileExtensions: fileAssociations.mdsvex.ext,
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
