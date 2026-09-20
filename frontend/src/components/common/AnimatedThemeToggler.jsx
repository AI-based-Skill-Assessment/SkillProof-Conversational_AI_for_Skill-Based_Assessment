import React, { useRef } from 'react';
import { useTheme } from '../../core/theme';
import '../../styles/common/animated-theme-toggler.css';

// Theme Toggle: Animated circular transition using View Transitions API
export function AnimatedThemeToggler({ className = '', ...props }) {
  const { isDark, toggleTheme } = useTheme();
  const buttonRef = useRef(null);

  const handleToggle = async (event) => {
    const isAppearanceTransition =
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isAppearanceTransition) {
      toggleTheme();
      return;
    }

    // Capture click or button center coordinates immediately
    const rect = buttonRef.current?.getBoundingClientRect();
    const x = event?.clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const y = event?.clientY ?? (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    ) * 1.05;

    // Trigger transition immediately without main-thread blocking
    const transition = document.startViewTransition(() => {
      toggleTheme();
    });

    try {
      await transition.ready;

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 600,
          easing: 'cubic-bezier(0.2, 0.9, 0.35, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    } catch {
      // Fallback
    }
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`animated-theme-toggler${isDark ? ' animated-theme-toggler--dark' : ''} ${className}`.trim()}
      onClick={handleToggle}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      role="switch"
      aria-checked={isDark}
      {...props}
    >
      <div className="animated-theme-toggler__icon-wrap">
        {/* Sun Icon */}
        <svg
          className="animated-theme-toggler__icon animated-theme-toggler__sun"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>

        {/* Moon Icon */}
        <svg
          className="animated-theme-toggler__icon animated-theme-toggler__moon"
          viewBox="0 0 24 24"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </div>
    </button>
  );
}

export default AnimatedThemeToggler;
