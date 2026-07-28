import '../../styles/common/primitives.css';

export default function Tooltip({ text, children, className = '' }) {
  if (!text) return children;

  return (
    <div className={`common-tooltip-wrapper ${className}`}>
      {children}
      <span className="common-tooltip" role="tooltip">{text}</span>
    </div>
  );
}
