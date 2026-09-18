import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'typing-speed',
  name: 'Typing speed',
  version: '1.1.0',
  apiVersion: 2,
  description:
    'See your estimated words and characters per minute as you type.',
  defaultEnabled: false,
  startup: 'background',
  authors: [authors.may],
} satisfies AddonManifest
