import { journalMessageBytes } from '../../shared/document-journal.ts'
import type { DocumentSession } from '../../shared/document-session.ts'
import type {
  DocumentWorkerReply,
  DocumentWorkerRequest,
  MarkdownReferenceRequest,
  MarkdownReferenceSyntax,
  MarkdownSemanticResult,
  MetadataDialect,
} from '../../shared/document-worker-protocol.ts'
import { reportDiagnosticFailure } from '../../shared/local-diagnostics-observer.ts'
import type { SourceOwnerPage } from '../../shared/markdown-source-model.ts'
import type { SourceSnapshot } from '../../shared/source-buffer.ts'
import type { SourceOperation } from '../../shared/source-operations.ts'
import type { ReferenceValue } from '../../shared/source-references.ts'
import type { SearchLocation } from '../../shared/source-search-index.ts'

type Transport = Pick<
  Worker,
  'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'
>
export type FindAction = 'first' | 'next' | 'previous' | null
type Request = Extract<DocumentWorkerRequest, { type: 'find' }> & {
  action: FindAction
}
type ClientOptions = {
  changed: () => void
  pending: () => void
  result: (location: SearchLocation, action: FindAction) => void
  error: (message: string) => void
  metadataPending?: () => void
  metadataResult?: (
    page: SourceOwnerPage,
    reference?: ReferenceValue | null,
    semantic?: MarkdownSemanticResult,
  ) => void
  metadataError?: (message: string) => void
  worker?: () => Transport
  maximumPendingBytes?: number
  timeoutMs?: number
}

