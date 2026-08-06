import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Info, X } from 'lucide-react'

export function Section({
  id,
  icon,
  eyebrow,
  title,
  description,
  children,
  className = '',
}: {
  id: string
  icon: ReactNode
  eyebrow: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`panel ${className}`}>
      <div className="section-heading">
        <div className="section-icon" aria-hidden="true">
          {icon}
        </div>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export function TeachingTip({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <span className="tooltip-wrap">
      <button
        className="tooltip-trigger"
        type="button"
        aria-label={`查看${title}说明`}
      >
        <Info size={15} />
      </button>
      <span className="tooltip-card" role="tooltip">
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
    </span>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  return (
    <button
      {...props}
      className={`button button-${variant} ${className}`}
    />
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (value: T) => void
  items: Array<{ value: T; label: ReactNode }>
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={value === item.value ? 'active' : ''}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: ReactNode
  accent?: 'cyan' | 'green' | 'yellow' | 'red'
}) {
  return (
    <div className={`metric-card ${accent ? `metric-${accent}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="关闭弹窗">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Toast({
  message,
  tone,
  onClose,
}: {
  message: string
  tone: 'success' | 'error' | 'info'
  onClose: () => void
}) {
  return (
    <div className={`toast toast-${tone}`} role="status">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="关闭提示">
        <X size={16} />
      </button>
    </div>
  )
}
