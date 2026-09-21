import { File } from 'lucide-react'

export function LoadingScreen({
  full = false,
  label = 'Loading editor',
}: {
  full?: boolean
  label?: string
}) {
  return (
    <div
      className={`loading-screen${full ? ' boot-loading' : ''}`}
      role="status"
      aria-label={label}
    >
      <div className="loading-page">
        <File
          className="loading-page-base"
          size={44}
          strokeWidth={1.25}
          aria-hidden="true"
        />
        <File
          className="loading-page-shine"
          size={44}
          strokeWidth={1.25}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
