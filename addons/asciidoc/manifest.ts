import { fileAssociations } from '../../shared/file-associations'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'asciidoc',
  name: 'AsciiDoc',
  apiVersion: 2,
  version: '1.0.0',
  kind: 'extension',
  description: 'Edit, preview, and export AsciiDoc documents.',
  fileExtensions: fileAssociations.asciidoc.ext,
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
