/** Analysis offsets and source offsets are UTF-16. Every span is an exact identity mapping. */
export type TextProjection = {
  id: string
  tabId: string
  revision: number
  contentVersion: number
  text: string
  spans: readonly {
    from: number
    to: number
    sourceFrom: number
    sourceTo: number
  }[]
}
export type TextDecoration = {
  id: string
  from: number
  to: number
  message: string
  severity?: 'info' | 'warning'
}
export function projectionRange(
  projection: TextProjection,
  from: number,
  to: number,
) {
  if (
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(to) ||
    from < 0 ||
    to < from
  )
    return null
  const span = projection.spans.find(
    (span) =>
      from >= span.from &&
      to <= span.to &&
      span.to - span.from === span.sourceTo - span.sourceFrom,
  )
  return span
    ? {
        from: span.sourceFrom + from - span.from,
        to: span.sourceFrom + to - span.from,
      }
    : null
}
