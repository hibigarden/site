import { profiles } from './profiles'

export type Preferences = { profile: string; volume: number; muted: boolean }
export const settingsEvent = 'hibi:keybeats-settings'
export function getPreferences(): Preferences {
  try {
    const saved = JSON.parse(
      localStorage.getItem('keybeats:preferences') ?? '{}',
    )
    return {
      profile: profiles.some((profile) => profile.id === saved?.profile)
        ? saved.profile
        : 'alpaca',
      volume:
        typeof saved?.volume === 'number' && Number.isFinite(saved.volume)
          ? Math.max(0, Math.min(1, saved.volume))
          : 0.15,
      muted: saved?.muted === true,
    }
  } catch {
    return { profile: 'alpaca', volume: 0.15, muted: false }
  }
}
export function setPreferences(changes: Partial<Preferences>) {
  localStorage.setItem(
    'keybeats:preferences',
    JSON.stringify({ ...getPreferences(), ...changes }),
  )
  window.dispatchEvent(new Event(settingsEvent))
}
