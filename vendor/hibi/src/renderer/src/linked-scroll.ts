/** Keep different document heights aligned without echoing generated scroll events. */
export function linkScroll(
  first: HTMLElement,
  second: HTMLElement,
  initial: HTMLElement,
) {
  let leader = initial
  let frame = 0
  const sourcePane = second.closest('.source-pane')
  const generated = new Map<HTMLElement, number>()
  const sync = () => {
    const target = leader === first ? second : first
    const range = leader.scrollHeight - leader.clientHeight
    const position = range > 0 ? leader.scrollTop / range : 0
    const top =
      Math.max(0, Math.min(1, position)) *
      Math.max(0, target.scrollHeight - target.clientHeight)
    if (Math.abs(target.scrollTop - top) < 1) return
    target.scrollTop = top
    generated.set(target, target.scrollTop)
  }
  const schedule = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(sync)
  }
  const scroll = (event: Event) => {
    const origin = event.currentTarget as HTMLElement
    const expected = generated.get(origin)
    generated.delete(origin)
    if (expected !== undefined && Math.abs(origin.scrollTop - expected) < 1)
      return
    leader = origin
    schedule()
  }
  first.addEventListener('scroll', scroll, { passive: true })
  second.addEventListener('scroll', scroll, { passive: true })
  const settled = () => schedule()
  // Widths settle during the view transition; new files are already at their final widths.
  first.addEventListener('transitionend', settled)
  sourcePane?.addEventListener('transitionend', settled)
  schedule()
  return () => {
    cancelAnimationFrame(frame)
    first.removeEventListener('scroll', scroll)
    second.removeEventListener('scroll', scroll)
    first.removeEventListener('transitionend', settled)
    sourcePane?.removeEventListener('transitionend', settled)
  }
}
