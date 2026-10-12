import type { AddonManifest } from '../api'
import { authors } from '../authors'
import { packLicenses } from './pack-licenses'

export default {
  id: 'dictionary',
  name: 'Dictionary and thesaurus',
  version: '1.0.0',
  apiVersion: 2,
  description:
    'Look up definitions and synonyms in English, Chinese, Cantonese, Japanese, Filipino, French, and German. Words you look up are sent to Wiktionary and Datamuse.',
  defaultEnabled: false,
  startup: 'background',
  network: {
    origins: ['https://en.wiktionary.org', 'https://api.datamuse.com'],
  },
  settings: { category: 'addons', icon: 'book-open' },
  authors: [authors.may],
  licenses: packLicenses,
} satisfies AddonManifest
