import '../../styles/common/primitives.css';

export default function Stepper({ steps = [], currentStep, className = '' }) {
  return (
    <div className={`common-stepper ${className}`}>
      {steps.map((step, idx) => {
        const isActive = currentStep === idx;
        const isCompleted = currentStep > idx;
        return (
          <div
            key={step}
            className={`common-step${isActive ? ' common-step--active' : ''}${isCompleted ? ' common-step--completed' : ''}`}
          >
            <div className="common-step__circle" aria-hidden="true">
              {isCompleted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                idx + 1
              )}
            </div>
            <span className="common-step__label">{step}</span>
          </div>
        );
      })}
    </div>
  );
}
