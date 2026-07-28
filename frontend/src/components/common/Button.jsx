import '../../styles/common/button.css';

/**
 * Button — reusable button component.
 *
 * @param {string}  variant   - 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
 * @param {string}  size      - 'sm' | 'md' | 'lg'
 * @param {boolean} fullWidth - spans container width
 * @param {boolean} loading   - shows spinner
 * @param {boolean} iconOnly  - square icon button
 * @param {string}  as        - 'button' | 'a' — render as anchor
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  iconOnly = false,
  as: Tag = 'button',
  className = '',
  disabled,
  ...props
}) {
  const classes = [
    'common-button',
    `common-button--${variant}`,
    size !== 'md' && `common-button--${size}`,
    fullWidth && 'common-button--full',
    iconOnly && 'common-button--icon',
    loading && 'common-button--loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} disabled={loading || disabled} {...props}>
      {loading && <span className="common-button__spinner" aria-hidden="true" />}
      {children}
    </Tag>
  );
}
