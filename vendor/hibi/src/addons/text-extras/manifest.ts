import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'text-extras',
  name: 'text extras',
  description: 'subscript and discord-style small text.',
  kind: 'extension',
  version: '1.0.0',
  apiVersion: 1,
  defaultEnabled: true,
  authors: [authors.may],
} satisfies AddonManifest
