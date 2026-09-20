import { gitDependency } from '../_shared/tool-dependencies'
import type { AddonManifest } from '../api'
import { authors } from '../authors'
export default {
  id: 'git',
  name: 'Git',
  kind: 'extension',
  version: '1.1.1',
  dependencies: [gitDependency],
  apiVersion: 2,
  description: 'Review changes, commit notes, switch branches, pull, and push.',
  defaultEnabled: false,
  startup: 'background',
  authors: [authors.may],
} satisfies AddonManifest
