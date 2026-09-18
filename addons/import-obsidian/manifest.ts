import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'import-obsidian',
  name: 'Import from Obsidian',
  description: 'Bring notes and attachments from an Obsidian vault.',
  apiVersion: 2,
  version: '1.0.0',
  kind: 'extension',
  defaultEnabled: false,
  authors: [authors.may],
  importer: {
    sources: ['folder'],
    instructions: 'Choose your Obsidian vault folder.',
  },
} satisfies AddonManifest
