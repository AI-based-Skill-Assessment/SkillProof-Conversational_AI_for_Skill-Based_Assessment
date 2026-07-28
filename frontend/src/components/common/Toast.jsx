import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/common/toast.css';

const ToastContext = createContext(null);

let _id = 0;

const ICONS = {
  success: (
    <svg className="common-toast__icon common-toast__icon--success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  error: (
    <svg className="common-toast__icon common-toast__icon--error" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>
  ),
  warning: (
    <svg className="common-toast__icon common-toast__icon--warning" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  ),
  info: (
    <svg className="common-toast__icon common-toast__icon--info" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
  ),
};

function ToastItem({ toast, onRemove }) {
  return (
    <div className="common-toast" role="alert" aria-live="polite">
      {ICONS[toast.type] || ICONS.info}
      <div className="common-toast__content">
        {toast.title && <div className="common-toast__title">{toast.title}</div>}
        {toast.message && <div className="common-toast__message">{toast.message}</div>}
      </div>
      <button className="common-toast__close" onClick={() => onRemove(toast.id)} aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((opts) => {
    const id = ++_id;
    const toast = { id, type: 'info', duration: 4000, ...opts };
    setToasts(prev => [...prev, toast]);
    if (toast.duration > 0) {
      setTimeout(() => remove(id), toast.duration);
    }
    return id;
  }, [remove]);

  const toast = useMemo(() => ({
    success: (title, message) => show({ type: 'success', title, message }),
    error:   (title, message) => show({ type: 'error',   title, message }),
    warning: (title, message) => show({ type: 'warning', title, message }),
    info:    (title, message) => show({ type: 'info',    title, message }),
    show,
    remove,
  }), [show, remove]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="common-toast-container" aria-label="Notifications">
          {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={remove} />)}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx;
}
