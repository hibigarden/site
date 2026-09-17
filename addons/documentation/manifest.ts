import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'documentation',
  name: 'Documentation',
  version: '0.1.0',
  authors: [authors.may],
  description:
    'Publish a Markdown workspace as a searchable, self-contained static site.',
  apiVersion: 1,
  defaultEnabled: true,
} satisfies AddonManifest
