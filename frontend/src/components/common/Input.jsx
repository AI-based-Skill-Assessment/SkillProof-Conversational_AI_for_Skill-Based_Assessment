import { useState } from 'react';
import '../../styles/common/input.css';

/**
 * Input — text/email/password/textarea with label, error, and icon support.
 *
 * @param {string}  label         - field label
 * @param {string}  error         - error message (shows error state)
 * @param {string}  helper        - helper text below field
 * @param {boolean} required      - adds * to label
 * @param {node}    iconLeft      - left icon node
 * @param {node}    iconRight     - right icon node (or auto-added for password)
 * @param {boolean} showStrength  - show password strength bar
 * @param {boolean} textarea      - render as <textarea>
 */
export default function Input({
  label,
  error,
  helper,
  required,
  iconLeft,
  iconRight,
  showStrength = false,
  textarea = false,
  id,
  className = '',
  type = 'text',
  value,
  ...props
}) {
  const [showPwd, setShowPwd] = useState(false);

  const isPassword = type === 'password';
  const actualType = isPassword ? (showPwd ? 'text' : 'password') : type;

  const fieldClasses = [
    'common-input__field',
    textarea && 'common-input__field--textarea',
    iconLeft  && 'common-input__field--has-left',
    (iconRight || isPassword) && 'common-input__field--has-right',
    error && 'common-input__field--error',
    className,
  ].filter(Boolean).join(' ');

  // Password strength calc
  function getStrength(val = '') {
    let s = 0;
    if (val.length >= 8)        s++;
    if (/[A-Z]/.test(val))     s++;
    if (/[0-9]/.test(val))     s++;
    if (/[^A-Za-z0-9]/.test(val)) s++;
    return s; // 0–4
  }

  const strength = isPassword && showStrength ? getStrength(value) : 0;
  const strengthVariants = ['', 'weak', 'weak', 'medium', 'strong'];

  const Tag = textarea ? 'textarea' : 'input';

  return (
    <div className="common-input-wrapper">
      {label && (
        <label htmlFor={id} className={`common-input__label${required ? ' common-input__label--required' : ''}`}>
          {label}
        </label>
      )}

      <div className="common-input__field-wrap">
        {iconLeft && (
          <span className="common-input__icon-left" aria-hidden="true">{iconLeft}</span>
        )}

        <Tag
          id={id}
          type={!textarea ? actualType : undefined}
          className={fieldClasses}
          value={value}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            className="common-input__icon-right"
            onClick={() => setShowPwd(p => !p)}
            aria-label={showPwd ? 'Hide password' : 'Show password'}
          >
            {showPwd ? (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        )}

        {iconRight && !isPassword && (
          <span className="common-input__icon-right" aria-hidden="true">{iconRight}</span>
        )}
      </div>

      {isPassword && showStrength && value && (
        <div className="common-input__strength" role="presentation">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={`common-input__strength-bar${strength >= i ? ` common-input__strength-bar--${strengthVariants[strength]}` : ''}`}
            />
          ))}
        </div>
      )}

      {error && (
        <span className="common-input__error" role="alert">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error}
        </span>
      )}

      {helper && !error && (
        <span className="common-input__helper">{helper}</span>
      )}
    </div>
  );
}
