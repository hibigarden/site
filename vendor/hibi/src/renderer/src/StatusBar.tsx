import type { StatusItem } from '../../addons/api'

export function StatusBar({ items }: { items: readonly StatusItem[] }) {
  if (!items.length) return null
  return (
    <section className="app-statusbar" aria-label="editor status">
      {items.map((item) =>
        item.onClick ? (
          <button
            key={item.id}
            type="button"
            className="status-pill"
            data-status-id={item.id}
            title={item.tooltip}
            onClick={() => void item.onClick?.()}
          >
            {item.label}
          </button>
        ) : (
          <span
            key={item.id}
            className="status-pill"
            data-status-id={item.id}
            title={item.tooltip}
            role="status"
          >
            {item.label}
          </span>
        ),
      )}
    </section>
  )
}
