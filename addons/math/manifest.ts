import { fileAssociations } from '../../shared/file-associations'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'math',
  name: 'LaTeX',
  kind: 'extension',
  version: '1.1.0',
  apiVersion: 2,
  description:
    'Write LaTeX documents, export PDFs, and add equations to Markdown.',
  defaultEnabled: false,
  fileExtensions: fileAssociations.math.ext,
  authors: [authors.may],
} satisfies AddonManifest
