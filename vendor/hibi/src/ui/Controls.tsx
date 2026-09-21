import { ChevronDown } from 'lucide-react'
import {
  Children,
  type ComponentProps,
  type CSSProperties,
  cloneElement,
  isValidElement,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react'
import { sentenceCase } from '../shared/ui-case'
import { SettingsDiscovery, settingsIndex } from './settings-index'
import './controls.css'

type FieldStyle = {
  /** Subtle fields blend into property rows; inline fields sit inside another control. */
  variant?: 'default' | 'subtle' | 'inline'
  monospace?: boolean
}

export function TextInput({
  className = '',
  variant = 'default',
  monospace = false,
  type = 'text',
  ...props
}: ComponentProps<'input'> & FieldStyle) {
  return (
    <input
      {...props}
      type={type}
      data-variant={variant}
      className={`ui-field ui-input${monospace ? ' ui-code-field' : ''} ${className}`}
    />
  )
}

export function TextArea({
  className = '',
  variant = 'default',
  monospace = false,
  ...props
}: ComponentProps<'textarea'> & FieldStyle) {
  return (
    <textarea
      {...props}
      data-variant={variant}
      className={`ui-field ui-textarea${monospace ? ' ui-code-field' : ''} ${className}`}
    />
  )
}

/** Shared spacing for extension panels and wrapping rows of controls. */
export function Panel({ className = '', ...props }: ComponentProps<'div'>) {
  return <div {...props} className={`ui-panel ${className}`} />
}

/** A centered, quiet empty/error state for a panel. */
export function PanelMessage({
  icon,
  title,
  children,
  role = 'status',
  loading = false,
}: {
  icon: ReactNode
  title: string
  children?: ReactNode
  role?: 'status' | 'alert'
  loading?: boolean
}) {
  return (
    <div className="ui-panel-message" role={role} data-loading={loading}>
      <span className="ui-panel-message-icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

export function ControlRow({
  className = '',
  ...props
}: ComponentProps<'div'>) {
  return <div {...props} className={`ui-control-row ${className}`} />
}

export function Button({
  className = '',
  variant = 'default',
  title,
  ...props
}: ComponentProps<'button'> & {
  variant?: 'default' | 'primary' | 'ghost' | 'row'
}) {
  return (
    <button
      type="button"
      data-tooltip={title}
      {...props}
      data-variant={variant}
      className={`ui-button ${className}`}
    />
  )
}

export function Select({ children, ...props }: ComponentProps<'select'>) {
  return (
    <span className="select-control">
      <select {...props}>
        {Children.map(children, (child) =>
          isValidElement<ComponentProps<'option'>>(child) &&
          child.type === 'option' &&
          typeof child.props.children === 'string'
            ? cloneElement(child, {
                value: child.props.value ?? child.props.children,
                children: sentenceCase(child.props.children),
              })
            : child,
        )}
      </select>
      <ChevronDown aria-hidden="true" />
    </span>
  )
}

export function IconButton({
  className = '',
  title,
  ...props
}: ComponentProps<'button'> & { 'aria-label': string }) {
  return (
    <button
      type="button"
      data-tooltip={title}
      {...props}
      className={`icon-button ${className}`}
    />
  )
}

export function Toggle(
  props: Omit<ComponentProps<'input'>, 'type' | 'className'>,
) {
  return <input {...props} type="checkbox" className="setting-toggle" />
}

/** Native range semantics with a shared themed track and thumb. */
export function Slider({
  min = 0,
  max = 100,
  value,
  style,
  className = '',
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'defaultValue'> & { value: number }) {
  const range = Number(max) - Number(min)
  const fill =
    range > 0
      ? Math.max(0, Math.min(100, ((value - Number(min)) / range) * 100))
      : 0
  return (
    <input
      {...props}
      type="range"
      min={min}
      max={max}
      value={value}
      className={`ui-slider ${className}`}
      style={{ ...style, '--slider-fill': `${fill}%` } as CSSProperties}
    />
  )
}

export function SettingRow({
  id,
  label,
  description,
  children,
  hidden = false,
  details,
}: {
  id: string
  label: string
  description?: ReactNode
  children: ReactNode
  hidden?: boolean
  /** Open a detail dialog from the row while leaving its controls independent. */
  details?: { label: string; onOpen: () => void }
}) {
  const row = useRef<HTMLDivElement>(null)
  const displayLabel = sentenceCase(label)
  const discover = useContext(SettingsDiscovery)
  useEffect(() => {
    if (discover && row.current)
      return settingsIndex.register(row.current, id, displayLabel)
  }, [discover, id, displayLabel])
  return (
    <div
      className={`setting-row${details ? ' setting-row-openable' : ''}`}
      data-setting-id={id}
      tabIndex={-1}
      ref={row}
      hidden={hidden}
    >
      {details ? (
        <button
          type="button"
          className="setting-copy setting-row-action"
          aria-label={details.label}
          aria-haspopup="dialog"
          onClick={details.onOpen}
        >
          <span className="setting-label">{displayLabel}</span>
          {description != null && (
            <span className="setting-description" id={`${id}-description`}>
              {typeof description === 'string'
                ? sentenceCase(description)
                : description}
            </span>
          )}
        </button>
      ) : (
        <div className="setting-copy">
          <label htmlFor={id}>{displayLabel}</label>
          {description != null && (
            <p id={`${id}-description`}>
              {typeof description === 'string'
                ? sentenceCase(description)
                : description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
