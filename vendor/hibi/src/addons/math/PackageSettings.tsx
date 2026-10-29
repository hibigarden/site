import { useState } from 'react'
import { errorMessage } from '../../shared/errors'
import { Button, ControlRow, TextInput } from '../../ui/Controls'
import { useDialogs } from '../../ui/DialogProvider'
import { DocumentNotice } from '../../ui/DocumentNotice'
import type { LatexPackages } from '../_shared/format-specs'

export function PackageSettings() {
  const [catalog, setCatalog] = useState<LatexPackages | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const dialogs = useDialogs()
  async function request(method: string, name?: string) {
    setBusy(name ?? method)
    setError('')
    try {
      const result = (await window.hibi.queryAddon('math', method, name)) as
        | LatexPackages
        | undefined
      if (result) setCatalog(result)
      else
        setCatalog((current) =>
          current ? { ...current, downloaded: [] } : null,
        )
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy('')
    }
  }
  const term = query.trim().toLowerCase()
  const names =
    catalog?.names
      .filter((name) => name.toLowerCase().includes(term))
      .sort(
        (left, right) =>
          Number(right.toLowerCase() === term) -
            Number(left.toLowerCase() === term) ||
          Number(right.toLowerCase().startsWith(term)) -
            Number(left.toLowerCase().startsWith(term)),
      ) ?? []
  return (
    <>
      <h2>Packages</h2>
      <form
        style={{ marginBottom: 'var(--space-3)' }}
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy) void request('packages')
        }}
      >
        <ControlRow>
          <TextInput
            aria-label="Search LaTeX packages"
            placeholder="Search packages…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" disabled={!!busy}>
            Search
          </Button>
          <Button
            disabled={!!busy || !catalog?.downloaded.length}
            onClick={async () => {
              if (
                await dialogs.confirm({
                  title: 'Clear downloaded LaTeX packages?',
                  confirmLabel: 'Clear downloads',
                })
              )
                await request('clear-packages')
            }}
          >
            Clear downloads
          </Button>
        </ControlRow>
      </form>
      {busy && (
        <DocumentNotice
          busy
          title={
            busy === 'packages'
              ? 'Loading packages…'
              : busy === 'clear-packages'
                ? 'Clearing downloads…'
                : `Downloading ${busy}…`
          }
        />
      )}
      {error && (
        <DocumentNotice title="Package request failed" message={error} />
      )}
      {catalog && (
        <>
          <ul
            className="settings-group"
            style={{ listStyle: 'none', margin: 0 }}
            aria-label="LaTeX packages"
          >
            {names.slice(0, 40).map((name) => (
              <li className="setting-row" key={name}>
                <code
                  className="setting-copy"
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {name}
                </code>
                {catalog.downloaded.includes(name) && (
                  <span className="setting-availability">Downloaded</span>
                )}
                <Button
                  aria-label={`Download ${name}`}
                  disabled={!!busy}
                  onClick={() => void request('download-package', name)}
                >
                  {catalog.downloaded.includes(name)
                    ? 'Download again'
                    : 'Download'}
                </Button>
              </li>
            ))}
          </ul>
          {!names.length && <p>No matching packages.</p>}
          {names.length > 40 && (
            <p>
              Showing 40 of {names.length} packages. Search to narrow the list.
            </p>
          )}
        </>
      )}
    </>
  )
}
