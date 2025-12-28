
import { useState, useEffect } from 'react';

export type UiMode = 'classic' | 'windows';
export type Theme = 'light' | 'dark';
export type SidebarMode = 'classic' | 'submenus';

export const useUserPreferences = () => {
  // Get uiMode from localStorage, default to 'windows'
  const [uiMode, setUiModeState] = useState<UiMode>(() => {
    return (localStorage.getItem('erp_ui_mode') as UiMode) || 'windows';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('erp_theme') as Theme) || 'light';
  });

  const [sidebarMode, setSidebarModeState] = useState<SidebarMode>(() => {
    return (localStorage.getItem('erp_sidebar_mode') as SidebarMode) || 'classic';
  });

  const [language, setLanguage] = useState('en');

  // Persist theme to localStorage
  useEffect(() => {
    localStorage.setItem('erp_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const setUiMode = (mode: UiMode) => {
    setUiModeState(mode);
    localStorage.setItem('erp_ui_mode', mode);
  };

  const setSidebarMode = (mode: SidebarMode) => {
    setSidebarModeState(mode);
    localStorage.setItem('erp_sidebar_mode', mode);
  };

  const toggleUiMode = () => {
    const newMode = uiMode === 'classic' ? 'windows' : 'classic';
    setUiMode(newMode);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleSidebarMode = () => {
    const newMode = sidebarMode === 'classic' ? 'submenus' : 'classic';
    setSidebarMode(newMode);
  };

  return {
    uiMode,
    theme,
    sidebarMode,
    language,
    setUiMode,
    setSidebarMode,
    toggleUiMode,
    toggleTheme,
    toggleSidebarMode,
    setLanguage
  };
};
