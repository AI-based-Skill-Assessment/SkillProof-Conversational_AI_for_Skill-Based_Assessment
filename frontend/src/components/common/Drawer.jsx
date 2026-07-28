import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/common/primitives.css';

export default function Drawer({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="common-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="common-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="common-drawer__header">
          <h2 className="common-drawer__title">{title}</h2>
          <button className="common-modal__close" onClick={onClose} aria-label="Close drawer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="common-drawer__body">{children}</div>
      </div>
    </>,
    document.body
  );
}
