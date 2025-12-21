
import { useState, useEffect } from 'react';
import { useCompanySettings } from './useCompanySettings';

export type UiMode = 'classic' | 'windows';
export type Theme = 'light' | 'dark';

export const useUserPreferences = () => {
  const { settings, updateSettings } = useCompanySettings();
  
  // Get uiMode from CompanySettings, fallback to localStorage, then 'windows' as default
  const [uiMode, setUiModeState] = useState<UiMode>(() => {
    return settings?.uiMode || (localStorage.getItem('erp_ui_mode') as UiMode) || 'windows';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('erp_theme') as Theme) || 'light';
  });

  const [language, setLanguage] = useState('en');

  // Sync with CompanySettings when it loads
  useEffect(() => {
    if (settings?.uiMode && settings.uiMode !== uiMode) {
      setUiModeState(settings.uiMode);
    }
  }, [settings?.uiMode]);

  // Persist theme to localStorage
  useEffect(() => {
    localStorage.setItem('erp_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const setUiMode = async (mode: UiMode) => {
    setUiModeState(mode);
    localStorage.setItem('erp_ui_mode', mode);
    
    // Save to CompanySettings
    try {
      await updateSettings({ uiMode: mode });
    } catch (error) {
      console.error('Failed to update UI mode in company settings:', error);
    }
  };

  const toggleUiMode = async () => {
    const newMode = uiMode === 'classic' ? 'windows' : 'classic';
    await setUiMode(newMode);
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
