import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IconButton } from '../../ui/Controls'

export type FindStatus = { current: number; total: number }
export type FindMove = { id: number; direction: 'next' | 'previous' }

export function FindBar({
  open,
  query,
  onQuery,
  status,
  onMove,
  onClose,
}: {
  open: boolean
  query: string
  onQuery: (query: string) => void
  status: FindStatus
  onMove: (direction: FindMove['direction']) => void
  onClose: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const counter = useRef<HTMLSpanElement>(null)
  const [counterWidth, setCounterWidth] = useState(0)
  const count = query
    ? status.total
      ? `${status.current}/${status.total}`
      : 'no results'
    : ''
  useLayoutEffect(() => {
    if (!open) return
    setCounterWidth(count ? (counter.current?.offsetWidth ?? 0) : 0)
  }, [count, open])
  useEffect(() => {
    if (open) {
      input.current?.focus()
      input.current?.select()
    }
  }, [open])

  return (
    <search className="find-bar" aria-label="find in note" hidden={!open}>
      <div className="find-input">
        <Search size={15} aria-hidden="true" />
        <input
          ref={input}
          aria-label="find in note"
          placeholder="find in note"
          value={query}
          spellCheck={false}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onMove(event.shiftKey ? 'previous' : 'next')
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              onClose()
            }
          }}
        />
      </div>
      <output
        aria-live="polite"
        aria-label="find matches"
        style={{ width: counterWidth }}
      >
        <span className="find-count" ref={counter}>
          {count}
        </span>
      </output>
      <IconButton
        type="button"
        aria-label="previous match"
        title="previous match (shift+enter)"
        disabled={!status.total}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onMove('previous')}
      >
        <ChevronUp size={16} aria-hidden="true" />
      </IconButton>
      <IconButton
        type="button"
        aria-label="next match"
        title="next match (enter)"
        disabled={!status.total}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onMove('next')}
      >
        <ChevronDown size={16} aria-hidden="true" />
      </IconButton>
      <IconButton
        type="button"
        aria-label="close find"
        title="close find (escape)"
        onClick={onClose}
      >
        <X size={16} aria-hidden="true" />
      </IconButton>
    </search>
  )
}
