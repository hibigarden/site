import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'autocomplete',
  name: 'Autocomplete',
  version: '1.0.0',
  apiVersion: 2,
  description:
    'Suggest words and phrases from offline dictionaries and your writing habits. Learning stays on this device.',
  defaultEnabled: false,
  startup: 'background',
  requires: { addons: [{ id: 'dictionary' }] },
  settings: { category: 'addons', icon: 'text-cursor-input' },
  authors: [authors.may],
} satisfies AddonManifest
