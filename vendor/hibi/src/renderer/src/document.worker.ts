import type { DocumentWorkerRequest } from '../../shared/document-worker-protocol'
import { DocumentWorkerService } from '../../shared/document-worker-service'

const service = new DocumentWorkerService((reply) => self.postMessage(reply))
self.onmessage = (event: MessageEvent<DocumentWorkerRequest>) =>
  service.receive(event.data)
