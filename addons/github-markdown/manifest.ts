import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'github-markdown',
  name: 'GitHub Markdown',
  kind: 'extension',
  version: '1.1.0',
  apiVersion: 1,
  description:
    'Alerts, tables, task lists, strikethrough, and GitHub-style Markdown.',
  defaultEnabled: true,
  authors: [authors.may],
} satisfies AddonManifest
