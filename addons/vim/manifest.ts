import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'vim',
  name: 'Vim',
  version: '0.2.0',
  authors: [authors.may, authors.angelo],
  description: 'Use Vim keys and commands in source views.',
  apiVersion: 2,
  defaultEnabled: false,
} satisfies AddonManifest
