import React, { useMemo, useState } from 'react';
import { Check, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import {
  DEFAULT_USER_APPEARANCE,
  normalizeUserAppearance,
  USER_APPEARANCE_PRESETS,
  UserAppearanceSettings,
} from '../../../theme/userAppearance';

const fieldClass = 'h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 text-sm text-[var(--color-text-primary)]';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]';

const colorFields: Array<{ key: keyof UserAppearanceSettings; label: string }> = [
  { key: 'bgPrimary', label: 'Primary surface' },
  { key: 'bgSecondary', label: 'Page background' },
  { key: 'bgTertiary', label: 'Muted surface' },
  { key: 'textPrimary', label: 'Primary text' },
  { key: 'textSecondary', label: 'Secondary text' },
  { key: 'textMuted', label: 'Muted text' },
  { key: 'border', label: 'Border' },
  { key: 'primary', label: 'Primary action' },
  { key: 'accent', label: 'Accent' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'danger', label: 'Danger' },
];

const PreviewCard = ({ title, value }: { title: string; value: string }) => (
  <Card className="p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</p>
    <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
  </Card>
);

const AppearanceSettingsPage: React.FC = () => {
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
  } = useUserPreferences();
  const [draft, setDraft] = useState<UserAppearanceSettings>(() => normalizeUserAppearance(appearanceSettings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const serialized = useMemo(() => JSON.stringify(draft, null, 2), [draft]);

  const applyDraft = (next: UserAppearanceSettings) => {
    const normalized = normalizeUserAppearance(next);
    setDraft(normalized);
    setAppearanceSettings(normalized);
    setMessage(null);
  };

  const update = <K extends keyof UserAppearanceSettings>(key: K, value: UserAppearanceSettings[K]) => {
    applyDraft({ ...draft, id: 'custom', name: 'Custom', [key]: value });
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      setAppearanceSettings(draft);
      await savePreferences();
      setMessage('Appearance preferences saved.');
    } catch (error: any) {
      setMessage(error?.message || 'Could not save appearance preferences.');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    applyDraft(DEFAULT_USER_APPEARANCE);
  };

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 p-[var(--app-content-padding,1.5rem)]">
      <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">User preferences</div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Appearance</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-secondary)]">
            Change how the main application looks for your user account. This uses the same concept tested in Super Admin, but it is saved as your personal preference.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={reset} leftIcon={<RotateCcw className="h-4 w-4" />}>Reset</Button>
          <Button onClick={save} isLoading={saving} leftIcon={<Save className="h-4 w-4" />}>Save Preferences</Button>
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <Card className="p-[var(--app-panel-padding,1.25rem)]">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[var(--color-text-muted)]" />
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Presets</h2>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {USER_APPEARANCE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyDraft(preset)}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-left text-sm hover:border-[var(--color-primary)]"
                >
                  <span className="font-medium text-[var(--color-text-primary)]">{preset.name}</span>
                  <span className="flex items-center gap-1">
                    <span className="h-4 w-4 rounded-full border border-white/60" style={{ background: preset.primary }} />
                    {draft.id === preset.id && <Check className="h-4 w-4 text-[var(--color-primary)]" />}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-[var(--app-panel-padding,1.25rem)]">
            <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">Core Preferences</h2>
            <div className="grid grid-cols-1 gap-4">
              <label>
                <span className={labelClass}>Theme Mode</span>
                <select className={fieldClass} value={theme} onChange={event => setTheme(event.target.value as any)}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label>
                <span className={labelClass}>Application Layout</span>
                <select className={fieldClass} value={uiMode} onChange={event => setUiMode(event.target.value as any)}>
                  <option value="classic">Web Mode</option>
                  <option value="windows">Windows Mode</option>
                </select>
              </label>
              <label>
                <span className={labelClass}>Sidebar Navigation</span>
                <select className={fieldClass} value={sidebarMode} onChange={event => setSidebarMode(event.target.value as any)}>
                  <option value="classic">Accordion</option>
                  <option value="submenus">Flyout Sub-menus</option>
                </select>
              </label>
            </div>
          </Card>

          <Card className="p-[var(--app-panel-padding,1.25rem)]">
            <h2 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">Visual Controls</h2>
            <div className="grid grid-cols-1 gap-4">
              {colorFields.map(field => (
                <label key={field.key}>
                  <span className={labelClass}>{field.label}</span>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className="h-10 w-12 rounded-md border border-[var(--color-border)] bg-transparent p-1"
                      value={String(draft[field.key])}
                      onChange={event => update(field.key, event.target.value as any)}
                    />
                    <input
                      className={fieldClass}
                      value={String(draft[field.key])}
                      onChange={event => update(field.key, event.target.value as any)}
                    />
                  </div>
                </label>
              ))}

              <label>
                <span className={labelClass}>Radius</span>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={draft.radius}
                  onChange={event => update('radius', Number(event.target.value))}
                  className="w-full"
                />
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">{draft.radius}px</div>
              </label>

              <label>
                <span className={labelClass}>Density</span>
                <select className={fieldClass} value={draft.density} onChange={event => update('density', event.target.value as any)}>
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                  <option value="spacious">Spacious</option>
                </select>
              </label>

              <label>
                <span className={labelClass}>Sidebar Surface</span>
                <select className={fieldClass} value={draft.sidebarSurface} onChange={event => update('sidebarSurface', event.target.value as any)}>
                  <option value="default">Default</option>
                  <option value="contrast">Contrast</option>
                </select>
              </label>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PreviewCard title="Preset" value={draft.name} />
            <PreviewCard title="Density" value={draft.density} />
            <PreviewCard title="Radius" value={`${draft.radius}px`} />
          </div>

          <Card className="p-[var(--app-panel-padding,1.25rem)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Preview</h2>
                <p className="text-sm text-[var(--color-text-secondary)]">Representative controls from the main app visual system.</p>
              </div>
              <Button>Primary Action</Button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Voucher Workbench</h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Tables, selectors, cards, and action buttons inherit the selected tokens.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded bg-[var(--color-success-bg)] px-2 py-1 text-xs font-medium text-[var(--color-success)]">Posted</span>
                  <span className="rounded bg-[var(--color-warning-bg)] px-2 py-1 text-xs font-medium text-[var(--color-warning)]">Draft</span>
                  <span className="rounded bg-[var(--color-danger-bg)] px-2 py-1 text-xs font-medium text-[var(--color-danger)]">Blocked</span>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Form Sample</h3>
                <div className="mt-3 space-y-3">
                  <input className={fieldClass} value="Customer invoice" readOnly />
                  <select className={fieldClass} value="windows" onChange={() => undefined}>
                    <option>Windows Mode</option>
                  </select>
                </div>
              </Card>
            </div>
          </Card>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm">
            <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
              <thead className="bg-[var(--color-bg-tertiary)]">
                <tr>
                  <th className="px-4 py-[var(--app-row-padding-y,0.75rem)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Document</th>
                  <th className="px-4 py-[var(--app-row-padding-y,0.75rem)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Module</th>
                  <th className="px-4 py-[var(--app-row-padding-y,0.75rem)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {[
                  ['Sales Invoice', 'Sales', 'Ready'],
                  ['Journal Voucher', 'Accounting', 'Review'],
                  ['Goods Receipt', 'Purchases', 'Draft'],
                ].map(row => (
                  <tr key={row[0]} className="hover:bg-[var(--color-bg-tertiary)]">
                    <td className="px-4 py-[var(--app-row-padding-y,0.75rem)] font-medium text-[var(--color-text-primary)]">{row[0]}</td>
                    <td className="px-4 py-[var(--app-row-padding-y,0.75rem)] text-[var(--color-text-secondary)]">{row[1]}</td>
                    <td className="px-4 py-[var(--app-row-padding-y,0.75rem)] text-[var(--color-text-secondary)]">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Card className="p-[var(--app-panel-padding,1.25rem)]">
            <h2 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">Exported Preference JSON</h2>
            <textarea
              className="h-56 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3 font-mono text-xs text-[var(--color-text-primary)]"
              value={serialized}
              readOnly
              spellCheck={false}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettingsPage;
