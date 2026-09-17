import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'vim',
  name: 'Vim',
  version: '0.2.0',
  authors: [authors.may, authors.angelo],
  description: 'Vim editing in Markdown and split source panes.',
  apiVersion: 1,
  defaultEnabled: false,
} satisfies AddonManifest
