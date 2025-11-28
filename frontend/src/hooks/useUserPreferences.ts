
import { useState, useEffect } from 'react';

export type UiMode = 'classic' | 'windows';
export type Theme = 'light' | 'dark';

export const useUserPreferences = () => {
  // Initialize from localStorage or default
  const [uiMode, setUiMode] = useState<UiMode>(() => {
    return (localStorage.getItem('erp_ui_mode') as UiMode) || 'classic';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('erp_theme') as Theme) || 'light';
  });

  const [language, setLanguage] = useState('en');

  // Persist changes
  useEffect(() => {
    localStorage.setItem('erp_ui_mode', uiMode);
  }, [uiMode]);

  useEffect(() => {
    localStorage.setItem('erp_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleUiMode = () => {
    setUiMode((prev) => (prev === 'classic' ? 'windows' : 'classic'));
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return {
    uiMode,
    theme,
    language,
    setUiMode,
    toggleUiMode,
    toggleTheme,
    setLanguage
  };
};
