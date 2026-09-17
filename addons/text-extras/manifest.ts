import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'text-extras',
  name: 'Text extras',
  description: 'Subscript and discord-style small text.',
  kind: 'extension',
  version: '1.0.0',
  apiVersion: 1,
  defaultEnabled: true,
  authors: [authors.may],
} satisfies AddonManifest
