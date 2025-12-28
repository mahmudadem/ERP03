import React, { createContext, useContext, useState, useEffect } from 'react';

export type UiMode = 'classic' | 'windows';
export type Theme = 'light' | 'dark';
export type SidebarMode = 'classic' | 'submenus';

interface UserPreferencesContextType {
  uiMode: UiMode;
  sidebarMode: SidebarMode;
  theme: Theme;
  language: string;
  setUiMode: (mode: UiMode) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: string) => void;
  toggleUiMode: () => void;
  toggleSidebarMode: () => void;
  toggleTheme: () => void;
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

  const setUiMode = (mode: UiMode) => setUiModeState(mode);
  const setSidebarMode = (mode: SidebarMode) => setSidebarModeState(mode);
  const setTheme = (t: Theme) => setThemeState(t);

  const toggleUiMode = () => {
    setUiModeState(prev => prev === 'classic' ? 'windows' : 'classic');
  };

  const toggleSidebarMode = () => {
    setSidebarModeState(prev => prev === 'classic' ? 'submenus' : 'classic');
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <UserPreferencesContext.Provider value={{
      uiMode,
      sidebarMode,
      theme,
      language,
      setUiMode,
      setSidebarMode,
      setTheme,
      setLanguage,
      toggleUiMode,
      toggleSidebarMode,
      toggleTheme
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
