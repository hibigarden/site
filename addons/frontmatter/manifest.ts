import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'frontmatter',
  name: 'Frontmatter',
  version: '0.1.0',
  authors: [authors.may],
  description:
    'Edit YAML properties while preserving metadata and the document body.',
  apiVersion: 1,
  defaultEnabled: true,
} satisfies AddonManifest
