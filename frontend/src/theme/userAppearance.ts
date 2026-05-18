import React from 'react';

export type UserAppearanceDensity = 'compact' | 'comfortable' | 'spacious';
export type UserAppearanceShadow = 'flat' | 'subtle' | 'pronounced' | 'glass';
export type UserAppearanceFont = 'system' | 'inter' | 'roboto' | 'outfit' | 'mono' | 'cairo';

export interface UserAppearancePalette {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
}

export interface UserAppearanceSettings {
  id: string;
  name: string;
  
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;

  light: UserAppearancePalette;
  dark: UserAppearancePalette;

  radius: number;
  density: UserAppearanceDensity;
  sidebarSurface: 'default' | 'contrast';
  shadowIntensity: UserAppearanceShadow;
  fontFamily: UserAppearanceFont;
}

export const USER_APPEARANCE_STORAGE_KEY = 'erp_user_appearance_settings';

// Helper to calculate hex color luminance and adjust it. 
// A robust auto-generator would use HSL, but we'll use predefined harmonious palettes based on the brand.
export const autoGenerateTheme = (brandHex: string, name: string = 'Custom Generated'): UserAppearanceSettings => {
  return {
    id: `auto-${brandHex.replace('#', '')}`,
    name,
    primary: brandHex,
    accent: brandHex, // Can be shifted in a more complex generator
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    
    light: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f8fafc',
      bgTertiary: '#f1f5f9',
      textPrimary: '#0f172a',
      textSecondary: '#334155',
      textMuted: '#64748b',
      border: '#e2e8f0',
    },
    
    dark: {
      bgPrimary: '#0f172a',
      bgSecondary: '#020617',
      bgTertiary: '#1e293b',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#334155',
    },
    
    radius: 12,
    density: 'comfortable',
    sidebarSurface: 'default',
    shadowIntensity: 'subtle',
    fontFamily: 'inter',
  };
};

