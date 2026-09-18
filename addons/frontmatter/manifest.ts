import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'frontmatter',
  name: 'Frontmatter',
  version: '0.1.0',
  authors: [authors.may],
  description: 'Edit note properties stored in YAML, such as titles and dates.',
  apiVersion: 2,
  defaultEnabled: true,
} satisfies AddonManifest
