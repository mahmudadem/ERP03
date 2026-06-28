import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, RotateCcw, Save, Palette, Wand2, Type, Layers, Settings2, Code } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { UnsavedChangesBanner } from '../../../components/shared/UnsavedChangesBanner';
import {
  DEFAULT_USER_APPEARANCE,
  normalizeUserAppearance,
  USER_APPEARANCE_PRESETS,
  UserAppearanceSettings,
  autoGenerateTheme,
  UserAppearancePalette,
} from '../../../theme/userAppearance';

const fieldClass = 'h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]';
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]';

const colorFieldsLight: Array<{ key: keyof UserAppearancePalette; label: string }> = [
  { key: 'bgPrimary', label: 'Primary surface' },
  { key: 'bgSecondary', label: 'Page background' },
  { key: 'bgTertiary', label: 'Muted surface' },
  { key: 'textPrimary', label: 'Primary text' },
  { key: 'textSecondary', label: 'Secondary text' },
  { key: 'textMuted', label: 'Muted text' },
  { key: 'border', label: 'Border' },
];

const colorFieldsDark: Array<{ key: keyof UserAppearancePalette; label: string }> = [
  { key: 'bgPrimary', label: 'Primary surface' },
  { key: 'bgSecondary', label: 'Page background' },
  { key: 'bgTertiary', label: 'Muted surface' },
  { key: 'textPrimary', label: 'Primary text' },
  { key: 'textSecondary', label: 'Secondary text' },
  { key: 'textMuted', label: 'Muted text' },
  { key: 'border', label: 'Border' },
];

const brandColorFields: Array<{ key: keyof UserAppearanceSettings; label: string }> = [
  { key: 'primary', label: 'Primary action' },
  { key: 'accent', label: 'Accent' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'danger', label: 'Danger' },
];

const PreviewCard = ({ title, value }: { title: string; value: string }) => (
  <Card className="p-4 shadow-sm border border-[var(--color-border)] flex flex-col items-center justify-center text-center h-24">
    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{title}</p>
    <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)] capitalize">{value}</p>
  </Card>
);

