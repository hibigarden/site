import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'math',
  name: 'Math',
  kind: 'extension',
  version: '1.0.0',
  apiVersion: 1,
  description: 'Optional inline and block latex, rendered locally with katex.',
  defaultEnabled: false,
  authors: [authors.may],
} satisfies AddonManifest
