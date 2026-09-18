import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'import-notion',
  name: 'Import from Notion',
  description: 'Bring pages and databases from a Notion export.',
  apiVersion: 2,
  version: '1.0.0',
  kind: 'extension',
  defaultEnabled: false,
  authors: [authors.may],
  importer: {
    sources: ['zip', 'folder'],
    instructions:
      'Export from Notion as Markdown & CSV, including subpages and files.',
  },
} satisfies AddonManifest
