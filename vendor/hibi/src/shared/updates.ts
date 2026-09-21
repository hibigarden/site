export const UPDATE_CHANNELS = {
  get: 'updates:get',
  channel: 'updates:channel',
  check: 'updates:check',
  download: 'updates:download',
  install: 'updates:install',
  changed: 'updates:changed',
} as const

export type UpdateChannel = 'nightly-green' | 'nightly'
export type UpdateState = {
  channel: UpdateChannel
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'error'
  supported: boolean
  manualInstall: boolean
  version?: string | undefined
  broken?: boolean | undefined
  progress?: number | undefined
  message: string
}
export type UpdateRelease = {
  tag: string
  version: string
  status: 'nightly-green' | 'nightly-broken'
  assets: Record<string, { name: string; sha512: string; size: number }>
}
export const UPDATE_URL =
  'https://github.com/schmayterling/hibi/releases/download/'

export function updateChannel(input: unknown): UpdateChannel {
  if (input !== 'nightly-green' && input !== 'nightly')
    throw new Error('Choose a valid update channel.')
  return input
}

export function updateRelease(
  input: unknown,
  channel: UpdateChannel,
): UpdateRelease {
  const release = input as UpdateRelease
  if (
    !release ||
    !/^nightly-(?:broken-)?\d{4}-\d{2}-\d{2}-[a-f0-9]{7}-\d+-\d+$/.test(
      release.tag,
    ) ||
    !/^\d+\.\d+\.\d+-nightly\.\d{8}\.g[a-f0-9]{7}\.\d+\.\d+$/.test(
      release.version,
    ) ||
    !['nightly-green', 'nightly-broken'].includes(release.status) ||
    release.tag.startsWith('nightly-broken-') !==
      (release.status === 'nightly-broken') ||
    (channel === 'nightly-green' && release.status !== 'nightly-green') ||
    !release.assets ||
    typeof release.assets !== 'object'
  )
    throw new Error('The update feed is invalid. Try again later.')
  for (const asset of Object.values(release.assets)) {
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
  }
  return release
}

// Nightly run numbers order builds; commit hashes do not.
export function newerUpdate(next: string, current: string): boolean {
  const parts = (version: string) => {
    const match =
      /^(\d+)\.(\d+)\.(\d+)(?:-nightly\.(\d{8})\.g?[a-f0-9]{7}(?:\.(\d+)\.(\d+))?)?$/.exec(
        version,
      )
    return match?.slice(1).map((part) => Number(part ?? 0))
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
