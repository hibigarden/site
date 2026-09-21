/** Compatibility routing for SDK commands operating on host-owned CM views. */
const views = new WeakMap<
  object,
  { undo: () => boolean; redo: () => boolean }
>()
const states = new WeakMap<object, { undo: number; redo: number }>()
export function registerSourceHistory(
  view: object,
  history: { undo: () => boolean; redo: () => boolean },
) {
  views.set(view, history)
  return () => {
    views.delete(view)
  }
}
export function rememberSourceHistory(
  state: object,
  depth: { undo: number; redo: number },
) {
  states.set(state, Object.freeze({ ...depth }))
}
export const runSourceHistory = (view: object, direction: 'undo' | 'redo') =>
  views.get(view)?.[direction]()
export const sourceHistoryDepth = (state: object, direction: 'undo' | 'redo') =>
  states.get(state)?.[direction]
