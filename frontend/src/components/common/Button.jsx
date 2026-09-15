import '../../styles/common/button.css';

/**
 * Button — reusable button component.
 *
 * @param {string}  variant   - 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
 * @param {string}  size      - 'sm' | 'md' | 'lg'
 * @param {boolean} fullWidth - spans container width
 * @param {boolean} loading   - shows spinner
 * @param {boolean} shimmer   - adds a subtle attention shimmer
 * @param {boolean} iconOnly  - square icon button
 * @param {string}  as        - 'button' | 'a' — render as anchor
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  shimmer = false,
  iconOnly = false,
  as: Tag = 'button',
  className = '',
  disabled,
  onClick,
  ...props
}) {
  const classes = [
    'common-button',
    `common-button--${variant}`,
    size !== 'md' && `common-button--${size}`,
    fullWidth && 'common-button--full',
    iconOnly && 'common-button--icon',
    loading && 'common-button--loading',
    shimmer && 'common-button--shimmer',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  function handleClick(event) {
    if (!disabled && !loading) {
      const button = event.currentTarget;
      const bounds = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      const diameter = Math.max(bounds.width, bounds.height) * 1.8;

      ripple.className = 'common-button__ripple';
      ripple.style.width = `${diameter}px`;
      ripple.style.height = `${diameter}px`;
      ripple.style.left = `${event.clientX - bounds.left - diameter / 2}px`;
      ripple.style.top = `${event.clientY - bounds.top - diameter / 2}px`;
      button.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    }

    onClick?.(event);
  }

  return (
    <Tag className={classes} disabled={loading || disabled} onClick={handleClick} {...props}>
      {loading && <span className="common-button__spinner" aria-hidden="true" />}
      {children}
    </Tag>
  );
}
