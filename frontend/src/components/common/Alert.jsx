import '../../styles/common/primitives.css';

export default function Alert({ type = 'info', children, className = '' }) {
  const iconMap = {
    info: (
      <svg className="common-alert__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
      </svg>
    ),
    success: (
      <svg className="common-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    warning: (
      <svg className="common-alert__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
      </svg>
    ),
    error: (
      <svg className="common-alert__icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    ),
  };

  return (
    <div className={`common-alert common-alert--${type} ${className}`} role="alert">
      {iconMap[type]}
      <div className="common-alert__content">{children}</div>
    </div>
  );
}
