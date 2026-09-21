/** Process-local checkpoints; static imports precede the entrypoint checkpoint. */
export function startupMark(name: string) {
  const key = `hibi:${name}`
  if (!performance.getEntriesByName(key).length) performance.mark(key)
}

export async function startupSpan<T>(
  name: string,
  load: () => Promise<T>,
  detail: Record<string, string> = {},
): Promise<T> {
  const start = performance.now()
  let status = 'ready'
  try {
    return await load()
  } catch (error) {
    status = 'failed'
    throw error
  } finally {
    const key = `hibi:${name}`
    const previous = performance.getEntriesByName(key, 'measure')[0]
    if (!previous || previous.startTime <= start) {
      performance.clearMeasures(key)
      performance.measure(key, {
        start,
        end: performance.now(),
        detail: {
          ...detail,
          status: status === 'failed' ? status : (detail.status ?? status),
        },
      })
    }
  }
}
