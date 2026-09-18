import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'review',
  name: 'Review',
  version: '1.0.0',
  apiVersion: 2,
  description: 'Find repeated words and common English typos.',
  defaultEnabled: false,
  startup: 'background',
  capabilities: ['ui'],
  analysis: { entry: 'analysis.js' },
  authors: [authors.may],
} satisfies AddonManifest