export const USER_APPEARANCE_PRESETS: UserAppearanceSettings[] = [
  {
    id: 'erp-default',
    name: 'ERP Default',
    primary: '#005aeb',
    accent: '#d946ef',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    light: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f9fafb',
      bgTertiary: '#f3f4f6',
      textPrimary: '#111827',
      textSecondary: '#4b5563',
      textMuted: '#050505',
      border: '#e5e7eb',
    },
    dark: {
      bgPrimary: '#111827',
      bgSecondary: '#030712',
      bgTertiary: '#1f2937',
      textPrimary: '#f9fafb',
      textSecondary: '#d1d5db',
      textMuted: '#f1f6fe',
      border: '#374151',
    },
    radius: 12,
    density: 'comfortable',
    sidebarSurface: 'default',
    shadowIntensity: 'subtle',
    fontFamily: 'inter',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    primary: '#0f766e',
    accent: '#2563eb',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    light: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f4f7f6',
      bgTertiary: '#eaf1ef',
      textPrimary: '#10231f',
      textSecondary: '#48625b',
      textMuted: '#71837e',
      border: '#d6e2de',
    },
    dark: {
      bgPrimary: '#10231f',
      bgSecondary: '#081210',
      bgTertiary: '#16312c',
      textPrimary: '#f4f7f6',
      textSecondary: '#b9cbc6',
      textMuted: '#71837e',
      border: '#2a4d46',
    },
    radius: 8,
    density: 'compact',
    sidebarSurface: 'contrast',
    shadowIntensity: 'flat',
    fontFamily: 'roboto',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    primary: '#38bdf8',
    accent: '#a78bfa',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    light: {
      bgPrimary: '#1f2937',
      bgSecondary: '#111827',
      bgTertiary: '#0f172a',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#334155',
    },
    dark: {
      bgPrimary: '#1f2937',
      bgSecondary: '#111827',
      bgTertiary: '#0f172a',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#334155',
    },
    radius: 10,
    density: 'comfortable',
    sidebarSurface: 'default',
    shadowIntensity: 'subtle',
    fontFamily: 'system',
  },
  {
    id: 'executive',
    name: 'Executive',
    primary: '#7c3aed',
    accent: '#0f766e',
    success: '#16a34a',
    warning: '#ca8a04',
    danger: '#dc2626',
    light: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f6f5f2',
      bgTertiary: '#ece8df',
      textPrimary: '#1f2937',
      textSecondary: '#57534e',
      textMuted: '#78716c',
      border: '#ded8cc',
    },
    dark: {
      bgPrimary: '#1a1816',
      bgSecondary: '#0f0e0c',
      bgTertiary: '#24211e',
      textPrimary: '#f6f5f2',
      textSecondary: '#dcd8cf',
      textMuted: '#9b9485',
      border: '#3b3632',
    },
    radius: 14,
    density: 'spacious',
    sidebarSurface: 'default',
    shadowIntensity: 'pronounced',
    fontFamily: 'outfit',
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    primary: '#000000',
    accent: '#2563eb',
    success: '#166534',
    warning: '#92400e',
    danger: '#991b1b',
    light: {
      bgPrimary: '#ffffff',
      bgSecondary: '#ffffff',
      bgTertiary: '#f3f4f6',
      textPrimary: '#000000',
      textSecondary: '#1f2937',
      textMuted: '#374151',
      border: '#111827',
    },
    dark: {
      bgPrimary: '#000000',
      bgSecondary: '#000000',
      bgTertiary: '#111827',
      textPrimary: '#ffffff',
      textSecondary: '#e5e7eb',
      textMuted: '#9ca3af',
      border: '#ffffff',
    },
    radius: 4,
    density: 'compact',
    sidebarSurface: 'contrast',
    shadowIntensity: 'flat',
    fontFamily: 'system',
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    primary: '#0ea5e9',
    accent: '#06b6d4',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    light: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f0f9ff',
      bgTertiary: '#e0f2fe',
      textPrimary: '#0c4a6e',
      textSecondary: '#0284c7',
      textMuted: '#38bdf8',
      border: '#bae6fd',
    },
    dark: {
      bgPrimary: '#082f49',
      bgSecondary: '#0c4a6e',
      bgTertiary: '#075985',
      textPrimary: '#f0f9ff',
      textSecondary: '#bae6fd',
      textMuted: '#7dd3fc',
      border: '#0369a1',
    },
    radius: 16,
    density: 'comfortable',
    sidebarSurface: 'contrast',
    shadowIntensity: 'glass',
    fontFamily: 'outfit',
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

