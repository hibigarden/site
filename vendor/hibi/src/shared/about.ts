export const ABOUT_CHANNELS = {
  licenses: 'app:licenses',
  license: 'app:license',
  sponsor: 'app:sponsor',
} as const
export const SPONSOR_URL = 'https://github.com/sponsors/schmayterling'
export type LicenseInfo = {
  id: string
  name: string
  version?: string
  license: string
}
