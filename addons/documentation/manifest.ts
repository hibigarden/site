import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'documentation',
  name: 'Export',
  version: '0.2.3',
  authors: [authors.may],
  description: 'Customize and export your workspace as a website.',
  apiVersion: 2,
  defaultEnabled: true,
  startup: 'background',
} satisfies AddonManifest
