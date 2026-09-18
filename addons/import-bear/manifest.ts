import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'import-bear',
  name: 'Import from Bear',
  description: 'Bring notes and images from a Bear export.',
  apiVersion: 2,
  version: '1.0.0',
  kind: 'extension',
  defaultEnabled: false,
  authors: [authors.may],
  importer: {
    sources: ['folder', 'zip'],
    instructions:
      'Choose a Bear Markdown or TextBundle export. Export as TextBundle to include images.',
  },
} satisfies AddonManifest
