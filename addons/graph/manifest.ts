import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'graph',
  name: 'Graph',
  kind: 'extension',
  version: '1.0.0',
  apiVersion: 1,
  description:
    'Explore connections between notes in an interactive workspace graph.',
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
