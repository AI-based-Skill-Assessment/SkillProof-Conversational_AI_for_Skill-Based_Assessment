import TiltCard from './TiltCard';
import '../../styles/common/card.css';

export { TiltCard };

export function Card({ children, hoverable, tilt = false, className = '', style = {}, ...props }) {
  if (hoverable || tilt) {
    return (
      <TiltCard
        className={`common-card common-card--hoverable ${className}`}
        style={style}
        maxTilt={8}
        scale={1.02}
        {...props}
      >
        {children}
      </TiltCard>
    );
  }

  return (
    <div className={`common-card ${className}`} style={style} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', style = {} }) {
  return <div className={`common-card__header ${className}`} style={style}>{children}</div>;
}

export function CardTitle({ children, className = '', style = {} }) {
  return <h3 className={`common-card__title ${className}`} style={style}>{children}</h3>;
}

export function CardBody({ children, className = '', style = {} }) {
  return <div className={`common-card__body ${className}`} style={style}>{children}</div>;
}

export function CardFooter({ children, className = '', style = {} }) {
  return <div className={`common-card__footer ${className}`} style={style}>{children}</div>;
}

export function GlassCard({ children, tilt = false, className = '', style = {}, ...props }) {
  if (tilt) {
    return (
      <TiltCard
        className={`common-glass-card ${className}`}
        style={style}
        maxTilt={10}
        scale={1.02}
        {...props}
      >
        {children}
      </TiltCard>
    );
  }

  return (
    <div className={`common-glass-card ${className}`} style={style} {...props}>
      {children}
    </div>
  );
}

export function StatCard({
  icon,
  value,
  label,
  delta,
  deltaType = 'up',
  className = '',
  style = {},
  maxTilt = 12,
  accentColor,
  ...props
}) {
  return (
    <TiltCard
      className={`common-stat-card ${className}`}
      style={style}
      maxTilt={maxTilt}
      scale={1.03}
      glare={false}
      accentColor={accentColor}
      {...props}
    >
      {icon && <div className="common-stat-card__icon" aria-hidden="true">{icon}</div>}
      <div className="common-stat-card__value">{value ?? '—'}</div>
      <div className="common-stat-card__label">{label}</div>
      {delta !== undefined && (
        <div className={`common-stat-card__delta common-stat-card__delta--${deltaType}`}>
          {deltaType === 'up' ? '↑' : '↓'} {delta}
        </div>
      )}
    </TiltCard>
  );
}
