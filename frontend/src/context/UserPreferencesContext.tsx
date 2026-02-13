import React, { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../i18n/config';
import { userPreferencesApi } from '../api/userPreferencesApi';
import { useAuth } from './AuthContext';

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
  savePreferences: () => Promise<void>;
  loadingFromServer: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
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
  const [loadedFromServer, setLoadedFromServer] = useState(false);
  useEffect(() => {
    const savedLang = localStorage.getItem('erp_language') || i18n.language || 'en';
    setLanguage(savedLang);
    if (i18n.language !== savedLang) {
      i18n.changeLanguage(savedLang);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch user preferences from backend once authenticated (token handled by apiClient)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const prefs = await userPreferencesApi.get();
        console.debug('[Prefs] Loaded from backend', { uid: user?.uid, prefs });
        if (cancelled) return;
        if (prefs.uiMode) setUiModeState(prefs.uiMode);
        if (prefs.theme) setThemeState(prefs.theme);
        if (prefs.sidebarMode) setSidebarModeState(prefs.sidebarMode);
        if (prefs.sidebarPinned !== undefined) setSidebarPinnedState(prefs.sidebarPinned);
        if (prefs.language) {
          setLanguage(prefs.language);
          i18n.changeLanguage(prefs.language);
        }
      } catch {
        // ignore and fall back to localStorage
      } finally {
        if (!cancelled) setLoadedFromServer(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

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

  useEffect(() => {
    localStorage.setItem('erp_language', language);
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  const setUiMode = (mode: UiMode) => setUiModeState(mode);
  const setSidebarMode = (mode: SidebarMode) => setSidebarModeState(mode);
  const setTheme = (t: Theme) => setThemeState(t);
  const setSidebarPinned = (pinned: boolean) => setSidebarPinnedState(pinned);
  const setLanguagePref = (lang: string) => setLanguage(lang);

  const savePreferences = async () => {
    const payload = { language, uiMode, theme, sidebarMode, sidebarPinned };
    const saved = await userPreferencesApi.upsert(payload);
    console.debug('[Prefs] Saved to backend', { uid: user?.uid, saved });
    // Ensure local state mirrors what backend stored (guards against stale UI)
    if (saved.language) {
      setLanguage(saved.language);
    }
    if (saved.uiMode) {
      setUiModeState(saved.uiMode);
    }
    if (saved.theme) {
      setThemeState(saved.theme);
    }
    if (saved.sidebarMode) {
      setSidebarModeState(saved.sidebarMode);
    }
    if (typeof saved.sidebarPinned === 'boolean') {
      setSidebarPinnedState(saved.sidebarPinned);
    }
  };

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
      setLanguage: setLanguagePref,
      setSidebarPinned,
      toggleUiMode,
      toggleSidebarMode,
      toggleTheme,
      toggleSidebarPinned,
      savePreferences,
      loadingFromServer: !loadedFromServer
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
