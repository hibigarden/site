import type { DocumentState } from './desktop'
import type { TextProjection } from './document-projection'

export const ANALYSIS_CHANNELS = {
  run: 'analysis:run',
  cancel: 'analysis:cancel',
  ready: 'analysis:ready',
  job: 'analysis:job',
  result: 'analysis:result',
} as const
export const MAX_ANALYSIS_RESULT = 256 * 1024
export type AnalysisResult =
  | { status: 'complete'; projectionId: string; value: unknown }
  | { status: 'cancelled' | 'stale' | 'failed'; message: string }
export type AnalysisApi = {
  /** Analyze an exact projection of the active document in the addon's isolated entry. */
  run: (projection: TextProjection) => Promise<AnalysisResult>
  /** Revoke queued work and terminate the active analyzer. A later run starts a fresh process. */
  cancel: () => void
}
export function validateAnalysisProjection(
  value: unknown,
  document: DocumentState,
): TextProjection {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid analysis projection.')
  const data = value as TextProjection
  if (
    typeof data.id !== 'string' ||
    !data.id ||
    data.id.length > 200 ||
    data.tabId !== document.tabId ||
    data.revision !== document.revision ||
    data.contentVersion !== document.contentVersion
  )
    throw new Error('The document changed before analysis started.')
  if (
    typeof data.text !== 'string' ||
    data.text.length > 2 * 1024 * 1024 ||
    !Array.isArray(data.spans) ||
    data.spans.length > 10000
  )
    throw new Error('This document is too large to analyze.')
  let end = 0
  for (const span of data.spans) {
    if (
      !span ||
      ![span.from, span.to, span.sourceFrom, span.sourceTo].every(
        Number.isSafeInteger,
      ) ||
      span.from < end ||
      span.to <= span.from ||
      span.to > data.text.length ||
      span.sourceFrom < 0 ||
      span.sourceTo > document.markdown.length ||
      span.sourceTo - span.sourceFrom !== span.to - span.from ||
      data.text.slice(span.from, span.to) !==
        document.markdown.slice(span.sourceFrom, span.sourceTo)
    )
      throw new Error('Analysis ranges must match the current document.')
    if (/\S/.test(data.text.slice(end, span.from)))
      throw new Error('Analysis text must belong to the current document.')
    end = span.to
  }
  if (/\S/.test(data.text.slice(end)))
    throw new Error('Analysis text must belong to the current document.')
  // Copy only the granted snapshot; never forward arbitrary renderer-supplied fields.
  return {
    id: data.id,
    tabId: document.tabId,
    revision: document.revision,
    contentVersion: document.contentVersion,
    text: data.text,
    spans: data.spans.map(({ from, to, sourceFrom, sourceTo }) => ({
      from,
      to,
      sourceFrom,
      sourceTo,
    })),
  }
}
