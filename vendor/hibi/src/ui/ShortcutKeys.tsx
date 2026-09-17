import { shortcutLabels } from '../shared/hotkeys'

export function ShortcutKeys({
  shortcut,
  platform,
}: {
  shortcut: string
  platform: string
}) {
  return (
    <span className="shortcut-keys">
      {shortcutLabels(shortcut, platform).map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  )
}
