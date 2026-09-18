import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'block-drag',
  name: 'Block dragging',
  version: '1.0.0',
  apiVersion: 2,
  description: 'Drag paragraphs, headings, and list items to move them.',
  defaultEnabled: false,
  startup: 'background',
  authors: [authors.may],
} satisfies AddonManifest