const fontVars: Record<UserAppearanceFont, string> = {
  system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  inter: '"Inter", "Cairo", ui-sans-serif, system-ui, sans-serif',
  roboto: '"Roboto", "Cairo", ui-sans-serif, system-ui, sans-serif',
  outfit: '"Outfit", "Cairo", ui-sans-serif, system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  cairo: '"Cairo", "Inter", ui-sans-serif, system-ui, sans-serif',
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

export const normalizeUserAppearance = (input?: any | null): UserAppearanceSettings => {
  if (!input) return DEFAULT_USER_APPEARANCE;
  
  // Migration path: if old flat format is found, wrap into light and clone default dark
  if (input.bgPrimary && !input.light) {
    return {
      ...DEFAULT_USER_APPEARANCE,
      id: input.id || 'migrated',
      name: input.name || 'Migrated Custom',
      primary: input.primary || DEFAULT_USER_APPEARANCE.primary,
      accent: input.accent || DEFAULT_USER_APPEARANCE.accent,
      success: input.success || DEFAULT_USER_APPEARANCE.success,
      warning: input.warning || DEFAULT_USER_APPEARANCE.warning,
      danger: input.danger || DEFAULT_USER_APPEARANCE.danger,
      light: {
        bgPrimary: input.bgPrimary,
        bgSecondary: input.bgSecondary || DEFAULT_USER_APPEARANCE.light.bgSecondary,
        bgTertiary: input.bgTertiary || DEFAULT_USER_APPEARANCE.light.bgTertiary,
        textPrimary: input.textPrimary || DEFAULT_USER_APPEARANCE.light.textPrimary,
        textSecondary: input.textSecondary || DEFAULT_USER_APPEARANCE.light.textSecondary,
        textMuted: input.textMuted || DEFAULT_USER_APPEARANCE.light.textMuted,
        border: input.border || DEFAULT_USER_APPEARANCE.light.border,
      },
      dark: DEFAULT_USER_APPEARANCE.dark,
      radius: input.radius || DEFAULT_USER_APPEARANCE.radius,
      density: input.density || DEFAULT_USER_APPEARANCE.density,
      sidebarSurface: input.sidebarSurface || DEFAULT_USER_APPEARANCE.sidebarSurface,
      shadowIntensity: 'subtle',
      fontFamily: 'inter',
    };
  }

  return {
    ...DEFAULT_USER_APPEARANCE,
    ...input,
    light: { ...DEFAULT_USER_APPEARANCE.light, ...(input.light || {}) },
    dark: { ...DEFAULT_USER_APPEARANCE.dark, ...(input.dark || {}) },
  };
};

export const loadLocalUserAppearance = (): UserAppearanceSettings => {
  try {
    const raw = window.localStorage.getItem(USER_APPEARANCE_STORAGE_KEY);
    return normalizeUserAppearance(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_USER_APPEARANCE;
  }
};

export const applyUserAppearanceToDocument = (settings: UserAppearanceSettings, themeMode: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  
  const palette = themeMode === 'dark' ? settings.dark : settings.light;

  const vars: Record<string, string> = {
    '--color-bg-primary': palette.bgPrimary,
    '--color-bg-primary-rgb': hexToRgb(palette.bgPrimary),
    '--color-bg-secondary': palette.bgSecondary,
    '--color-bg-secondary-rgb': hexToRgb(palette.bgSecondary),
    '--color-bg-tertiary': palette.bgTertiary,
    '--color-bg-tertiary-rgb': hexToRgb(palette.bgTertiary),
    '--color-text-primary': palette.textPrimary,
    '--color-text-secondary': palette.textSecondary,
    '--color-text-muted': palette.textMuted,
    '--color-border': palette.border,
    '--color-border-light': palette.bgTertiary,
    
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
    
    '--app-sidebar-surface': settings.sidebarSurface === 'contrast' ? settings.primary : palette.bgPrimary,
    '--app-sidebar-text': settings.sidebarSurface === 'contrast' ? '#ffffff' : palette.textPrimary,
    '--app-sidebar-muted': settings.sidebarSurface === 'contrast' ? 'rgba(255,255,255,0.7)' : palette.textMuted,
    
    '--app-font-family': fontVars[settings.fontFamily],
    '--font-sans': fontVars[settings.fontFamily],
    
    ...densityVars[settings.density],
  };

  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  
  // Handle Shadow Intensity by setting a global body class or vars
  if (settings.shadowIntensity === 'flat') {
    root.style.setProperty('--tw-shadow', '0 0 #0000');
    root.style.setProperty('--tw-shadow-colored', '0 0 #0000');
  } else if (settings.shadowIntensity === 'pronounced') {
    root.style.setProperty('--tw-shadow', '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)');
    root.style.setProperty('--tw-shadow-colored', '0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color)');
  } else if (settings.shadowIntensity === 'glass') {
    root.style.setProperty('--tw-shadow', '0 8px 32px 0 rgba(31, 38, 135, 0.07)');
    root.style.setProperty('--tw-shadow-colored', '0 8px 32px 0 var(--tw-shadow-color)');
  } else {
    // subtle / default
    root.style.removeProperty('--tw-shadow');
    root.style.removeProperty('--tw-shadow-colored');
  }

  window.localStorage.setItem(USER_APPEARANCE_STORAGE_KEY, JSON.stringify(settings));
};

export const userAppearanceStyleTag = React.createElement('style', null, `
      body {
        font-family: var(--app-font-family, ui-sans-serif, system-ui, sans-serif) !important;
      }
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
