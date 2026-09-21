import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'github-markdown',
  name: 'github markdown',
  kind: 'extension',
  version: '1.1.0',
  apiVersion: 1,
  description:
    'alerts, tables, task lists, strikethrough, and github-style markdown.',
  defaultEnabled: true,
  authors: [authors.may],
} satisfies AddonManifest
