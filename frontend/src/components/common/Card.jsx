import '../../styles/common/card.css';

export function Card({ children, hoverable, className = '', ...props }) {
  return (
    <div className={`common-card${hoverable ? ' common-card--hoverable' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={`common-card__header ${className}`}>{children}</div>;
}

export function CardTitle({ children }) {
  return <h3 className="common-card__title">{children}</h3>;
}

export function CardBody({ children, className = '' }) {
  return <div className={`common-card__body ${className}`}>{children}</div>;
}

export function CardFooter({ children }) {
  return <div className="common-card__footer">{children}</div>;
}

export function GlassCard({ children, className = '', ...props }) {
  return (
    <div className={`common-glass-card ${className}`} {...props}>
      {children}
    </div>
  );
}

export function StatCard({ icon, value, label, delta, deltaType = 'up', className = '' }) {
  return (
    <div className={`common-stat-card ${className}`}>
      {icon && <div className="common-stat-card__icon" aria-hidden="true">{icon}</div>}
      <div className="common-stat-card__value">{value ?? '—'}</div>
      <div className="common-stat-card__label">{label}</div>
      {delta !== undefined && (
        <div className={`common-stat-card__delta common-stat-card__delta--${deltaType}`}>
          {deltaType === 'up' ? '↑' : '↓'} {delta}
        </div>
      )}
    </div>
  );
}
