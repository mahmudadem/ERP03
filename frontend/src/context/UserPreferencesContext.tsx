import React, { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../i18n/config';
import { userPreferencesApi } from '../api/userPreferencesApi';
import { useAuth } from './AuthContext';
import {
  applyUserAppearanceToDocument,
import React, { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../i18n/config';
import { userPreferencesApi } from '../api/userPreferencesApi';
import { useAuth } from './AuthContext';
import {
  applyUserAppearanceToDocument,
  DEFAULT_USER_APPEARANCE,
  loadLocalUserAppearance,
  normalizeUserAppearance,
  UserAppearanceSettings,
} from '../theme/userAppearance';

export type UiMode = 'classic' | 'windows';
export type Theme = 'light' | 'dark';
export type SidebarMode = 'classic' | 'submenus';
export type LayoutMode = 'legacy' | 'compact';

interface UserPreferencesContextType {
  uiMode: UiMode;
  sidebarMode: SidebarMode;
  theme: Theme;
  layoutMode: LayoutMode;
  appearanceSettings: UserAppearanceSettings;
  language: string;
  sidebarPinned: boolean;
  showWidgetsOnMobile: boolean;
  showTopbarActionsOnMobile: boolean;
  setUiMode: (mode: UiMode) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setTheme: (theme: Theme) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setAppearanceSettings: (settings: UserAppearanceSettings) => void;
  setLanguage: (lang: string) => void;
  setSidebarPinned: (pinned: boolean) => void;
  setShowWidgetsOnMobile: (show: boolean) => void;
  setShowTopbarActionsOnMobile: (show: boolean) => void;
  toggleUiMode: () => void;
  toggleSidebarMode: () => void;
  toggleTheme: () => void;
  toggleSidebarPinned: () => void;
  toggleLayoutMode: () => void;
  savePreferences: () => Promise<void>;
  loadingFromServer: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [uiMode, setUiModeState] = useState<UiMode>(() => {
    return (localStorage.getItem('erp_ui_mode') as UiMode) || 'windows';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('erp_theme') as Theme) || 'light';
  });

  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => {
    return (localStorage.getItem('erp_layout_mode') as LayoutMode) || 'legacy';
  });

  const [appearanceSettings, setAppearanceSettingsState] = useState<UserAppearanceSettings>(() => {
    return loadLocalUserAppearance();
  });

  const [sidebarMode, setSidebarModeState] = useState<SidebarMode>(() => {
    return (localStorage.getItem('erp_sidebar_mode') as SidebarMode) || 'classic';
  });

  const [sidebarPinned, setSidebarPinnedState] = useState<boolean>(() => {
    const saved = localStorage.getItem('erp_sidebar_pinned');
    return saved === null ? true : saved === 'true';
  });

  const [showWidgetsOnMobile, setShowWidgetsOnMobileState] = useState<boolean>(() => {
    const saved = localStorage.getItem('erp_show_widgets_mobile');
    return saved === null ? false : saved === 'true';
  });

  const [showTopbarActionsOnMobile, setShowTopbarActionsOnMobileState] = useState<boolean>(() => {
    const saved = localStorage.getItem('erp_show_topbar_actions_mobile');
    return saved === null ? false : saved === 'true';
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
    if (authLoading || !user) return;
    const load = async () => {
      try {
        const prefs = await userPreferencesApi.get();
        console.debug('[Prefs] Loaded from backend', { uid: user.uid, prefs });
        if (cancelled) return;
        if (prefs.uiMode) setUiModeState(prefs.uiMode);
        if (prefs.theme) setThemeState(prefs.theme);
        if ((prefs as any).layoutMode) setLayoutModeState((prefs as any).layoutMode);
        if (prefs.appearanceSettings) setAppearanceSettingsState(normalizeUserAppearance(prefs.appearanceSettings));
        if (prefs.sidebarMode) setSidebarModeState(prefs.sidebarMode);
        if (prefs.sidebarPinned !== undefined) setSidebarPinnedState(prefs.sidebarPinned);
        if (prefs.showWidgetsOnMobile !== undefined) setShowWidgetsOnMobileState(prefs.showWidgetsOnMobile);
        if (prefs.showTopbarActionsOnMobile !== undefined) setShowTopbarActionsOnMobileState(prefs.showTopbarActionsOnMobile);
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
  }, [authLoading, user]);

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
    applyUserAppearanceToDocument(appearanceSettings || DEFAULT_USER_APPEARANCE, theme, layoutMode);
  }, [appearanceSettings, theme, layoutMode]);

  useEffect(() => {
    localStorage.setItem('erp_layout_mode', layoutMode);
    document.documentElement.setAttribute('data-layout', layoutMode);
  }, [layoutMode]);

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
    localStorage.setItem('erp_show_widgets_mobile', String(showWidgetsOnMobile));
  }, [showWidgetsOnMobile]);

  useEffect(() => {
    localStorage.setItem('erp_show_topbar_actions_mobile', String(showTopbarActionsOnMobile));
  }, [showTopbarActionsOnMobile]);

  useEffect(() => {
    localStorage.setItem('erp_language', language);
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  const setUiMode = (mode: UiMode) => setUiModeState(mode);
  const setSidebarMode = (mode: SidebarMode) => setSidebarModeState(mode);
  const setTheme = (t: Theme) => setThemeState(t);
  const setLayoutMode = (mode: LayoutMode) => setLayoutModeState(mode);
  const setAppearanceSettings = (settings: UserAppearanceSettings) => setAppearanceSettingsState(normalizeUserAppearance(settings));
  const setSidebarPinned = (pinned: boolean) => setSidebarPinnedState(pinned);
  const setShowWidgetsOnMobile = (show: boolean) => setShowWidgetsOnMobileState(show);
  const setShowTopbarActionsOnMobile = (show: boolean) => setShowTopbarActionsOnMobileState(show);
  const setLanguagePref = (lang: string) => setLanguage(lang);

  const savePreferences = async () => {
    const payload = { language, uiMode, theme, sidebarMode, sidebarPinned, appearanceSettings, showWidgetsOnMobile, showTopbarActionsOnMobile, layoutMode };
    if (!user) return;
    const saved = await userPreferencesApi.upsert(payload);
    console.debug('[Prefs] Saved to backend', { uid: user.uid, saved });
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
    if ((saved as any).layoutMode) {
      setLayoutModeState((saved as any).layoutMode);
    }
    if (saved.appearanceSettings) {
      setAppearanceSettingsState(normalizeUserAppearance(saved.appearanceSettings));
    }
    if (saved.sidebarMode) {
      setSidebarModeState(saved.sidebarMode);
    }
    if (typeof saved.sidebarPinned === 'boolean') {
      setSidebarPinnedState(saved.sidebarPinned);
    }
    if (typeof saved.showWidgetsOnMobile === 'boolean') {
      setShowWidgetsOnMobileState(saved.showWidgetsOnMobile);
    }
    if (typeof saved.showTopbarActionsOnMobile === 'boolean') {
      setShowTopbarActionsOnMobileState(saved.showTopbarActionsOnMobile);
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

  const toggleLayoutMode = () => {
    setLayoutModeState(prev => prev === 'legacy' ? 'compact' : 'legacy');
  };

  return (
    <UserPreferencesContext.Provider value={{
      uiMode,
      sidebarMode,
      theme,
      layoutMode,
      appearanceSettings,
      language,
      sidebarPinned,
      setUiMode,
      setSidebarMode,
      setTheme,
      setLayoutMode,
      setAppearanceSettings,
      setLanguage: setLanguagePref,
      setSidebarPinned,
      showWidgetsOnMobile,
      showTopbarActionsOnMobile,
      setShowWidgetsOnMobile,
      setShowTopbarActionsOnMobile,
      toggleUiMode,
      toggleSidebarMode,
      toggleTheme,
      toggleSidebarPinned,
      toggleLayoutMode,
      savePreferences,
      loadingFromServer: !loadedFromServer
    }}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferencesContext = () => {
  const context = useContext(UserPreferencesContext);
  const [fallbackUiMode, setFallbackUiMode] = useState<UiMode>(() => {
    return (localStorage.getItem('erp_ui_mode') as UiMode) || 'windows';
  });
  const [fallbackTheme, setFallbackTheme] = useState<Theme>(() => {
    return (localStorage.getItem('erp_theme') as Theme) || 'light';
  });
  const [fallbackLayoutMode, setFallbackLayoutMode] = useState<LayoutMode>(() => {
    return (localStorage.getItem('erp_layout_mode') as LayoutMode) || 'legacy';
  });
  const [fallbackSidebarMode, setFallbackSidebarMode] = useState<SidebarMode>(() => {
    return (localStorage.getItem('erp_sidebar_mode') as SidebarMode) || 'classic';
  });
  const [fallbackSidebarPinned, setFallbackSidebarPinned] = useState<boolean>(() => {
    const saved = localStorage.getItem('erp_sidebar_pinned');
    return saved === null ? true : saved === 'true';
  });
  const [fallbackShowWidgetsOnMobile, setFallbackShowWidgetsOnMobile] = useState<boolean>(() => {
    const saved = localStorage.getItem('erp_show_widgets_mobile');
    return saved === null ? false : saved === 'true';
  });
  const [fallbackShowTopbarActionsOnMobile, setFallbackShowTopbarActionsOnMobile] = useState<boolean>(() => {
    const saved = localStorage.getItem('erp_show_topbar_actions_mobile');
    return saved === null ? false : saved === 'true';
  });
  const [fallbackLanguage, setFallbackLanguage] = useState(() => {
    return localStorage.getItem('erp_language') || i18n.language || 'en';
  });
  const [fallbackAppearanceSettings, setFallbackAppearanceSettings] = useState<UserAppearanceSettings>(() => {
    return loadLocalUserAppearance();
  });

  useEffect(() => {
    if (context !== undefined) return;
    console.warn('[Prefs] Missing UserPreferencesProvider; using local fallback preferences.');
  }, [context]);

  useEffect(() => {
    if (context !== undefined) return;
    localStorage.setItem('erp_theme', fallbackTheme);
    if (fallbackTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    applyUserAppearanceToDocument(fallbackAppearanceSettings || DEFAULT_USER_APPEARANCE, fallbackTheme, fallbackLayoutMode);
  }, [context, fallbackTheme, fallbackAppearanceSettings, fallbackLayoutMode]);

  useEffect(() => {
    if (context !== undefined) return;
    localStorage.setItem('erp_layout_mode', fallbackLayoutMode);
    document.documentElement.setAttribute('data-layout', fallbackLayoutMode);
  }, [context, fallbackLayoutMode]);

  useEffect(() => {
    if (context !== undefined) return;
    localStorage.setItem('erp_ui_mode', fallbackUiMode);
  }, [context, fallbackUiMode]);

  useEffect(() => {
    if (context !== undefined) return;
    localStorage.setItem('erp_sidebar_mode', fallbackSidebarMode);
  }, [context, fallbackSidebarMode]);

  useEffect(() => {
    if (context !== undefined) return;
    localStorage.setItem('erp_sidebar_pinned', String(fallbackSidebarPinned));
  }, [context, fallbackSidebarPinned]);

  useEffect(() => {
    if (context !== undefined) return;
    localStorage.setItem('erp_show_widgets_mobile', String(fallbackShowWidgetsOnMobile));
  }, [context, fallbackShowWidgetsOnMobile]);

  useEffect(() => {
    if (context !== undefined) return;
    localStorage.setItem('erp_show_topbar_actions_mobile', String(fallbackShowTopbarActionsOnMobile));
  }, [context, fallbackShowTopbarActionsOnMobile]);

  useEffect(() => {
    if (context !== undefined) return;
    localStorage.setItem('erp_language', fallbackLanguage);
    if (i18n.language !== fallbackLanguage) {
      i18n.changeLanguage(fallbackLanguage);
    }
  }, [context, fallbackLanguage]);

  if (context !== undefined) {
    return context;
  }

  const setFallbackAppearance = (settings: UserAppearanceSettings) => {
    setFallbackAppearanceSettings(normalizeUserAppearance(settings));
  };

  return {
    uiMode: fallbackUiMode,
    sidebarMode: fallbackSidebarMode,
    theme: fallbackTheme,
    layoutMode: fallbackLayoutMode,
    appearanceSettings: fallbackAppearanceSettings,
    language: fallbackLanguage,
    sidebarPinned: fallbackSidebarPinned,
    showWidgetsOnMobile: fallbackShowWidgetsOnMobile,
    showTopbarActionsOnMobile: fallbackShowTopbarActionsOnMobile,
    setUiMode: setFallbackUiMode,
    setSidebarMode: setFallbackSidebarMode,
    setTheme: setFallbackTheme,
    setLayoutMode: setFallbackLayoutMode,
    setAppearanceSettings: setFallbackAppearance,
    setLanguage: setFallbackLanguage,
    setSidebarPinned: setFallbackSidebarPinned,
    setShowWidgetsOnMobile: setFallbackShowWidgetsOnMobile,
    setShowTopbarActionsOnMobile: setFallbackShowTopbarActionsOnMobile,
    toggleUiMode: () => setFallbackUiMode((prev) => prev === 'classic' ? 'windows' : 'classic'),
    toggleSidebarMode: () => setFallbackSidebarMode((prev) => prev === 'classic' ? 'submenus' : 'classic'),
    toggleTheme: () => setFallbackTheme((prev) => prev === 'light' ? 'dark' : 'light'),
    toggleSidebarPinned: () => setFallbackSidebarPinned((prev) => !prev),
    toggleLayoutMode: () => setFallbackLayoutMode((prev) => prev === 'legacy' ? 'compact' : 'legacy'),
    savePreferences: async () => {},
    loadingFromServer: false,
  };
};
