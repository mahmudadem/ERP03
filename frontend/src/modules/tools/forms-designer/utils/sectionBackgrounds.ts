import { SectionType } from '../types';

export const SECTION_BACKGROUND_SWATCHES = [
  { label: 'White', value: '#ffffff' },
  { label: 'Soft Gray', value: '#f8fafc' },
  { label: 'Sky', value: '#eff6ff' },
  { label: 'Mint', value: '#ecfdf5' },
  { label: 'Amber', value: '#fffbeb' },
  { label: 'Rose', value: '#fff1f2' },
] as const;

const LEGACY_SECTION_BACKGROUNDS: Record<string, string> = {
  white: '#ffffff',
  muted: '#f8fafc',
  transparent: 'transparent',
};

export const DEFAULT_SECTION_BACKGROUNDS: Record<SectionType, string> = {
  HEADER: '#ffffff',
  BODY: '#ffffff',
  EXTRA: '#ffffff',
  FOOTER: '#ffffff',
  ACTIONS: '#f8fafc',
};

export const getDefaultSectionBackground = (sectionKey: string): string => {
  const normalizedKey = String(sectionKey || '').toUpperCase() as SectionType;
  return DEFAULT_SECTION_BACKGROUNDS[normalizedKey] || '#ffffff';
};

export const normalizeSectionBackgroundValue = (
  value: string | null | undefined,
  sectionKey: string
): string => {
  const raw = String(value || '').trim();
  if (!raw) {
    return getDefaultSectionBackground(sectionKey);
  }

  const legacyValue = LEGACY_SECTION_BACKGROUNDS[raw.toLowerCase()];
  if (legacyValue) {
    return legacyValue;
  }

  return raw;
};

export const getColorInputValue = (value: string | null | undefined, sectionKey: string): string => {
  const normalized = normalizeSectionBackgroundValue(value, sectionKey);
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized;
  }
  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return getDefaultSectionBackground(sectionKey);
};
