import {
  type CommandProps,
  commands as coreCommands,
  Extension,
  isiOS,
  isMacOS,
} from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { documentRuntime } from './document-runtime'

/** Rich commands use host history; PM does not retain a competing undo stack. */
export const documentHistory = Extension.create({
  name: 'documentHistory',
  addCommands() {
    const command =
      (direction: 'undo' | 'redo') =>
      () =>
      ({ dispatch, tr }: CommandProps) => {
        const session = documentRuntime.session()
        if (
          !session ||
          !session.state()[direction === 'undo' ? 'canUndo' : 'canRedo']
        )
          return false
        if (dispatch) tr.setMeta('hibiHistory', direction)
        return true
      }
    return {
      undo: command('undo'),
      redo: command('redo'),
      keyboardShortcut: (name) => (props) => {
        const parts = name.toLowerCase().split(/-(?!$)/),
          key = parts.pop()
        const modifiers =
          isiOS() || isMacOS()
            ? ['mod', 'cmd', 'meta', 'm']
            : ['mod', 'ctrl', 'control', 'c']
        if (
          parts.some((part) => modifiers.includes(part)) &&
          parts.every((part) => part === 'shift' || modifiers.includes(part)) &&
          (key === 'z' || (key === 'y' && !parts.includes('shift')))
        ) {
          command(key === 'y' || parts.includes('shift') ? 'redo' : 'undo')()(
            props,
          )
          return true
        }
        return coreCommands.keyboardShortcut(name)(props)
      },
    }
  },
  dispatchTransaction({ transaction, next }) {
    if (this.editor.isCapturingTransaction) {
      next(transaction)
      return
    }
    const direction = transaction.getMeta('hibiHistory')
    if (direction === 'undo') documentRuntime.session()?.undo()
    else if (direction === 'redo') documentRuntime.session()?.redo()
    else next(transaction)
  },
  addKeyboardShortcuts() {
    return {
      'Mod-z': () => this.editor.commands.undo(),
      'Mod-Shift-z': () => this.editor.commands.redo(),
      'Mod-y': () => this.editor.commands.redo(),
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            beforeinput: (_view, event) => {
              if (
                event.inputType !== 'historyUndo' &&
                event.inputType !== 'historyRedo'
              )
                return false
              event.preventDefault()
              if (event.inputType === 'historyUndo')
                documentRuntime.session()?.undo()
              else documentRuntime.session()?.redo()
              return true
            },
          },
        },
      }),
    ]
  },
})
