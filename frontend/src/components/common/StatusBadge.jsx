import '../../styles/common/status-badge.css';

/**
 * StatusBadge — semantic pill badge.
 * @param {'success'|'warning'|'error'|'info'|'neutral'} variant
 * @param {boolean} dot - show colored dot indicator
 */
export default function StatusBadge({ children, variant = 'neutral', dot = true, className = '' }) {
  return (
    <span className={`common-status-badge common-status-badge--${variant} ${className}`}>
      {dot && <span className="common-status-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
