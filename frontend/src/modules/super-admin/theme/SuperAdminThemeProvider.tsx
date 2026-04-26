import React, { useEffect, useMemo, useState } from 'react';

export type SuperAdminDensity = 'compact' | 'comfortable' | 'spacious';

export interface SuperAdminThemeSettings {
  id: string;
  name: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  mutedText: string;
  border: string;
  accent: string;
  accentContrast: string;
  radius: number;
  density: SuperAdminDensity;
  sidebar: 'light' | 'dark';
}

export const SUPER_ADMIN_THEME_STORAGE_KEY = 'erp.superAdmin.appearance';
export const SUPER_ADMIN_THEME_EVENT = 'erp-super-admin-theme-change';

export const SUPER_ADMIN_THEME_PRESETS: SuperAdminThemeSettings[] = [
  {
    id: 'operator',
    name: 'Operator',
    background: '#f1f5f9',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    text: '#0f172a',
    mutedText: '#64748b',
    border: '#e2e8f0',
    accent: '#0f172a',
    accentContrast: '#ffffff',
    radius: 8,
    density: 'comfortable',
    sidebar: 'light',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    background: '#111827',
    surface: '#1f2937',
    surfaceMuted: '#182231',
    text: '#f8fafc',
    mutedText: '#cbd5e1',
    border: '#334155',
    accent: '#38bdf8',
    accentContrast: '#082f49',
    radius: 8,
    density: 'comfortable',
    sidebar: 'dark',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    background: '#eef2ff',
    surface: '#ffffff',
    surfaceMuted: '#f5f7ff',
    text: '#1e1b4b',
    mutedText: '#6366f1',
    border: '#c7d2fe',
    accent: '#4f46e5',
    accentContrast: '#ffffff',
    radius: 10,
    density: 'comfortable',
    sidebar: 'light',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    background: '#ecfdf5',
    surface: '#ffffff',
    surfaceMuted: '#f0fdf4',
    text: '#052e16',
    mutedText: '#047857',
    border: '#bbf7d0',
    accent: '#059669',
    accentContrast: '#ffffff',
    radius: 8,
    density: 'compact',
    sidebar: 'light',
  },
  {
    id: 'contrast',
    name: 'High Contrast',
    background: '#ffffff',
    surface: '#ffffff',
    surfaceMuted: '#f3f4f6',
    text: '#000000',
    mutedText: '#374151',
    border: '#111827',
    accent: '#000000',
    accentContrast: '#ffffff',
    radius: 4,
    density: 'compact',
    sidebar: 'light',
  },
];

export const DEFAULT_SUPER_ADMIN_THEME = SUPER_ADMIN_THEME_PRESETS[0];

const densityVars: Record<SuperAdminDensity, Record<string, string>> = {
  compact: {
    '--sa-page-gap': '1rem',
    '--sa-page-x': '1.25rem',
    '--sa-page-y': '1rem',
    '--sa-row-y': '0.5rem',
    '--sa-panel-pad': '1rem',
  },
  comfortable: {
    '--sa-page-gap': '1.5rem',
    '--sa-page-x': '1.5rem',
    '--sa-page-y': '1.5rem',
    '--sa-row-y': '0.75rem',
    '--sa-panel-pad': '1.25rem',
  },
  spacious: {
    '--sa-page-gap': '2rem',
    '--sa-page-x': '2rem',
    '--sa-page-y': '2rem',
    '--sa-row-y': '1rem',
    '--sa-panel-pad': '1.5rem',
  },
};

export const normalizeSuperAdminTheme = (input?: Partial<SuperAdminThemeSettings> | null): SuperAdminThemeSettings => ({
  ...DEFAULT_SUPER_ADMIN_THEME,
  ...(input || {}),
  id: input?.id || DEFAULT_SUPER_ADMIN_THEME.id,
  name: input?.name || DEFAULT_SUPER_ADMIN_THEME.name,
});

export const loadSuperAdminTheme = (): SuperAdminThemeSettings => {
  if (typeof window === 'undefined') return DEFAULT_SUPER_ADMIN_THEME;
  try {
    const raw = window.localStorage.getItem(SUPER_ADMIN_THEME_STORAGE_KEY);
    return normalizeSuperAdminTheme(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_SUPER_ADMIN_THEME;
  }
};

export const saveSuperAdminTheme = (settings: SuperAdminThemeSettings) => {
  const normalized = normalizeSuperAdminTheme(settings);
  window.localStorage.setItem(SUPER_ADMIN_THEME_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(SUPER_ADMIN_THEME_EVENT, { detail: normalized }));
};

export const resetSuperAdminTheme = () => saveSuperAdminTheme(DEFAULT_SUPER_ADMIN_THEME);

export const getSuperAdminThemeStyle = (settings: SuperAdminThemeSettings): React.CSSProperties => ({
  '--sa-bg': settings.background,
  '--sa-surface': settings.surface,
  '--sa-surface-muted': settings.surfaceMuted,
  '--sa-text': settings.text,
  '--sa-muted': settings.mutedText,
  '--sa-border': settings.border,
  '--sa-accent': settings.accent,
  '--sa-accent-contrast': settings.accentContrast,
  '--sa-radius': `${settings.radius}px`,
  '--sa-sidebar-bg': settings.sidebar === 'dark' ? '#0f172a' : settings.surface,
  '--sa-sidebar-text': settings.sidebar === 'dark' ? '#e2e8f0' : settings.text,
  '--sa-sidebar-muted': settings.sidebar === 'dark' ? '#94a3b8' : settings.mutedText,
  '--sa-sidebar-hover': settings.sidebar === 'dark' ? '#1e293b' : settings.surfaceMuted,
  ...densityVars[settings.density],
} as React.CSSProperties);

export const SuperAdminThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SuperAdminThemeSettings>(() => loadSuperAdminTheme());

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<SuperAdminThemeSettings>).detail;
      setSettings(normalizeSuperAdminTheme(detail || loadSuperAdminTheme()));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SUPER_ADMIN_THEME_STORAGE_KEY) {
        setSettings(loadSuperAdminTheme());
      }
    };

    window.addEventListener(SUPER_ADMIN_THEME_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SUPER_ADMIN_THEME_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const style = useMemo(() => getSuperAdminThemeStyle(settings), [settings]);

  return (
    <div className="super-admin-theme min-h-screen" style={style} data-super-admin-theme={settings.id}>
      <style>
        {`
          .super-admin-theme .bg-primary-600,
          .super-admin-theme .hover\\:bg-primary-700:hover {
            background-color: var(--sa-accent) !important;
            color: var(--sa-accent-contrast) !important;
          }
          .super-admin-theme .text-primary-600,
          .super-admin-theme .hover\\:text-primary-700:hover {
            color: var(--sa-accent) !important;
          }
          .super-admin-theme .border-primary-300 {
            border-color: var(--sa-accent) !important;
          }
          .super-admin-theme .focus-visible\\:ring-primary-500:focus-visible {
            --tw-ring-color: var(--sa-accent) !important;
          }
        `}
      </style>
      {children}
    </div>
  );
};
