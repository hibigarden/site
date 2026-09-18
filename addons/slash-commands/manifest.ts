import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'slash-commands',
  name: 'Slash commands',
  version: '0.1.0',
  authors: [authors.may],
  description: 'Type / at the start of a line to insert a block.',
  apiVersion: 2,
  defaultEnabled: true,
} satisfies AddonManifest
