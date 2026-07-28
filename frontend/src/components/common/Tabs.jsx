import '../../styles/common/primitives.css';

export default function Tabs({ tabs = [], activeTab, onChange, className = '' }) {
  return (
    <div className={`common-tabs ${className}`} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={activeTab === tab.value}
          className={`common-tabs__btn${activeTab === tab.value ? ' common-tabs__btn--active' : ''}`}
          onClick={() => onChange?.(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
