import { useTheme } from '../../core/theme';
import '../../styles/common/theme-toggle.css';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      className={`common-theme-toggle${isDark ? ' common-theme-toggle--dark' : ''}`}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Mint Breeze (light mode)' : 'Switch to Aurora Night (dark mode)'}
      role="switch"
      aria-checked={isDark}
    >
      <span className="common-theme-toggle__thumb">
        {isDark ? (
          /* Moon */
          <svg className="common-theme-toggle__icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ) : (
          /* Sun */
          <svg className="common-theme-toggle__icon" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/>
            <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2"/>
            <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2"/>
            <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2"/>
          </svg>
        )}
      </span>
    </button>
  );
}
