import type {
  SourceSnapshot,
  SourceStorageChange,
  SourceStorageUsage,
  SourceStore,
} from './source-buffer.ts'

const minimumWaste = 256 * 1024

/** One cancellable, quiet-time job per store; no source reads on the input stack. */
export class SourceMaintenance {
  readonly #store: SourceStore
  readonly #commit: (change: SourceStorageChange) => void
  readonly #onError: (error: unknown) => void
  #audit: Generator<void, SourceStorageUsage | undefined> | null = null
  #build: Generator<void, SourceStorageChange | undefined> | null = null
  #source: SourceSnapshot | null = null
  #timer: ReturnType<typeof setTimeout> | undefined
  #resolve: (() => void) | undefined
  #edits = 0
  #churn = 0
  #disposed = false

  constructor(
    store: SourceStore,
    commit: (change: SourceStorageChange) => void,
    onError: (error: unknown) => void,
  ) {
    this.#store = store
    this.#commit = commit
    this.#onError = onError
  }
  cancel() {
    clearTimeout(this.#timer)
    this.#timer = undefined
    this.#audit?.return(undefined)
    this.#build?.return(undefined)
    this.#audit = null
    this.#build = null
    this.#source = null
    this.#resolve?.()
    this.#resolve = undefined
  }
  changed(editedUnits: number) {
    this.cancel()
    if (this.#disposed) return
    this.#edits++
    this.#churn += editedUnits
    if (this.#edits >= 256 || this.#churn >= minimumWaste)
      this.#timer = setTimeout(this.#start, 500)
  }
  /** Explicit maintenance boundary for diagnostics/tests; still yields before reading. */
  request(): Promise<void> {
    this.cancel()
    if (this.#disposed) return Promise.resolve()
    const settled = new Promise<void>((resolve) => {
      this.#resolve = resolve
    })
    this.#timer = setTimeout(this.#start, 0)
    return settled
  }
  #start = () => {
    this.#edits = 0
    this.#churn = 0
    this.#source = this.#store.snapshot()
    this.#audit = this.#store.inspectStorage()
    this.#step()
  }
  #step = () => {
    this.#timer = undefined
    if (this.#source !== this.#store.snapshot()) {
      this.cancel()
      return
    }
    try {
      const start = performance.now()
      do {
        if (this.#audit) {
          const next = this.#audit.next()
          if (next.done) {
            this.#audit = null
            const usage = next.value
            if (
              !usage ||
              usage.allocatedUnits < usage.source.utf16Length * 2 ||
              usage.allocatedUnits - usage.source.utf16Length < minimumWaste
            ) {
              this.cancel()
              return
            }
            this.#build = this.#store.prepareCompaction()
          }
        } else if (this.#build) {
          const next = this.#build.next()
          if (next.done) {
            this.#build = null
            if (next.value) {
              try {
                this.#commit(next.value)
              } finally {
                this.#store.abortCompaction(next.value)
              }
            }
            this.cancel()
            return
          }
        }
      } while (performance.now() - start < 1)
      this.#timer = setTimeout(this.#step, 0)
    } catch (error) {
      this.cancel()
      this.#onError(error)
    }
  }
  dispose() {
    this.#disposed = true
    this.cancel()
  }
}
