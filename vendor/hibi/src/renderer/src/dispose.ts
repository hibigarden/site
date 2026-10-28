/** Attempt every cleanup, then report failures together. */
export function disposeAll(cleanups: Iterable<() => void>, label: string) {
  const errors: unknown[] = []
  for (const cleanup of cleanups) {
    try {
      cleanup()
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length) throw new AggregateError(errors, label)
}
