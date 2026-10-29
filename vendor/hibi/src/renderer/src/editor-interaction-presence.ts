import type { CommandExecutionContext } from '../../shared/foundation-contracts'
import type { RegisteredCommand } from './addons'

let providers = 0
let present = false
const listeners = new Set<() => void>()
let commandMenu: {
  commands: readonly RegisteredCommand[]
  capture: () => CommandExecutionContext
} = { commands: [], capture: () => ({ source: 'menu' }) }

export const hasEditorInteractionProviders = () =>
  providers > 0 || commandMenu.commands.length > 0

export const editorCommandMenu = () => commandMenu

// Editors reattach on every notice, which closes an open menu; the menu reads
// commands and providers when it opens, so only presence changes notify.
function publish() {
  if (present === hasEditorInteractionProviders()) return
  present = !present
  for (const listener of listeners) listener()
}

export function setEditorCommandMenu(
  commands: readonly RegisteredCommand[],
  capture: () => CommandExecutionContext,
) {
  commandMenu = {
    commands: commands
      .filter((command) => command.menu?.location === 'editor')
      .sort(
        (left, right) =>
          String(left.menu?.group ?? '').localeCompare(
            String(right.menu?.group ?? ''),
          ) ||
          (left.menu?.order ?? 0) - (right.menu?.order ?? 0) ||
          left.id.localeCompare(right.id),
      ),
    capture,
  }
  publish()
}

export function onEditorInteractionProvidersChanged(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function countEditorInteractionProvider() {
  providers++
  publish()
  let removed = false
  return () => {
    if (removed) return
    removed = true
    providers--
    publish()
  }
}
