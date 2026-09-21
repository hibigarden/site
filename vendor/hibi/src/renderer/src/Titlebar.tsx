import {
  ArrowLeft,
  Code,
  Columns2,
  FilePlus,
  FileText,
  FolderOpen,
  PanelLeft,
  Save,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DocumentCommand, DocumentState } from '../../shared/desktop'
import { isMarkdownDocument } from '../../shared/document-types'
import { type Hotkeys, shortcutLabels } from '../../shared/hotkeys'
import { IconButton } from '../../ui/Controls'
import { ShortcutKeys } from '../../ui/ShortcutKeys'
import type { ViewMode } from './Editor'

const icons = {
  new: FilePlus,
  open: FolderOpen,
  save: Save,
  normal: FileText,
  'side-by-side': Columns2,
  markdown: Code,
  settings: SlidersHorizontal,
  back: ArrowLeft,
} as const

function Icon({ name }: { name: keyof typeof icons }) {
  const Glyph = icons[name]
  return <Glyph size={16} strokeWidth={1.5} aria-hidden="true" />
}

export function Titlebar({
  document,
  settingsOpen,
  onSettings,
  onPalette,
  mode,
  onMode,
  onCommand,
  disabled,
  hotkeys,
  platform,
  sidebarOpen,
  onSidebar,
  onRename,
  busy,
}: {
  document: DocumentState | null
  settingsOpen: boolean
  onSettings: () => void
  onPalette: () => void
  mode: ViewMode
  onMode: (mode: ViewMode) => void
  onCommand: (command: DocumentCommand) => void
  disabled: boolean
  hotkeys: Hotkeys
  platform: string
  sidebarOpen: boolean
  onSidebar: () => void
  onRename: (name: string) => Promise<void>
  busy: boolean
}) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const field = input.current
    if (!renaming || !field) return
    field.focus()
    const extension = field.value.lastIndexOf('.')
    field.setSelectionRange(0, extension > 0 ? extension : field.value.length)
  }, [renaming])
  // biome-ignore lint/correctness/useExhaustiveDependencies: changing documents or screens cancels inline renaming.
  useEffect(() => setRenaming(false), [document?.name, settingsOpen])
  return (
    <header className="titlebar" aria-busy={busy}>
      <div className="sidebar-toolbar" data-open={sidebarOpen || settingsOpen}>
        {!settingsOpen && (
          <IconButton
            type="button"
            aria-label="toggle workspace sidebar"
            aria-pressed={sidebarOpen}
            title="workspace sidebar"
            onClick={onSidebar}
          >
            <PanelLeft size={16} strokeWidth={1.5} />
          </IconButton>
        )}
      </div>
      <div className="document-toolbar">
        {!settingsOpen && (
          <div className="document-actions">
            {(['new', 'open', 'save'] as const).map((command) => (
              <IconButton
                type="button"
                key={command}
                aria-label={command}
                title={`${command}${hotkeys[command] ? ` (${shortcutLabels(hotkeys[command], platform).join('')})` : ''}`}
                disabled={disabled}
                aria-disabled={busy || disabled}
                onClick={() => {
                  if (!busy) onCommand(command)
                }}
              >
                <Icon name={command} />
              </IconButton>
            ))}
          </div>
        )}
        <div className="document-title">
          {settingsOpen ? (
            <span>settings</span>
          ) : renaming ? (
            <input
              ref={input}
              className="inline-edit rename-input"
              aria-label="file name"
              value={name}
              spellCheck={false}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setRenaming(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setRenaming(false)
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  setRenaming(false)
                  void onRename(name)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="document-name"
              aria-label="rename document"
              title="rename document"
              disabled={disabled}
              onClick={() => {
                if (busy) return
                setName(document?.name ?? 'untitled.md')
                setRenaming(true)
              }}
            >
              <span>
                {settingsOpen ? 'settings' : (document?.name ?? 'hibi')}
              </span>
              {!settingsOpen && document?.dirty && (
                <span
                  className="dirty-dot"
                  role="status"
                  aria-label="unsaved changes"
                >
                  •
                </span>
              )}
            </button>
          )}
        </div>
        <button
          type="button"
          className="palette-trigger"
          aria-label="command palette"
          title="command palette"
          onClick={onPalette}
        >
          <Search size={14} strokeWidth={1.5} aria-hidden="true" />
          {hotkeys.palette && (
            <ShortcutKeys shortcut={hotkeys.palette} platform={platform} />
          )}
        </button>
        <nav
          className="view-switch"
          aria-label={settingsOpen ? 'navigation' : 'editor view'}
        >
          {!settingsOpen &&
            (['normal', 'side-by-side', 'markdown'] as const).map((view) => {
              const label =
                view === 'markdown'
                  ? document && !isMarkdownDocument(document.name)
                    ? 'source only'
                    : 'markdown only'
                  : view
              return (
                <IconButton
                  type="button"
                  key={view}
                  aria-label={label}
                  title={`${label}${hotkeys[view] ? ` (${shortcutLabels(hotkeys[view], platform).join('')})` : ''}`}
                  aria-pressed={mode === view}
                  onClick={() => onMode(view)}
                >
                  <Icon name={view} />
                </IconButton>
              )
            })}
          <IconButton
            type="button"
            aria-label={settingsOpen ? 'back to editor' : 'editor settings'}
            title={settingsOpen ? 'back to editor' : 'editor settings'}
            aria-pressed={settingsOpen}
            onClick={onSettings}
          >
            <Icon name={settingsOpen ? 'back' : 'settings'} />
          </IconButton>
        </nav>
      </div>
    </header>
  )
}
