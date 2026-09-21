import { useState, useRef, useEffect, useId } from 'react';
import '../../styles/common/primitives.css';

export default function Select({
  label,
  error,
  helper,
  required,
  id: propId,
  name,
  value,
  defaultValue,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
  ...props
}) {
  const generatedId = useId();
  const id = propId || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Derive controlled or local selected value
  const currentValue = value !== undefined ? value : defaultValue;
  const selectedOption = options.find((opt) => String(opt.value) === String(currentValue));

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSelect = (option) => {
    if (disabled) return;
    setIsOpen(false);
    if (onChange) {
      // Synthesize event matching native HTML select change event
      const event = {
        target: {
          name: name || id,
          id,
          value: option.value,
        },
      };
      onChange(event);
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => String(opt.value) === String(currentValue));
        const nextIndex = (currentIndex + 1) % options.length;
        if (options[nextIndex]) handleSelect(options[nextIndex]);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => String(opt.value) === String(currentValue));
        const prevIndex = (currentIndex - 1 + options.length) % options.length;
        if (options[prevIndex]) handleSelect(options[prevIndex]);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`common-select-wrapper ${isOpen ? 'common-select-wrapper--open' : ''} ${disabled ? 'common-select-wrapper--disabled' : ''} ${className}`}
    >
      {label && (
        <label
          htmlFor={id}
          className={`common-select__label${required ? ' common-input__label--required' : ''}`}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
        >
          {label}
        </label>
      )}

      {/* Hidden input for form data and accessibility */}
      <input
        type="hidden"
        id={id}
        name={name || id}
        value={currentValue ?? ''}
        required={required}
      />

      {/* Custom Select Trigger Button */}
      <button
        type="button"
        id={`${id}-trigger`}
        className={`common-select__trigger ${error ? 'common-select__trigger--error' : ''} ${isOpen ? 'common-select__trigger--active' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`common-select__value ${!selectedOption ? 'common-select__value--placeholder' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="common-select__chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {/* Custom Floating Dropdown List */}
      {isOpen && (
        <div className="common-select__dropdown anim-scale-in" role="listbox" tabIndex={-1}>
          <div className="common-select__options">
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(currentValue);
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`common-select__option ${isSelected ? 'common-select__option--selected' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  <span className="common-select__option-label">{opt.label}</span>
                  {isSelected && (
                    <span className="common-select__option-check" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <span className="common-input__error" role="alert">{error}</span>}
      {helper && !error && <span className="common-input__helper">{helper}</span>}
    </div>
  );
}