/** One cancelable derived replica, with bounded bootstrap/operation/query ownership. */
export class DocumentWorkerClient {
  readonly #session: DocumentSession
  readonly #options: ClientOptions
  readonly #detach: (() => void)[]
  #worker: Transport | null = null
  #epoch = ''
  #document: SourceSnapshot['document']
  #bootstrap: SourceSnapshot | null = null
  #loaded = false
  #ack = -1
  #sent = -1
  readonly #pending = new Map<number, number>()
  #bytes = 0
  #queued: SourceOperation[] = []
  #latest: Request | null = null
  #requestId = 0
  #sentRequest = 0
  #flight: number | null = null
  #canceling: number | null = null
  #startTimer: ReturnType<typeof setTimeout> | undefined
  #deadline: ReturnType<typeof setTimeout> | undefined
  #disposed = false
  #failed = false
  #restarts = 0
  #metadata: Extract<DocumentWorkerRequest, { type: 'metadata' }> | null = null
  #metadataFlight: number | null = null
  #metadataCanceling: number | null = null
  #metadataReleasing = false
  #sentMetadata = 0
  #metadataDeadline: ReturnType<typeof setTimeout> | undefined
  #findDeadline: ReturnType<typeof setTimeout> | undefined
  constructor(session: DocumentSession, options: ClientOptions) {
    this.#session = session
    this.#options = options
    this.#document = session.snapshot().document
    this.#detach = [
      session.subscribeOperations((prepared) => {
        if (this.#disposed || this.#failed) return
        const operation = prepared.operation
        if (this.#bootstrap || this.#loaded) {
          const bytes = journalMessageBytes(operation)
          if (
            this.#bytes + bytes >
            (options.maximumPendingBytes ?? 8 * 1024 * 1024)
          ) {
            // Only the derived replica is replaced; canonical recovery never drops edits.
            this.#restart()
          } else {
            this.#pending.set(operation.contentVersion, bytes)
            this.#bytes += bytes
            this.#flight = this.#canceling = null
            clearTimeout(this.#findDeadline)
            this.#findDeadline = undefined
            this.#metadataFlight = this.#metadataCanceling = null
            this.#metadataReleasing = false
            clearTimeout(this.#metadataDeadline)
            this.#metadataDeadline = undefined
            if (this.#loaded) this.#sendOperation(operation)
            else this.#queued.push(operation)
          }
        }
        options.changed()
      }),
      session.subscribe(() => {
        if (this.#disposed) return
        const document = session.snapshot().document
        if (
          document.tabId !== this.#document.tabId ||
          document.revision !== this.#document.revision
        ) {
          this.#document = document
          this.#failed = false
          this.#restarts = 0
          this.#latest = null
          this.#metadata = null
          this.#restart()
          options.changed()
        }
      }),
    ]
  }
  find(query: string, from: number, to: number, action: FindAction = null) {
    if (this.#disposed || this.#failed) return
    if (!this.#worker && !this.#startTimer && !this.#bootstrap) this.#restart()
    this.#latest = {
      type: 'find',
      epoch: this.#epoch,
      id: ++this.#requestId,
      version: this.#session.snapshot().version,
      query,
      from,
      to,
      action,
    }
    this.#options.pending()
    this.#flushQuery()
  }
  metadata(
    dialect: MetadataDialect,
    from: number,
    to: number,
    limit = 128,
    frontmatter = false,
    reference?: MarkdownReferenceRequest,
    semantic?: MarkdownReferenceSyntax,
  ) {
    if (this.#disposed || this.#failed) return
    if (!this.#worker && !this.#startTimer && !this.#bootstrap) this.#restart()
    this.#metadata = {
      type: 'metadata',
      epoch: this.#epoch,
      id: ++this.#requestId,
      version: this.#session.snapshot().version,
      dialect,
      frontmatter,
      ...(reference ? { reference: { ...reference } } : {}),
      ...(semantic ? { semantic: { ...semantic } } : {}),
      from,
      to,
      limit,
    }
    this.#options.metadataPending?.()
    this.#flushMetadata()
  }
  cancelFind() {
    this.#latest = null
    this.#sentRequest = 0
    if (this.#flight === null || this.#canceling !== null) return
    this.#canceling = this.#flight
    this.#post({ type: 'cancel-find', epoch: this.#epoch, id: this.#flight })
  }
  releaseMetadata() {
    const id =
      this.#metadataFlight ??
      this.#metadataCanceling ??
      (this.#sentMetadata || null)
    this.#metadata = null
    this.#sentMetadata = 0
    if (id === null || this.#metadataReleasing) return
    this.#metadataCanceling = id
    this.#metadataReleasing = true
    this.#post({
      type: 'cancel-metadata',
      epoch: this.#epoch,
      id,
      release: true,
    })
    if (this.#metadataCanceling === id && !this.#metadataDeadline)
      this.#metadataDeadline = setTimeout(
        () =>
          this.#fail(new Error('Document metadata cancellation timed out.')),
        this.#options.timeoutMs ?? 5000,
      )
  }
  #flushMetadata() {
    const request = this.#metadata
    if (
      !request ||
      !this.#loaded ||
      this.#ack !== this.#session.snapshot().version ||
      this.#metadataCanceling !== null
    )
      return
    if (this.#metadataFlight !== null) {
      if (this.#metadataFlight !== request.id) {
        this.#metadataCanceling = this.#metadataFlight
        this.#post({
          type: 'cancel-metadata',
          epoch: this.#epoch,
          id: this.#metadataFlight,
          release: false,
        })
      }
      return
    }
    if (request.id === this.#sentMetadata || request.version !== this.#ack)
      return
    this.#metadataFlight = this.#sentMetadata = request.id
    this.#post(request)
    if (this.#metadataFlight === request.id)
      this.#metadataDeadline = setTimeout(
        () =>
          this.#fail(new Error('Document metadata worker stopped responding.')),
        this.#options.timeoutMs ?? 5000,
      )
  }
  #post(message: DocumentWorkerRequest) {
    if (!this.#worker) return false
    try {
      this.#worker.postMessage(message)
      return true
    } catch (error) {
      this.#fail(error)
      return false
    }
  }
  #sendOperation(operation: SourceOperation) {
    this.#sent = operation.contentVersion
    this.#post({ type: 'edit', epoch: this.#epoch, operation })
    this.#watch()
  }
  #flushQuery() {
    const request = this.#latest
    if (
      !request ||
      !this.#loaded ||
      this.#ack !== this.#session.snapshot().version ||
      this.#canceling !== null
    )
      return
    if (this.#flight !== null) {
      if (this.#flight !== request.id) {
        this.#canceling = this.#flight
        this.#post({
          type: 'cancel-find',
          epoch: this.#epoch,
          id: this.#flight,
        })
      }
      return
    }
    if (request.id === this.#sentRequest || request.version !== this.#ack)
      return
    this.#flight = this.#sentRequest = request.id
    this.#post({
      type: 'find',
      epoch: this.#epoch,
      id: request.id,
      version: request.version,
      query: request.query,
      from: request.from,
      to: request.to,
    })
    if (this.#flight === request.id)
      this.#findDeadline = setTimeout(
        () => this.#fail(new Error('Find worker stopped responding.')),
        this.#options.timeoutMs ?? 5000,
      )
    this.#watch()
  }
  #watch() {
    if (!this.#bootstrap && !this.#pending.size) {
      clearTimeout(this.#deadline)
      this.#deadline = undefined
      return
    }
    if (this.#deadline || !this.#worker) return
    this.#deadline = setTimeout(
      () => this.#fail(new Error('Find worker stopped responding.')),
      this.#options.timeoutMs ?? 5000,
    )
  }
  #reply(reply: DocumentWorkerReply) {
    if (this.#disposed || reply.epoch !== this.#epoch) return
    if (reply.type === 'ack') {
      if (!Number.isSafeInteger(reply.version) || reply.version > this.#sent) {
        this.#fail(
          new Error('Document worker acknowledged an unknown version.'),
        )
        return
      }
      if (reply.version <= this.#ack) return
      clearTimeout(this.#deadline)
      this.#deadline = undefined
      this.#ack = reply.version
      if (this.#bootstrap && reply.version >= this.#bootstrap.version)
        this.#bootstrap = null
      for (const [version, bytes] of this.#pending)
        if (version <= reply.version) {
          this.#pending.delete(version)
          this.#bytes -= bytes
        }
    } else if (reply.type === 'canceled') {
      if (reply.id !== this.#canceling) return
      this.#flight = this.#canceling = null
      clearTimeout(this.#findDeadline)
      this.#findDeadline = undefined
    } else if (reply.type === 'find') {
      if (reply.id === this.#flight) {
        this.#flight = null
        if (this.#canceling === null) {
          clearTimeout(this.#findDeadline)
          this.#findDeadline = undefined
        }
      }
      const request = this.#latest
      if (
        request?.id === reply.id &&
        request.version === reply.version &&
        reply.version === this.#session.snapshot().version
      )
        this.#options.result(reply.location, request.action)
    } else if (reply.type === 'metadata-canceled') {
      if (
        reply.id !== this.#metadataCanceling ||
        reply.release !== this.#metadataReleasing
      )
        return
      this.#metadataFlight = this.#metadataCanceling = null
      this.#metadataReleasing = false
      clearTimeout(this.#metadataDeadline)
      this.#metadataDeadline = undefined
    } else if (reply.type === 'metadata') {
      if (reply.id === this.#metadataFlight) {
        this.#metadataFlight = null
        if (this.#metadataCanceling === null) {
          clearTimeout(this.#metadataDeadline)
          this.#metadataDeadline = undefined
        }
      }
      const request = this.#metadata
      if (
        request?.id === reply.id &&
        request.version === reply.version &&
        reply.version === this.#session.snapshot().version
      )
        this.#options.metadataResult?.(
          reply.page,
          reply.reference,
          reply.semantic,
        )
    } else if (reply.stage === 'replica') {
      this.#fail(new Error(reply.message))
      return
    } else if (reply.stage === 'metadata') {
      if (reply.id === this.#metadataFlight) {
        this.#metadataFlight = null
        if (this.#metadataCanceling === null) {
          clearTimeout(this.#metadataDeadline)
          this.#metadataDeadline = undefined
        }
      }
      if (reply.id === this.#metadata?.id)
        this.#options.metadataError?.(reply.message)
    } else {
      if (reply.id === this.#flight) {
        this.#flight = null
        if (this.#canceling === null) {
          clearTimeout(this.#findDeadline)
          this.#findDeadline = undefined
        }
      }
      if (reply.id === this.#latest?.id) this.#options.error(reply.message)
    }
    this.#flushQuery()
    this.#flushMetadata()
    this.#watch()
  }
  #stop() {
    clearTimeout(this.#startTimer)
    clearTimeout(this.#deadline)
    clearTimeout(this.#findDeadline)
    this.#findDeadline = undefined
    clearTimeout(this.#metadataDeadline)
    this.#metadataDeadline = undefined
    this.#metadataFlight = this.#metadataCanceling = null
    this.#metadataReleasing = false
    this.#sentMetadata = 0
    this.#startTimer = this.#deadline = undefined
    this.#worker?.terminate()
    this.#worker = null
    this.#bootstrap = null
    this.#queued = []
    this.#pending.clear()
    this.#bytes = 0
    this.#loaded = false
    this.#flight = this.#canceling = null
    this.#ack = this.#sent = -1
    this.#sentRequest = 0
  }
  #restart() {
    this.#stop()
    this.#epoch = crypto.randomUUID()
    this.#requestId = 0
    if (this.#latest)
      this.#latest = {
        ...this.#latest,
        epoch: this.#epoch,
        id: ++this.#requestId,
        version: this.#session.snapshot().version,
        action:
          this.#latest.version === this.#session.snapshot().version
            ? this.#latest.action
            : null,
      }
    if (this.#metadata)
      this.#metadata = {
        ...this.#metadata,
        epoch: this.#epoch,
        id: ++this.#requestId,
        version: this.#session.snapshot().version,
      }
    const epoch = this.#epoch
    this.#startTimer = setTimeout(() => {
      this.#startTimer = undefined
      void this.#start(epoch).catch((error) => {
        if (epoch === this.#epoch) this.#fail(error)
      })
    }, 0)
  }
  async #start(epoch: string) {
    if (this.#disposed || epoch !== this.#epoch) return
    const snapshot = this.#session.snapshot()
    this.#bootstrap = snapshot
    const chunks: string[] = []
    let pending = '',
      started = performance.now()
    for (const chunk of snapshot.chunks()) {
      pending += chunk
      while (pending.length >= 65536) {
        chunks.push(pending.slice(0, 65536))
        pending = pending.slice(65536)
      }
      if (performance.now() - started >= 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        if (this.#disposed || epoch !== this.#epoch) return
        started = performance.now()
      }
    }
    if (pending) chunks.push(pending)
    const worker =
      this.#options.worker?.() ??
      new Worker(new URL('./document.worker.ts', import.meta.url), {
        type: 'module',
      })
    this.#worker = worker
    worker.onmessage = (event: MessageEvent<DocumentWorkerReply>) =>
      this.#reply(event.data)
    worker.onerror = (event) => {
      event.preventDefault()
      if (epoch === this.#epoch && this.#worker === worker) {
        reportDiagnosticFailure('SOURCE_WORKER_FAILED', event, worker)
        this.#fail(new Error('Could not start document find.'))
      }
    }
    worker.onmessageerror = (event) => {
      if (epoch === this.#epoch && this.#worker === worker) {
        reportDiagnosticFailure('SOURCE_WORKER_FAILED', event, worker)
        this.#fail(new Error('Could not read a document worker reply.'))
      }
    }
    this.#sent = snapshot.version
    this.#loaded = true
    if (
      !this.#post({
        type: 'load',
        epoch,
        document: snapshot.document,
        version: snapshot.version,
        chunks,
      })
    )
      return
    for (const operation of this.#queued) this.#sendOperation(operation)
    this.#queued = []
    this.#watch()
  }
  #fail(error: unknown) {
    this.#stop()
    if (this.#disposed) return
    if (this.#restarts++ < 1) {
      this.#restart()
      return
    }
    this.#failed = true
    this.#options.error(error instanceof Error ? error.message : String(error))
    this.#options.metadataError?.(
      error instanceof Error ? error.message : String(error),
    )
  }
  dispose() {
    this.#disposed = true
    this.#stop()
    for (const detach of this.#detach) detach()
    this.#latest = null
    this.#metadata = null
  }
}
