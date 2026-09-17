import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'slash-commands',
  name: 'Slash commands',
  version: '0.1.0',
  authors: [authors.may],
  description: 'Insert Markdown blocks by typing / at the start of a line.',
  apiVersion: 1,
  defaultEnabled: true,
} satisfies AddonManifest
