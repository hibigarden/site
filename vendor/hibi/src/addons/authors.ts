import type { AddonAuthor } from './api'

export const authors = {
  may: { discordId: '1262793452236570667', displayName: 'may' },
  yug: { displayName: 'Yug Bhanushali', github: 'YugBhanushali' },
  thomas: { displayName: 'Thomas Lai', github: 'tplai' },
} as const satisfies Record<string, AddonAuthor>
