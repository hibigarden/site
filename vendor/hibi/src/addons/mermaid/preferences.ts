export const minimumHeight = 160
export const maximumHeight = 1200
export const heightStep = 40
export const defaultHeight = 480

export type MermaidPreferences = { maxHeight: number }
export const settingsEvent = 'hibi:mermaid-settings'

export function getPreferences(): MermaidPreferences {
  try {
    const saved = JSON.parse(
      localStorage.getItem('mermaid:preferences') ?? '{}',
    )
    const height = Number(saved?.maxHeight)
    return {
      maxHeight: Number.isFinite(height)
        ? Math.max(
            minimumHeight,
            Math.min(
              maximumHeight,
              Math.round(height / heightStep) * heightStep,
            ),
          )
        : defaultHeight,
    }
  } catch {
    return { maxHeight: defaultHeight }
  }
}

export function setPreferences(changes: Partial<MermaidPreferences>) {
  localStorage.setItem(
    'mermaid:preferences',
    JSON.stringify({ ...getPreferences(), ...changes }),
  )
  window.dispatchEvent(new Event(settingsEvent))
}
