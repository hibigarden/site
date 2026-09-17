import type { AddonManifest } from '../api'
import { authors } from '../authors'
import soundsLicense from './LICENSE.kbsim.md?raw'
import keybeatsLicense from './LICENSE.keybeats.md?raw'

export default {
  id: 'keybeats',
  name: 'keyBeats',
  version: '1.0.0',
  apiVersion: 1,
  description: 'Mechanical keyboard sounds while editing your notes.',
  defaultEnabled: false,
  authors: [
    { ...authors.yug, role: 'original author' },
    { ...authors.thomas, role: 'sounds' },
    { ...authors.may, role: 'hibi port' },
  ],
  licenses: [
    { id: 'keybeats', name: 'keyBeats', license: 'MIT', text: keybeatsLicense },
    { id: 'kbsim', name: 'Kbsim sounds', license: 'MIT', text: soundsLicense },
  ],
} satisfies AddonManifest
