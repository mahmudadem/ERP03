import React from 'react';

export type UserAppearanceDensity = 'compact' | 'comfortable' | 'spacious';

export interface UserAppearanceSettings {
  id: string;
  name: string;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  radius: number;
  density: UserAppearanceDensity;
  sidebarSurface: 'default' | 'contrast';
}

export const USER_APPEARANCE_STORAGE_KEY = 'erp_user_appearance_settings';

export const USER_APPEARANCE_PRESETS: UserAppearanceSettings[] = [
  {
    id: 'erp-default',
    name: 'ERP Default',
    bgPrimary: '#ffffff',
    bgSecondary: '#f9fafb',
    bgTertiary: '#f3f4f6',
    textPrimary: '#111827',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    border: '#e5e7eb',
    primary: '#3b82f6',
    accent: '#d946ef',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    radius: 12,
    density: 'comfortable',
    sidebarSurface: 'default',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    bgPrimary: '#ffffff',
    bgSecondary: '#f4f7f6',
    bgTertiary: '#eaf1ef',
    textPrimary: '#10231f',
    textSecondary: '#48625b',
    textMuted: '#71837e',
    border: '#d6e2de',
    primary: '#0f766e',
    accent: '#2563eb',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    radius: 8,
    density: 'compact',
    sidebarSurface: 'contrast',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    bgPrimary: '#1f2937',
    bgSecondary: '#111827',
    bgTertiary: '#0f172a',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    border: '#334155',
    primary: '#38bdf8',
    accent: '#a78bfa',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    radius: 10,
    density: 'comfortable',
    sidebarSurface: 'default',
  },
  {
    id: 'executive',
    name: 'Executive',
    bgPrimary: '#ffffff',
    bgSecondary: '#f6f5f2',
    bgTertiary: '#ece8df',
    textPrimary: '#1f2937',
    textSecondary: '#57534e',
    textMuted: '#78716c',
    border: '#ded8cc',
    primary: '#7c3aed',
    accent: '#0f766e',
    success: '#16a34a',
    warning: '#ca8a04',
    danger: '#dc2626',
    radius: 14,
    density: 'spacious',
    sidebarSurface: 'default',
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    bgPrimary: '#ffffff',
    bgSecondary: '#ffffff',
    bgTertiary: '#f3f4f6',
    textPrimary: '#000000',
    textSecondary: '#1f2937',
    textMuted: '#374151',
    border: '#111827',
    primary: '#000000',
    accent: '#2563eb',
    success: '#166534',
    warning: '#92400e',
    danger: '#991b1b',
    radius: 4,
    density: 'compact',
    sidebarSurface: 'contrast',
  },
];

export const DEFAULT_USER_APPEARANCE = USER_APPEARANCE_PRESETS[0];

const densityVars: Record<UserAppearanceDensity, Record<string, string>> = {
  compact: {
    '--app-content-padding': '1rem',
    '--app-panel-padding': '1rem',
    '--app-row-padding-y': '0.5rem',
  },
  comfortable: {
    '--app-content-padding': '1.5rem',
    '--app-panel-padding': '1.25rem',
    '--app-row-padding-y': '0.75rem',
  },
  spacious: {
    '--app-content-padding': '2rem',
    '--app-panel-padding': '1.5rem',
    '--app-row-padding-y': '1rem',
  },
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map(ch => ch + ch).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return '0, 0, 0';
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
};

export const normalizeUserAppearance = (input?: Partial<UserAppearanceSettings> | null): UserAppearanceSettings => ({
  ...DEFAULT_USER_APPEARANCE,
  ...(input || {}),
  id: input?.id || DEFAULT_USER_APPEARANCE.id,
  name: input?.name || DEFAULT_USER_APPEARANCE.name,
});

export const loadLocalUserAppearance = (): UserAppearanceSettings => {
  try {
    const raw = window.localStorage.getItem(USER_APPEARANCE_STORAGE_KEY);
    return normalizeUserAppearance(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_USER_APPEARANCE;
  }
};

export const applyUserAppearanceToDocument = (settings: UserAppearanceSettings) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars: Record<string, string> = {
    '--color-bg-primary': settings.bgPrimary,
    '--color-bg-primary-rgb': hexToRgb(settings.bgPrimary),
    '--color-bg-secondary': settings.bgSecondary,
    '--color-bg-secondary-rgb': hexToRgb(settings.bgSecondary),
    '--color-bg-tertiary': settings.bgTertiary,
    '--color-bg-tertiary-rgb': hexToRgb(settings.bgTertiary),
    '--color-text-primary': settings.textPrimary,
    '--color-text-secondary': settings.textSecondary,
    '--color-text-muted': settings.textMuted,
    '--color-border': settings.border,
    '--color-border-light': settings.bgTertiary,
    '--color-primary': settings.primary,
    '--color-primary-hover': settings.primary,
    '--color-accent': settings.accent,
    '--color-accent-hover': settings.accent,
    '--color-success': settings.success,
    '--color-warning': settings.warning,
    '--color-danger': settings.danger,
    '--radius-sm': `${Math.max(2, settings.radius - 6)}px`,
    '--radius-md': `${Math.max(4, settings.radius - 4)}px`,
    '--radius-lg': `${settings.radius}px`,
    '--radius-xl': `${settings.radius + 4}px`,
    '--app-sidebar-surface': settings.sidebarSurface === 'contrast' ? settings.primary : settings.bgPrimary,
    '--app-sidebar-text': settings.sidebarSurface === 'contrast' ? '#ffffff' : settings.textPrimary,
    '--app-sidebar-muted': settings.sidebarSurface === 'contrast' ? 'rgba(255,255,255,0.7)' : settings.textMuted,
    ...densityVars[settings.density],
  };

  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  window.localStorage.setItem(USER_APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
};

export const userAppearanceStyleTag = React.createElement('style', null, `
      .bg-primary-600,
      .hover\\:bg-primary-700:hover,
      .bg-primary,
      .hover\\:bg-primary:hover {
        background-color: var(--color-primary) !important;
      }
      .text-primary-600,
      .text-primary-700,
      .hover\\:text-primary-700:hover {
        color: var(--color-primary) !important;
      }
      .border-primary-300,
      .focus\\:border-primary-500:focus {
        border-color: var(--color-primary) !important;
      }
      .focus-visible\\:ring-primary-500:focus-visible,
      .focus\\:ring-primary-500:focus {
        --tw-ring-color: var(--color-primary) !important;
      }
      .shadow-primary-500\\/20 {
        --tw-shadow-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
      }
`);
