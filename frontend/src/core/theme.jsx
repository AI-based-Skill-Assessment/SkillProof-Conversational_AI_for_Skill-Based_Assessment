/**
 * core/theme.js
 * ThemeContext — manages Aurora Night / Mint Breeze switching.
 * Persists to localStorage and applies [data-theme] on <html>.
 */
import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'skillproof-theme';
const DARK_THEME  = 'dark';
const LIGHT_THEME = 'light';

const ThemeContext = createContext({
  theme: LIGHT_THEME,
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === DARK_THEME || stored === LIGHT_THEME) return stored;
    // Fall back to system preference
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? DARK_THEME
      : LIGHT_THEME;
  });

  function applyThemeToDOM(nextTheme) {
    const html = document.documentElement;
    if (nextTheme === DARK_THEME) {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.removeAttribute('data-theme');
    }
    localStorage.setItem(STORAGE_KEY, nextTheme);
  }

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  function setTheme(value) {
    const next = value === DARK_THEME ? DARK_THEME : LIGHT_THEME;
    applyThemeToDOM(next);
    setThemeState(next);
  }

  function toggleTheme() {
    const next = theme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
    applyThemeToDOM(next);
    setThemeState(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === DARK_THEME, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
