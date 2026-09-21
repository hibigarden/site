import {
  FileText,
  LayoutTemplate,
  Search,
  Settings2,
  Sun,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sentenceCase } from '../../shared/ui-case'
import { IconButton, TextInput } from '../../ui/Controls'
import { Modal } from '../../ui/Modal'
import { ShortcutKeys } from '../../ui/ShortcutKeys'

const categoryIcons = {
  app: LayoutTemplate,
  file: FileText,
  edit: Search,
  view: LayoutTemplate,
  preferences: Settings2,
  appearance: Sun,
  addons: Settings2,
  documents: FileText,
  settings: Settings2,
  extensions: Settings2,
  themes: Sun,
  format: FileText,
}

export type PaletteCommand = {
  id: string
  label: string
  category: keyof typeof categoryIcons
  shortcut?: string
  keywords?: string
  run: () => void
}

export function CommandPalette({
  commands,
  onClose,
  platform,
  searchCommands,
}: {
  commands: PaletteCommand[]
  onClose: () => void
  platform: string
  searchCommands?: (query: string) => PaletteCommand[]
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const closing = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const [marker, setMarker] = useState<{ top: number; height: number } | null>(
    null,
  )
  const normalized = query.toLowerCase().trim()
  const terms = normalized.split(/\s+/)
  const rank = (command: PaletteCommand) => {
    const label = command.label.toLowerCase()
    if (label === normalized) return 0
    if (label.startsWith(normalized)) return 1
    return terms.every((term) => label.includes(term)) ? 2 : 3
  }
  const results = searchCommands
    ? searchCommands(query)
    : commands.filter((command) =>
        terms.every((term) =>
          `${command.category} ${command.label} ${command.keywords ?? ''}`
            .toLowerCase()
            .includes(term),
        ),
      )
  if (!searchCommands && normalized)
    results.sort((left, right) => rank(left) - rank(right))
  const active = Math.min(selected, results.length - 1)
  const activeId = results[active]?.id
  const resultCount = results.length

  // biome-ignore lint/correctness/useExhaustiveDependencies: selection and filtering change the measured row.
  useLayoutEffect(() => {
    const container = list.current
    const row = container?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!container || !row) {
      setMarker(null)
      return
    }
    const measure = () =>
      setMarker((current) => {
        const next = { top: row.offsetTop, height: row.offsetHeight }
        return current?.top === next.top && current.height === next.height
          ? current
          : next
      })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(row)
    return () => observer.disconnect()
  }, [activeId, resultCount])

  useEffect(() => {
    input.current?.focus()
    return () => {
      clearTimeout(closeTimer.current)
    }
  }, [])

  useEffect(() => {
    if (activeId)
      window.document
        .getElementById(`command-${activeId}`)
        ?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  function close(after?: () => void) {
    if (closing.current) return
    closing.current = true
    const finish = () => {
      dialog.current?.close()
      onClose()
      if (after) requestAnimationFrame(after)
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish()
    else {
      dialog.current?.classList.add('closing')
      closeTimer.current = setTimeout(finish, 140)
    }
  }

  function execute(command: PaletteCommand) {
    close(command.run)
  }

  return (
    <Modal
      ref={dialog}
      className="command-palette"
      aria-label="Command palette"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          close()
        }
      }}
      onDismiss={() => close()}
    >
      <div className="command-search">
        <Search size={16} aria-hidden="true" />
        <TextInput
          variant="inline"
          ref={input}
          role="combobox"
          aria-label="Search commands"
          aria-expanded="true"
          aria-controls="command-results"
          aria-autocomplete="list"
          aria-activedescendant={
            results[active] ? `command-${results[active].id}` : undefined
          }
          placeholder="Search commands…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelected(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (results.length)
                setSelected(
                  (active +
                    (event.key === 'ArrowDown' ? 1 : results.length - 1)) %
                    results.length,
                )
            } else if (event.key === 'Enter') {
              event.preventDefault()
              const command = results[active]
              if (command) execute(command)
            }
          }}
        />
        <IconButton
          type="button"
          className="palette-close"
          aria-label="Close command palette"
          title="Close (Escape)"
          onClick={() => close()}
        >
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <div
        id="command-results"
        ref={list}
        className="command-results"
        role="listbox"
        aria-label="Commands"
      >
        {marker && (
          <div
            className="command-selection"
            aria-hidden="true"
            style={{
              transform: `translateY(${marker.top}px)`,
              height: marker.height,
            }}
          />
        )}
        {results.map((command, index) => {
          const Icon = categoryIcons[command.category]
          return (
            <div
              key={command.id}
              id={`command-${command.id}`}
              role="option"
              aria-selected={index === active}
              tabIndex={-1}
              onMouseEnter={() => setSelected(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => execute(command)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') execute(command)
              }}
            >
              <Icon
                size={16}
                strokeWidth={1.5}
                className="command-icon"
                aria-hidden="true"
              />
              <span className="command-label">
                {sentenceCase(command.label)}
              </span>
              <span className="command-category">
                {sentenceCase(command.category)}
              </span>
              {command.shortcut && (
                <ShortcutKeys shortcut={command.shortcut} platform={platform} />
              )}
            </div>
          )
        })}
      </div>
      {results.length === 0 && (
        <p className="commands-empty" role="status">
          No commands found.
        </p>
      )}
      <footer className="palette-footer">
        <span>
          <ShortcutKeys shortcut="arrowup" platform={platform} />
          <ShortcutKeys shortcut="arrowdown" platform={platform} /> Navigate
        </span>
        <span>
          <ShortcutKeys shortcut="enter" platform={platform} /> Run
        </span>
        <span className="palette-escape">
          <ShortcutKeys shortcut="escape" platform={platform} /> Close
        </span>
      </footer>
    </Modal>
  )
}
