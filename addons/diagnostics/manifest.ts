import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'diagnostics',
  name: 'Diagnostics',
  version: '1.0.0',
  apiVersion: 2,
  description: 'Inspect startup timings, addon activity, and app performance.',
  defaultEnabled: false,
  startup: 'background',
  authors: [authors.may],
} satisfies AddonManifest
