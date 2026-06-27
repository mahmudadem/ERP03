import React, { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import {
  SuperAdminBadge,
  SuperAdminHeader,
  SuperAdminPage,
  SuperAdminPanel,
  SuperAdminStatCard,
  SuperAdminTable,
  tableCellClass,
  tableHeadCellClass,
  tableRowClass,
} from '../components/SuperAdminPage';
import {
  DEFAULT_SUPER_ADMIN_THEME,
  loadSuperAdminTheme,
  resetSuperAdminTheme,
  saveSuperAdminTheme,
  SUPER_ADMIN_THEME_PRESETS,
  SuperAdminThemeSettings,
} from '../theme/SuperAdminThemeProvider';
import { useTranslation } from "react-i18next";

const fieldClass = 'h-10 w-full rounded-md border border-[var(--sa-border)] bg-[var(--sa-surface)] px-3 text-sm text-[var(--sa-text)]';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--sa-muted)]';

const colorFields: Array<{ key: keyof SuperAdminThemeSettings; label: string }> = [
  { key: 'background', label: 'Page background' },
  { key: 'surface', label: 'Surface' },
  { key: 'surfaceMuted', label: 'Muted surface' },
  { key: 'text', label: 'Text' },
  { key: 'mutedText', label: 'Muted text' },
  { key: 'border', label: 'Border' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentContrast', label: 'Accent text' },
];

export const SuperAdminAppearancePage: React.FC = () => {
    const { t } = useTranslation('common');
  const [settings, setSettings] = useState<SuperAdminThemeSettings>(() => loadSuperAdminTheme());
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    saveSuperAdminTheme(settings);
  }, [settings]);

  const serialized = useMemo(() => JSON.stringify(settings, null, 2), [settings]);

  const update = <K extends keyof SuperAdminThemeSettings>(key: K, value: SuperAdminThemeSettings[K]) => {
    setSettings(prev => ({ ...prev, id: 'custom', name: 'Custom', [key]: value }));
    setSavedAt(new Date().toLocaleTimeString());
  };

  const applyPreset = (preset: SuperAdminThemeSettings) => {
    setSettings(preset);
    setSavedAt(new Date().toLocaleTimeString());
  };

  const reset = () => {
    resetSuperAdminTheme();
    setSettings(DEFAULT_SUPER_ADMIN_THEME);
    setSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title="Appearance Lab"
        description="Change the Super Admin visual system live. This is scoped to the Super Admin portal so we can validate the approach before applying it to the main user site."
        meta="Experiment"
        actions={
          <Button variant="secondary" onClick={reset} leftIcon={<RotateCcw className="h-4 w-4" />}>
            Reset
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <div className="space-y-6">
          <SuperAdminPanel className="p-[var(--sa-panel-pad)]">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[var(--sa-muted)]" />
              <h2 className="text-base font-semibold text-[var(--sa-text)]">{t(`Presets`)}</h2>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {SUPER_ADMIN_THEME_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex items-center justify-between rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface-muted)] px-3 py-2 text-left text-sm hover:border-[var(--sa-accent)]"
                >
                  <span className="font-medium text-[var(--sa-text)]">{preset.name}</span>
                  <span className="flex items-center gap-1">
                    <span className="h-4 w-4 rounded-full border border-white/60" style={{ background: preset.accent }} />
                    {settings.id === preset.id && <Check className="h-4 w-4 text-[var(--sa-accent)]" />}
                  </span>
                </button>
              ))}
            </div>
          </SuperAdminPanel>

          <SuperAdminPanel className="p-[var(--sa-panel-pad)]">
            <h2 className="mb-4 text-base font-semibold text-[var(--sa-text)]">{t(`Controls`)}</h2>
            <div className="grid grid-cols-1 gap-4">
              {colorFields.map(field => (
                <label key={field.key}>
                  <span className={labelClass}>{field.label}</span>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className="h-10 w-12 rounded-md border border-[var(--sa-border)] bg-transparent p-1"
                      value={String(settings[field.key])}
                      onChange={event => update(field.key, event.target.value as any)}
                    />
                    <input
                      className={fieldClass}
                      value={String(settings[field.key])}
                      onChange={event => update(field.key, event.target.value as any)}
                    />
                  </div>
                </label>
              ))}

              <label>
                <span className={labelClass}>{t(`Radius`)}</span>
                <input
                  type="range"
                  min={2}
                  max={18}
                  value={settings.radius}
                  onChange={event => update('radius', Number(event.target.value))}
                  className="w-full"
                />
                <div className="mt-1 text-xs text-[var(--sa-muted)]">{settings.radius}{t(`px`)}</div>
              </label>

              <label>
                <span className={labelClass}>{t(`Density`)}</span>
                <select
                  className={fieldClass}
                  value={settings.density}
                  onChange={event => update('density', event.target.value as any)}
                >
                  <option value="compact">{t(`Compact`)}</option>
                  <option value="comfortable">{t(`Comfortable`)}</option>
                  <option value="spacious">{t(`Spacious`)}</option>
                </select>
              </label>

              <label>
                <span className={labelClass}>{t(`Sidebar`)}</span>
                <select
                  className={fieldClass}
                  value={settings.sidebar}
                  onChange={event => update('sidebar', event.target.value as any)}
                >
                  <option value="light">{t(`Light`)}</option>
                  <option value="dark">{t(`Dark`)}</option>
                </select>
              </label>
            </div>
          </SuperAdminPanel>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SuperAdminStatCard label="Theme" value={settings.name} helper={savedAt ? `Saved ${savedAt}` : 'Saved locally'} />
            <SuperAdminStatCard label="Density" value={settings.density} />
            <SuperAdminStatCard label="Radius" value={`${settings.radius}px`} />
          </div>

          <SuperAdminPanel className="p-[var(--sa-panel-pad)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--sa-text)]">{t(`Preview`)}</h2>
                <p className="text-sm text-[var(--sa-muted)]">{t(`Representative controls using the same shared Super Admin components.`)}</p>
              </div>
              <Button>{t(`Primary Action`)}</Button>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SuperAdminPanel className="p-4">
                <div className="text-sm font-semibold text-[var(--sa-text)]">{t(`Template Health`)}</div>
                <p className="mt-1 text-sm text-[var(--sa-muted)]">{t(`Official voucher definitions and initialization metadata.`)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SuperAdminBadge tone="green">{t(`Ready`)}</SuperAdminBadge>
                  <SuperAdminBadge tone="amber">{t(`Needs review`)}</SuperAdminBadge>
                  <SuperAdminBadge tone="blue">{t(`System`)}</SuperAdminBadge>
                </div>
              </SuperAdminPanel>

              <SuperAdminPanel className="p-4">
                <div className="text-sm font-semibold text-[var(--sa-text)]">{t(`Form Sample`)}</div>
                <div className="mt-3 space-y-3">
                  <input className={fieldClass} value="sales_invoice" readOnly />
                  <select className={fieldClass} value="system_core" onChange={() => undefined}>
                    <option>{t(`system_core`)}</option>
                  </select>
                </div>
              </SuperAdminPanel>
            </div>
          </SuperAdminPanel>

          <SuperAdminTable>
            <thead className="bg-[var(--sa-surface-muted)]">
              <tr>
                <th className={tableHeadCellClass}>{t(`Field`)}</th>
                <th className={tableHeadCellClass}>{t(`Type`)}</th>
                <th className={tableHeadCellClass}>{t(`State`)}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['customerId', 'Party Selector', 'Required'],
                ['warehouseId', 'Warehouse Selector', 'Optional'],
                ['invoicedQty', 'Number', 'Required'],
              ].map(row => (
                <tr key={row[0]} className={tableRowClass}>
                  <td className={`${tableCellClass} font-mono text-xs`}>{row[0]}</td>
                  <td className={tableCellClass}>{row[1]}</td>
                  <td className={tableCellClass}>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </SuperAdminTable>

          <SuperAdminPanel className="p-[var(--sa-panel-pad)]">
            <h2 className="mb-3 text-base font-semibold text-[var(--sa-text)]">{t(`Exported Settings`)}</h2>
            <textarea
              className="h-56 w-full rounded-[var(--sa-radius)] border border-[var(--sa-border)] bg-[var(--sa-surface-muted)] p-3 font-mono text-xs text-[var(--sa-text)]"
              value={serialized}
              readOnly
              spellCheck={false}
            />
          </SuperAdminPanel>
        </div>
      </div>
    </SuperAdminPage>
  );
};

export default SuperAdminAppearancePage;