const AppearanceSettingsPage: React.FC = () => {
  const { t } = useTranslation('common');
  const {
    appearanceSettings,
    setAppearanceSettings,
    savePreferences,
    uiMode,
    setUiMode,
    sidebarMode,
    setSidebarMode,
    theme,
    setTheme,
    layoutMode,
    setLayoutMode,
  } = useUserPreferences();
  
  const [draft, setDraft] = useState<UserAppearanceSettings>(() => normalizeUserAppearance(appearanceSettings));
  
  const [widgetStyle, setWidgetStyle] = useState(() => {
    return localStorage.getItem('erp_topbar_widget_style') || '1';
  });

  React.useEffect(() => {
    const handleStyleChange = (e: any) => {
      if (e.detail?.style) {
        setWidgetStyle(e.detail.style);
      }
    };
    window.addEventListener('topbar-widget-style-changed', handleStyleChange);
    return () => window.removeEventListener('topbar-widget-style-changed', handleStyleChange);
  }, []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeColorTab, setActiveColorTab] = useState<'brand' | 'light' | 'dark'>('brand');
  const [magicColor, setMagicColor] = useState('#3b82f6');
  
  const serialized = useMemo(() => JSON.stringify(draft, null, 2), [draft]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(normalizeUserAppearance(appearanceSettings));
  }, [draft, appearanceSettings]);

  const applyDraft = (next: UserAppearanceSettings) => {
    const normalized = normalizeUserAppearance(next);
    setDraft(normalized);
    setAppearanceSettings(normalized);
    setMessage(null);
  };

  const updateRoot = <K extends keyof UserAppearanceSettings>(key: K, value: UserAppearanceSettings[K]) => {
    applyDraft({ ...draft, id: 'custom', name: 'Custom', [key]: value });
  };

  const updatePalette = (mode: 'light' | 'dark', key: keyof UserAppearancePalette, value: string) => {
    applyDraft({ ...draft, id: 'custom', name: 'Custom', [mode]: { ...draft[mode], [key]: value } });
  };

  const handleMagicGenerate = () => {
    const generated = autoGenerateTheme(magicColor, 'Magic Generated Theme');
    applyDraft({
      ...generated,
      radius: draft.radius,
      density: draft.density,
      fontFamily: draft.fontFamily,
      shadowIntensity: draft.shadowIntensity,
      sidebarSurface: draft.sidebarSurface,
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      setAppearanceSettings(draft);
      await savePreferences();
      setMessage(t('appearance.messages.saved', { defaultValue: 'Appearance preferences saved successfully.' }));
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage(error?.message || t('appearance.messages.saveFailed', { defaultValue: 'Could not save appearance preferences.' }));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    applyDraft(DEFAULT_USER_APPEARANCE);
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8 p-[var(--app-content-padding,1.5rem)] pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            {t('appearance.userPreferences', { defaultValue: 'User Preferences' })}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {t('appearance.title', { defaultValue: 'Appearance Lab' })}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-secondary)]">
            {t('appearance.subtitle', { defaultValue: 'Design your personal workspace. Choose from beautiful presets, generate an auto-theme, or fine-tune every detail.' })}
          </p>
        </div>
        {!hasChanges && (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={reset} leftIcon={<RotateCcw className="h-4 w-4" />}>
              {t('appearance.resetDefault', { defaultValue: 'Reset to Default' })}
            </Button>
            <Button onClick={save} isLoading={saving} leftIcon={<Save className="h-4 w-4" />}>
              {t('appearance.savePreferences', { defaultValue: 'Save Preferences' })}
            </Button>
          </div>
        )}
      </div>

      {message && (
        <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3 text-sm font-medium text-[var(--color-success)] shadow-sm animate-in fade-in slide-in-from-top-2">
          {message}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_400px]">
        
        {/* Left Column: Interactive Controls */}
        <div className="space-y-8">
          
          {/* AUTO THEME GENERATOR */}
          <Card className="p-[var(--app-panel-padding,1.25rem)] overflow-hidden relative border border-[var(--color-primary)]/30 shadow-sm bg-gradient-to-br from-[var(--color-bg-primary)] to-[var(--color-primary)]/5">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Wand2 className="w-32 h-32 text-[var(--color-primary)]" />
            </div>
            <div className="mb-4 flex items-center gap-2 relative z-10">
              <div className="p-2 bg-[var(--color-primary)]/10 rounded-lg">
                <Wand2 className="h-5 w-5 text-[var(--color-primary)]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                  {t('appearance.autoTheme.title', { defaultValue: 'Auto-Theme Generator' })}
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t('appearance.autoTheme.subtitle', { defaultValue: 'AI-powered color harmony' })}
                </p>
              </div>
            </div>
            <p className="mb-5 text-sm text-[var(--color-text-secondary)] relative z-10 max-w-md">
              {t('appearance.autoTheme.description', { defaultValue: 'Pick your core brand color. We will instantly compute balanced Light and Dark mode UI palettes.' })}
            </p>
            <div className="flex gap-3 relative z-10 items-end max-w-sm">
              <label className="flex-1">
                <span className={labelClass}>{t('appearance.autoTheme.baseColor', { defaultValue: 'Base Color' })}</span>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="h-10 w-14 rounded-md border border-[var(--color-border)] bg-transparent p-1 cursor-pointer shadow-sm"
                    value={magicColor}
                    onChange={event => setMagicColor(event.target.value)}
                  />
                  <input
                    className={fieldClass}
                    value={magicColor}
                    onChange={event => setMagicColor(event.target.value)}
                  />
                </div>
              </label>
              <Button onClick={handleMagicGenerate} className="shrink-0 h-10 px-6 shadow-sm">
                {t('appearance.autoTheme.generate', { defaultValue: 'Generate' })}
              </Button>
            </div>
          </Card>

          {/* PRESETS GRID */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-[var(--color-text-primary)]" />
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                {t('appearance.presets', { defaultValue: 'Curated Presets' })}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {USER_APPEARANCE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyDraft(preset)}
                  className={`group flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                    draft.id === preset.id 
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-md ring-1 ring-[var(--color-primary)]' 
                      : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)]/50 hover:shadow-sm'
                  }`}
                >
                  <div className="w-full flex justify-between items-center">
                    <span className="block font-semibold text-[var(--color-text-primary)]">{preset.name}</span>
                    <div className="flex overflow-hidden rounded border border-[var(--color-border)] shadow-sm h-5 w-12">
                      <div className="flex-1" style={{ background: preset.light.bgPrimary }} />
                      <div className="flex-1" style={{ background: preset.primary }} />
                      <div className="flex-1" style={{ background: preset.dark.bgPrimary }} />
                    </div>
                  </div>
                  <span className="block text-xs text-[var(--color-text-muted)] capitalize">{preset.fontFamily} • {preset.shadowIntensity}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TYPOGRAPHY & DEPTH */}
            <Card className="p-[var(--app-panel-padding,1.25rem)] shadow-sm">
              <div className="mb-5 flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
                <div className="p-1.5 bg-[var(--color-bg-tertiary)] rounded-md">
                  <Type className="h-4 w-4 text-[var(--color-text-primary)]" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                  {t('appearance.typographyDepth', { defaultValue: 'Typography & Depth' })}
                </h2>
              </div>
              <div className="space-y-4">
                <label>
                  <span className={labelClass}>{t('appearance.fontFamily', { defaultValue: 'Font Family' })}</span>
                  <select className={fieldClass} value={draft.fontFamily} onChange={event => updateRoot('fontFamily', event.target.value as any)}>
                    <option value="system">{t('appearance.fonts.system', { defaultValue: 'System Default' })}</option>
                    <option value="inter">Inter (Modern & Clean)</option>
                    <option value="roboto">Roboto (Classic UI)</option>
                    <option value="outfit">Outfit (Geometric & Bold)</option>
                    <option value="cairo">Cairo (Arabic & Modern)</option>
                    <option value="mono">Monospace (Technical)</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>{t('appearance.shadowIntensity', { defaultValue: 'Shadow Intensity' })}</span>
                  <select className={fieldClass} value={draft.shadowIntensity} onChange={event => updateRoot('shadowIntensity', event.target.value as any)}>
                    <option value="flat">{t('appearance.shadows.flat', { defaultValue: 'Flat (Minimalist, no shadows)' })}</option>
                    <option value="subtle">{t('appearance.shadows.subtle', { defaultValue: 'Subtle (Elegant depth)' })}</option>
                    <option value="pronounced">{t('appearance.shadows.pronounced', { defaultValue: 'Pronounced (Deep floating)' })}</option>
                    <option value="glass">{t('appearance.shadows.glass', { defaultValue: 'Glassmorphism (Soft glow)' })}</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>{t('appearance.cornerRadius', { radius: draft.radius, defaultValue: 'Corner Radius ({{radius}}px)' })}</span>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={draft.radius}
                    onChange={event => updateRoot('radius', Number(event.target.value))}
                    className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
                  />
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                    <span>{t('appearance.sharp', { defaultValue: 'Sharp' })}</span>
                    <span>{t('appearance.rounded', { defaultValue: 'Rounded' })}</span>
                  </div>
                </label>
              </div>
            </Card>

            {/* LAYOUT & BEHAVIOR */}
            <Card className="p-[var(--app-panel-padding,1.25rem)] shadow-sm">
              <div className="mb-5 flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
                <div className="p-1.5 bg-[var(--color-bg-tertiary)] rounded-md">
                  <Layers className="h-4 w-4 text-[var(--color-text-primary)]" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">{t('settings.appearance.layoutBehavior', 'Layout & Behavior')}</h2>
              </div>
              <div className="space-y-4">
                <label>
                  <span className={labelClass}>{t('settings.appearance.layoutMode', 'Layout Mode')}</span>
                  <select className={fieldClass} value={layoutMode} onChange={event => setLayoutMode(event.target.value as any)}>
                    <option value="legacy">{t('settings.appearance.layoutStandard', 'Standard Layout')}</option>
                    <option value="compact">{t('settings.appearance.layoutCompact', 'Compact Layout (Apex)')}</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>{t('settings.appearance.themeMode', 'Theme Mode')}</span>
                  <select className={fieldClass} value={theme} onChange={event => setTheme(event.target.value as any)}>
                    <option value="light">{t('settings.appearance.themeLight', 'Light Mode')}</option>
                    <option value="dark">{t('settings.appearance.themeDark', 'Dark Mode')}</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>{t('settings.appearance.uiDensity', 'UI Density')}</span>
                  <select className={fieldClass} value={draft.density} onChange={event => updateRoot('density', event.target.value as any)}>
                    <option value="compact">{t('settings.appearance.densityCompact', 'Compact (High info density)')}</option>
                    <option value="comfortable">{t('settings.appearance.densityComfortable', 'Comfortable (Balanced)')}</option>
                    <option value="spacious">{t('settings.appearance.densitySpacious', 'Spacious (Touch-friendly)')}</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>{t('settings.appearance.sidebarNav', 'Sidebar Navigation')}</span>
                  <select className={fieldClass} value={sidebarMode} onChange={event => setSidebarMode(event.target.value as any)}>
                    <option value="classic">{t('settings.appearance.sidebarAccordion', 'Accordion (Expand inline)')}</option>
                    <option value="submenus">{t('settings.appearance.sidebarFlyout', 'Flyout (Hover menus)')}</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>{t('settings.appearance.sidebarSurface', 'Sidebar Surface')}</span>
                  <select className={fieldClass} value={draft.sidebarSurface} onChange={event => updateRoot('sidebarSurface', event.target.value as any)}>
                    <option value="default">{t('settings.appearance.surfaceDefault', 'Default (Matches background)')}</option>
                    <option value="contrast">{t('settings.appearance.surfaceContrast', 'Contrast (Brand colored)')}</option>
                  </select>
                </label>
                <label>
                  <span className={labelClass}>{t('settings.appearance.widgetStyle', 'TopBar Widget Style')}</span>
                  <select
                    className={fieldClass}
                    value={widgetStyle}
                    onChange={event => {
                      const val = event.target.value;
                      setWidgetStyle(val);
                      localStorage.setItem('erp_topbar_widget_style', val);
                      window.dispatchEvent(new CustomEvent('topbar-widget-style-changed', { detail: { style: val } }));
                    }}
                  >
                    <option value="1">1: العرض المزدوج الرأسي المتكدس (Double Decker)</option>
                    <option value="2">2: النظام الهندسي البرمجي (Tech Terminal)</option>
                    <option value="3">3: خطوط الفاصل العمودي (Pipeline Separators)</option>
                    <option value="5">5: الكبسولة الفقاعية الموحدة (Bubble Pill)</option>
                    <option value="10">10: الأشكال الهندسية المائلة (Slanted Angles)</option>
                    <option value="11">11: الإطارات المنقطة التقنية (Dotted Matrix)</option>
                    <option value="16">16: بطاقة الكوبون المثقوبة (Coupon Tag)</option>
                    <option value="17">17: المخطط الهندسي المتقطع (Dashed Blueprint)</option>
                    <option value="18">18: مؤشرات النقاط الملونة (State Indicator)</option>
                  </select>
                </label>
              </div>
            </Card>
          </div>

          {/* ADVANCED COLORS (Collapsible) */}
          <details className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm open:pb-5">
            <summary className="flex cursor-pointer items-center justify-between p-5 font-bold text-[var(--color-text-primary)] marker:content-none focus:outline-none">
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-[var(--color-text-muted)]" />
                <span>{t('appearance.advancedColors', { defaultValue: 'Advanced Colors' })}</span>
              </div>
              <span className="text-[var(--color-text-muted)] transition-transform group-open:rotate-180">▼</span>
            </summary>
            
            <div className="px-5 border-t border-[var(--color-border)] pt-5">
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t('appearance.advancedColorsSubtitle', { defaultValue: 'Absolute control over every token' })}
                </p>
                <div className="flex gap-1 bg-[var(--color-bg-tertiary)] p-1 rounded-lg">
                  {['brand', 'light', 'dark'].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveColorTab(tab as any)}
                      className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${activeColorTab === tab ? 'bg-[var(--color-bg-primary)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                      {t(`appearance.colorTabs.${tab}`, { defaultValue: tab })}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {activeColorTab === 'brand' && brandColorFields.map(field => (
                  <label key={field.key} className="flex flex-col">
                    <span className={labelClass}>{t(`appearance.colors.${String(field.key)}`, { defaultValue: field.label })}</span>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        className="h-10 w-14 rounded-md border border-[var(--color-border)] bg-transparent p-1 cursor-pointer shadow-sm"
                        value={String(draft[field.key as keyof UserAppearanceSettings])}
                        onChange={event => updateRoot(field.key as any, event.target.value as any)}
                      />
                      <input
                        className={`${fieldClass} font-mono uppercase`}
                        value={String(draft[field.key as keyof UserAppearanceSettings])}
                        onChange={event => updateRoot(field.key as any, event.target.value as any)}
                      />
                    </div>
                  </label>
                ))}

                {activeColorTab === 'light' && colorFieldsLight.map(field => (
                  <label key={field.key} className="flex flex-col">
                    <span className={labelClass}>{t(`appearance.colors.${String(field.key)}`, { defaultValue: field.label })}</span>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        className="h-10 w-14 rounded-md border border-[var(--color-border)] bg-transparent p-1 cursor-pointer shadow-sm"
                        value={String(draft.light[field.key])}
                        onChange={event => updatePalette('light', field.key, event.target.value)}
                      />
                      <input
                        className={`${fieldClass} font-mono uppercase`}
                        value={String(draft.light[field.key])}
                        onChange={event => updatePalette('light', field.key, event.target.value)}
                      />
                    </div>
                  </label>
                ))}

                {activeColorTab === 'dark' && colorFieldsDark.map(field => (
                  <label key={field.key} className="flex flex-col">
                    <span className={labelClass}>{t(`appearance.colors.${String(field.key)}`, { defaultValue: field.label })}</span>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        className="h-10 w-14 rounded-md border border-[var(--color-border)] bg-transparent p-1 cursor-pointer shadow-sm"
                        value={String(draft.dark[field.key])}
                        onChange={event => updatePalette('dark', field.key, event.target.value)}
                      />
                      <input
                        className={`${fieldClass} font-mono uppercase`}
                        value={String(draft.dark[field.key])}
                        onChange={event => updatePalette('dark', field.key, event.target.value)}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </details>

        </div>

        {/* Right Column: Live Preview (Sticky) */}
        <div className="xl:sticky xl:top-6 space-y-6 self-start">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 px-1">
            {t('appearance.preview.title', { defaultValue: 'Live Preview' })}
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <PreviewCard title={t('appearance.preview.font', { defaultValue: 'Font' })} value={draft.fontFamily} />
            <PreviewCard title={t('appearance.preview.shadows', { defaultValue: 'Shadows' })} value={draft.shadowIntensity} />
          </div>

          <Card className="p-[var(--app-panel-padding,1.25rem)] shadow-sm border border-[var(--color-border)]">
            <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                {t('appearance.preview.uiComponents', { defaultValue: 'UI Components' })}
              </h3>
              <Button size="sm">{t('appearance.preview.action', { defaultValue: 'Action' })}</Button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                  {t('appearance.preview.badges', { defaultValue: 'Badges' })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 px-2.5 py-1 text-xs font-bold text-[var(--color-success)]">{t('appearance.preview.approved', { defaultValue: 'Approved' })}</span>
                  <span className="rounded bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 px-2.5 py-1 text-xs font-bold text-[var(--color-warning)]">{t('appearance.preview.pending', { defaultValue: 'Pending' })}</span>
                  <span className="rounded bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 px-2.5 py-1 text-xs font-bold text-[var(--color-danger)]">{t('appearance.preview.failed', { defaultValue: 'Failed' })}</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                  {t('appearance.preview.formInputs', { defaultValue: 'Form Inputs' })}
                </p>
                <div className="space-y-3">
                  <input className={fieldClass} value={t('appearance.preview.focusMe', { defaultValue: 'Focus me' })} readOnly />
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <input type="checkbox" className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]" defaultChecked /> {t('appearance.preview.active', { defaultValue: 'Active' })}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <input type="radio" className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]" defaultChecked /> {t('appearance.preview.option', { defaultValue: 'Option' })}
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm">
              <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
                <thead className="bg-[var(--color-bg-tertiary)]">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{t('appearance.preview.doc', { defaultValue: 'Doc' })}</th>
                    <th className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{t('appearance.preview.status', { defaultValue: 'Status' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  <tr className="hover:bg-[var(--color-bg-tertiary)]/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">INV-001</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{t('appearance.preview.draft', { defaultValue: 'Draft' })}</td>
                  </tr>
                  <tr className="hover:bg-[var(--color-bg-tertiary)]/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">INV-002</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{t('appearance.preview.paid', { defaultValue: 'Paid' })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-[var(--app-panel-padding,1.25rem)] shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Code className="h-4 w-4 text-[var(--color-text-muted)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                {t('appearance.jsonExport', { defaultValue: 'JSON Export' })}
              </h2>
            </div>
            <textarea
              className="h-40 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-4 font-mono text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] shadow-inner resize-none"
              value={serialized}
              readOnly
              spellCheck={false}
            />
          </Card>
        </div>
      </div>
      <UnsavedChangesBanner
        hasChanges={hasChanges}
        onSave={save}
        onDiscard={() => applyDraft(appearanceSettings)}
        saving={saving}
      />
    </div>
  );
};

export default AppearanceSettingsPage;
