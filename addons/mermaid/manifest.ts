import { fileAssociations } from '../../shared/file-associations'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'mermaid',
  name: 'Mermaid',
  description: 'Write and preview diagrams.',
  apiVersion: 2,
  version: '1.0.0',
  kind: 'extension',
  defaultEnabled: false,
  // Markdown documents need it before editing, as well as its own diagram files.
  capabilities: ['ui', 'rich', 'source', 'markdown'],
  fileExtensions: fileAssociations.mermaid.ext,
  authors: [authors.may],
} satisfies AddonManifest
