import type { DocumentState } from '../../shared/desktop.ts'
import type { SourceSnapshot } from '../../shared/source-buffer.ts'
import type { DocumentRuntime } from './document-runtime.ts'

const certifiedVisualEchoes = new WeakSet<SourceSnapshot>()

/** Internal, one-shot proof from the strict native visual edit path after reconciliation. */
export function certifyVisualEcho(source: SourceSnapshot) {
  certifiedVisualEchoes.add(source)
}

/** A delayed display read must not run after its canonical snapshot changes. */
export function afterDocumentQuiet(
  runtime: Pick<DocumentRuntime, 'get' | 'subscribe'>,
  snapshot: DocumentState,
  read: () => void,
) {
  if (runtime.get() !== snapshot) return
  const timer = setTimeout(() => {
    if (runtime.get() === snapshot) read()
  }, 200)
  const remove = runtime.subscribe(() => clearTimeout(timer))
  return () => {
    clearTimeout(timer)
    remove()
  }
}

/** Source surfaces subscribe to edits directly; their hidden rich props can settle. */
export function editorDocumentUpdates(
  runtime: Pick<DocumentRuntime, 'get' | 'subscribe' | 'sourceFor'>,
  deferred: boolean,
  certifiedVisual = false,
) {
  let current = runtime.get()
  return {
    get: () => current,
    subscribe(notify: () => void) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const remove = runtime.subscribe((next, changes) => {
        clearTimeout(timer)
        const snapshot = runtime.sourceFor(next)
        const visualEcho = snapshot && certifiedVisualEchoes.delete(snapshot)
        const publish = () => {
          current = next
          notify()
        }
        if (changes && (deferred || (certifiedVisual && visualEcho)))
          timer = setTimeout(publish, 250)
        else publish()
      })
      const latest = runtime.get()
      if (current !== latest) {
        current = latest
        notify()
      }
      return () => {
        clearTimeout(timer)
        remove()
      }
    },
  }
}

/** Content versions belong to the editor; shell consumers only need these fields. */
export function sameDocumentShell(
  previous: DocumentState | null,
  next: DocumentState,
) {
  return (
    previous !== null &&
    previous.id === next.id &&
    previous.tabId === next.tabId &&
    previous.revision === next.revision &&
    previous.name === next.name &&
    previous.dirty === next.dirty &&
    previous.ephemeral === next.ephemeral &&
    previous.canAutosave === next.canAutosave &&
    previous.tabsEnabled === next.tabsEnabled &&
    previous.tabs === next.tabs
  )
}
