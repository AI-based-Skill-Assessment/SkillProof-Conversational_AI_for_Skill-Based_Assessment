import '../../styles/common/primitives.css';

export default function Select({ label, error, helper, required, id, options = [], className = '', ...props }) {
  return (
    <div className="common-select-wrapper">
      {label && (
        <label htmlFor={id} className={`common-select__label${required ? ' common-input__label--required' : ''}`}>
          {label}
        </label>
      )}
      <select id={id} className={`common-select__field ${error ? 'common-input__field--error' : ''} ${className}`} {...props}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="common-input__error" role="alert">{error}</span>}
      {helper && !error && <span className="common-input__helper">{helper}</span>}
    </div>
  );
}
