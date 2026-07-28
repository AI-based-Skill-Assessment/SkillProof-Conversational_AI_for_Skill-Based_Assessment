import '../../styles/common/primitives.css';

export default function Checkbox({ label, checked, onChange, disabled, id, className = '', ...props }) {
  return (
    <label className={`common-checkbox ${className}`} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="common-checkbox__input"
        {...props}
      />
      <span className="common-checkbox__box" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {label && <span className="common-checkbox__label">{label}</span>}
    </label>
  );
}
