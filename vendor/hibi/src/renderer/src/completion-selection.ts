import type { CompletionItem } from '../../shared/completions'

export function initialCompletionSelection(items: readonly CompletionItem[]) {
  const first = items[0]
  return first &&
    first.preselect !== false &&
    first.acceptOnEnter !== 'selected'
    ? 0
    : -1
}

export function dismissCompletionForArrow(
  items: readonly CompletionItem[],
  key: string,
) {
  return (
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key) &&
    items.length > 0 &&
    items.every((item) => item.captureArrowKeys === false)
  )
}

export function completionForKey(
  items: readonly CompletionItem[],
  selected: number,
  key: 'Enter' | 'Tab',
) {
  const item = items[selected < 0 && key === 'Tab' ? 0 : selected]
  if (!item) return null
  return (key === 'Tab' ? item.acceptOnTab : item.acceptOnEnter) === false
    ? null
    : item
}
