import * as nativeCommands from '@codemirror/commands'
import { runSourceHistory, sourceHistoryDepth } from '../shared/source-history'

const undo: typeof nativeCommands.undo = (view) =>
  runSourceHistory(view, 'undo') ?? nativeCommands.undo(view)
const redo: typeof nativeCommands.redo = (view) =>
  runSourceHistory(view, 'redo') ?? nativeCommands.redo(view)
export const commands = {
  ...nativeCommands,
  undo,
  redo,
  undoDepth: (state: Parameters<typeof nativeCommands.undoDepth>[0]) =>
    sourceHistoryDepth(state, 'undo') ?? nativeCommands.undoDepth(state),
  redoDepth: (state: Parameters<typeof nativeCommands.redoDepth>[0]) =>
    sourceHistoryDepth(state, 'redo') ?? nativeCommands.redoDepth(state),
  historyKeymap: nativeCommands.historyKeymap.map((binding) => ({
    ...binding,
    run:
      binding.run === nativeCommands.undo
        ? undo
        : binding.run === nativeCommands.redo
          ? redo
          : binding.run,
    shift: binding.shift === nativeCommands.redo ? redo : binding.shift,
  })),
}
export * as language from '@codemirror/language'
export * as state from '@codemirror/state'
export * as view from '@codemirror/view'
export * as highlight from '@lezer/highlight'
