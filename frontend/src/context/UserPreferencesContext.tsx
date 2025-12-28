import React, { createContext, useContext, useState, useEffect } from 'react';

export type UiMode = 'classic' | 'windows';
export type Theme = 'light' | 'dark';
export type SidebarMode = 'classic' | 'submenus';

interface UserPreferencesContextType {
  uiMode: UiMode;
  sidebarMode: SidebarMode;
  theme: Theme;
  language: string;
  sidebarPinned: boolean;
  setUiMode: (mode: UiMode) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: string) => void;
  setSidebarPinned: (pinned: boolean) => void;
  toggleUiMode: () => void;
  toggleSidebarMode: () => void;
  toggleTheme: () => void;
  toggleSidebarPinned: () => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uiMode, setUiModeState] = useState<UiMode>(() => {
    return (localStorage.getItem('erp_ui_mode') as UiMode) || 'windows';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('erp_theme') as Theme) || 'light';
  });

  const [sidebarMode, setSidebarModeState] = useState<SidebarMode>(() => {
    return (localStorage.getItem('erp_sidebar_mode') as SidebarMode) || 'classic';
  });

  const [sidebarPinned, setSidebarPinnedState] = useState<boolean>(() => {
    const saved = localStorage.getItem('erp_sidebar_pinned');
    return saved === null ? true : saved === 'true';
  });

  const [language, setLanguage] = useState('en');

  // Persist to localStorage and apply theme
  useEffect(() => {
    localStorage.setItem('erp_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('erp_ui_mode', uiMode);
  }, [uiMode]);

  useEffect(() => {
    localStorage.setItem('erp_sidebar_mode', sidebarMode);
  }, [sidebarMode]);

  useEffect(() => {
    localStorage.setItem('erp_sidebar_pinned', String(sidebarPinned));
  }, [sidebarPinned]);

  const setUiMode = (mode: UiMode) => setUiModeState(mode);
  const setSidebarMode = (mode: SidebarMode) => setSidebarModeState(mode);
  const setTheme = (t: Theme) => setThemeState(t);
  const setSidebarPinned = (pinned: boolean) => setSidebarPinnedState(pinned);

  const toggleUiMode = () => {
    setUiModeState(prev => prev === 'classic' ? 'windows' : 'classic');
  };

  const toggleSidebarMode = () => {
    setSidebarModeState(prev => prev === 'classic' ? 'submenus' : 'classic');
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleSidebarPinned = () => {
    setSidebarPinnedState(prev => !prev);
  };

  return (
    <UserPreferencesContext.Provider value={{
      uiMode,
      sidebarMode,
      theme,
      language,
      sidebarPinned,
      setUiMode,
      setSidebarMode,
      setTheme,
      setLanguage,
      setSidebarPinned,
      toggleUiMode,
      toggleSidebarMode,
      toggleTheme,
      toggleSidebarPinned
    }}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferencesContext = () => {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferencesContext must be used within a UserPreferencesProvider');
  }
  return context;
};
