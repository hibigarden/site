import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'github-markdown',
  name: 'GitHub Markdown',
  kind: 'extension',
  version: '1.1.2',
  apiVersion: 2,
  description: 'Add alerts, tables, task lists, and strikethrough to Markdown.',
  defaultEnabled: true,
  authors: [authors.may],
} satisfies AddonManifest
