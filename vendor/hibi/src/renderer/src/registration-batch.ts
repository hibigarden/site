/** New packages publish editor configuration only after start() succeeds. */
export function registrationBatch(staged: boolean) {
  let committed = !staged,
    disposed = false
  const entries = new Map<
    string,
    { install: () => () => void; remove?: () => void }
  >()
  return {
    register(id: string, install: () => () => void) {
      if (disposed) return () => {}
      if (entries.has(id))
        throw new Error(`Duplicate addon registration: ${id}.`)
      const entry = { install } as {
        install: () => () => void
        remove?: () => void
      }
      entries.set(id, entry)
      if (committed) entry.remove = install()
      return () => {
        if (entries.get(id) !== entry) return
        entries.delete(id)
        entry.remove?.()
      }
    },
    commit() {
      if (disposed || committed) return
      for (const [id, entry] of [...entries].sort(([a], [b]) =>
        a.localeCompare(b),
      ))
        if (entries.get(id) === entry) entry.remove = entry.install()
      committed = true
    },
    dispose() {
      if (disposed) return
      disposed = true
      const removing = [...entries.values()].reverse()
      entries.clear()
      const errors: unknown[] = []
      for (const entry of removing)
        try {
          entry.remove?.()
        } catch (error) {
          errors.push(error)
        }
      if (errors.length)
        throw new AggregateError(
          errors,
          'Could not remove all addon registrations.',
        )
    },
  }
}
