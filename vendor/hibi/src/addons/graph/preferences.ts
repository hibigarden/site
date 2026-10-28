const key = 'graph:default-zoom'

export function defaultZoom() {
  const saved = localStorage.getItem(key)
  const value = saved === null ? NaN : Number(saved)
  return Number.isFinite(value) ? Math.max(1, Math.min(12, value)) : 8
}

export function setDefaultZoom(value: number) {
  localStorage.setItem(key, String(value))
}
