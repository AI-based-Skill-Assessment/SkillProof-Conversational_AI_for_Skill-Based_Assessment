import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/common/modal.css';

/**
 * Modal — portal-based dialog.
 * @param {boolean} open
 * @param {()=>void} onClose
 * @param {string} title
 * @param {'sm'|'md'|'lg'|'xl'} size
 * @param {ReactNode} footer
 */
export default function Modal({ open, onClose, title, size = 'md', footer, children }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div
      className="common-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`common-modal${size !== 'md' ? ` common-modal--${size}` : ''}`}>
        {title && (
          <div className="common-modal__header">
            <h2 className="common-modal__title">{title}</h2>
            {onClose && (
              <button className="common-modal__close" onClick={onClose} aria-label="Close dialog">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="common-modal__body">{children}</div>
        {footer && <div className="common-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
