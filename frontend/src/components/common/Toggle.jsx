import '../../styles/common/primitives.css';

export default function Toggle({ label, checked, onChange, disabled, id, className = '', ...props }) {
  return (
    <label className={`common-toggle ${className}`} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="common-toggle__input"
        role="switch"
        aria-checked={checked}
        {...props}
      />
      <span className="common-toggle__track" aria-hidden="true">
        <span className="common-toggle__thumb" />
      </span>
      {label && <span className="common-toggle__label">{label}</span>}
    </label>
  );
}
