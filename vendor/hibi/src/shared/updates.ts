export const UPDATE_CHANNELS = {
  get: 'updates:get',
  channel: 'updates:channel',
  startup: 'updates:startup',
  frequency: 'updates:frequency',
  check: 'updates:check',
  download: 'updates:download',
  install: 'updates:install',
  changed: 'updates:changed',
} as const

export type UpdateChannel = 'beta' | 'nightly'
export type UpdateCheckFrequency = 1 | 6 | 12 | 24
export type UpdateState = {
  channel: UpdateChannel
  checkOnStartup: boolean
  checkFrequency: UpdateCheckFrequency
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'error'
  supported: boolean
  version?: string | undefined
  progress?: number | undefined
  message: string
}
type UpdateAsset = { name: string; sha512: string; size: number }
export type UpdateRelease = {
  tag: string
  version: string
  assets: Record<string, UpdateAsset & { zip?: UpdateAsset }>
}
export const UPDATE_URL =
  'https://github.com/schmayterling/hibi/releases/download/'

export function updateChannel(input: unknown): UpdateChannel {
  if (input !== 'beta' && input !== 'nightly')
    throw new Error('Choose a valid update channel.')
  return input
}

export function updateCheckFrequency(input: unknown): UpdateCheckFrequency {
  if (input !== 1 && input !== 6 && input !== 12 && input !== 24)
    throw new Error('Choose a valid update check frequency.')
  return input
}

const versionCore = '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)'
const nightlyVersion = new RegExp(
  `^(${versionCore})-nightly\\.(\\d{8})\\.g([a-f0-9]{7})\\.((?:0|[1-9]\\d*))\\.((?:0|[1-9]\\d*))$`,
)

export function updateRelease(
  input: unknown,
  channel: UpdateChannel,
): UpdateRelease {
  const release = input as UpdateRelease
  const beta =
    typeof release?.version === 'string' &&
    new RegExp(`^${versionCore}$`).test(release.version) &&
    release.tag === `v${release.version}`
  const nightly =
    typeof release?.version === 'string'
      ? nightlyVersion.exec(release.version)
      : null
  const nightlyTag =
    nightly &&
    `nightly-${nightly[2]?.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')}-${nightly[3]}-${nightly[4]}-${nightly[5]}`
  if (
    !release ||
    !(
      beta ||
      (channel === 'nightly' && nightly && release.tag === nightlyTag)
    ) ||
    !release.assets ||
    typeof release.assets !== 'object' ||
    Array.isArray(release.assets)
  )
    throw new Error('The update feed is invalid. Try again later.')
  for (const [platform, asset] of Object.entries(release.assets)) {
    if (
      !asset ||
      typeof asset.name !== 'string' ||
      !/^hibi-[a-zA-Z0-9._-]+\.(exe|AppImage|dmg)$/.test(asset.name) ||
      !asset.name.startsWith(`hibi-${release.version}-`) ||
      !/^[A-Za-z0-9+/]{86}==$/.test(asset.sha512) ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0
    )
      throw new Error('The update download is invalid. Try again later.')
    if (
      asset.zip !== undefined &&
      (!asset.zip ||
        !/^darwin-(arm64|x64)$/.test(platform) ||
        typeof asset.zip.name !== 'string' ||
        asset.zip.name !==
          `hibi-${release.version}-mac-${platform.slice(7)}.zip` ||
        !/^[A-Za-z0-9+/]{86}==$/.test(asset.zip.sha512) ||
        !Number.isSafeInteger(asset.zip.size) ||
        asset.zip.size <= 0)
    )
      throw new Error('The update download is invalid. Try again later.')
  }
  return release
}

// Semver core and release precedence, then nightly date/run/attempt (never hashes).
export function newerUpdate(next: string, current: string): boolean {
  const pattern = new RegExp(
    `^(${versionCore})(?:-nightly\\.(\\d{8})\\.g?[a-f0-9]{7}(?:\\.((?:0|[1-9]\\d*))\\.((?:0|[1-9]\\d*)))?)?$`,
  )
  const parts = (version: string) => {
    const match = pattern.exec(version)
    if (!match?.[1]) return undefined
    return [
      ...match[1].split('.').map(BigInt),
      match[2] ? 0n : 1n,
      ...match.slice(2).map((part) => BigInt(part ?? 0)),
    ]
  }
  const candidate = parts(next),
    installed = parts(current)
  if (!candidate || !installed) return false
  for (let i = 0; i < candidate.length; i++) {
    const nextPart = candidate[i] ?? 0
    const currentPart = installed[i] ?? 0
    if (nextPart !== currentPart) return nextPart > currentPart
  }
  return false
}
