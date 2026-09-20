import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'graph',
  name: 'Graph',
  kind: 'extension',
  version: '1.0.2',
  apiVersion: 2,
  description: 'See links between your notes and open them from a graph.',
  defaultEnabled: false,
  startup: 'background',
  authors: [authors.may],
} satisfies AddonManifest
