import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'tags',
  name: 'Tags',
  kind: 'extension',
  version: '1.0.0',
  apiVersion: 2,
  description: 'Organize notes with #tags and find them in the sidebar.',
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
