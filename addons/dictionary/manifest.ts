import type { AddonManifest } from '../api'
import { authors } from '../authors'

export default {
  id: 'dictionary',
  name: 'Dictionary and thesaurus',
  version: '1.0.0',
  apiVersion: 2,
  description:
    'Look up definitions and synonyms in English, Chinese, Cantonese, Japanese, Filipino, and French. Words you look up are sent to Wiktionary and Datamuse.',
  defaultEnabled: false,
  startup: 'background',
  settings: { category: 'addons', icon: 'book-open' },
  authors: [authors.may],
} satisfies AddonManifest
