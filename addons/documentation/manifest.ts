import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'documentation',
  name: 'Export',
  version: '0.1.0',
  authors: [authors.may],
  description: 'Export your workspace as one searchable HTML file.',
  apiVersion: 2,
  defaultEnabled: true,
  startup: 'background',
} satisfies AddonManifest
