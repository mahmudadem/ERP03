/**
 * ModuleControlsTab.tsx — Self-contained Controls tab body that a module
 * Settings page can drop into one of its tabs (Task 267-E).
 *
 * It loads/saves the module's OWN typed rules only. The backend doorway
 * (e.g. `/tenant/pos/policies`) already:
 *   - returns ONLY rules tagged with this module on GET
 *   - force-stamps the module tag on every PUT rule
 *   - rejects cross-module rules with 400
 *   - preserves unscoped TENANT/company-wide rules untouched
 *
 * So this component never sends unscoped or other-module rules — it only
 * ever works with the rule set the module GET returned. The module tag is
 * locked in the editor via `allowedModule`.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { PolicyRulesEditor, AllowedModule } from './PolicyRulesEditor';
import type { PolicyConfigDTO, PolicyRule } from '../../api/controlsPoliciesApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

interface ModuleControlsTabProps {
  /** Module key used to lock the editor and look up friendly labels. */
  module: Exclude<AllowedModule, undefined>;
  /** Load the module's typed rules. */
  load: () => Promise<PolicyConfigDTO>;
  /** Save the module's typed rules. */
  save: (payload: { rules: PolicyRule[] }) => Promise<PolicyConfigDTO>;
  /** Friendly known actions for this module (optional; defaults are sensible). */
  knownActions?: string[];
}

export const ModuleControlsTab: React.FC<ModuleControlsTabProps> = ({
  module,
  load,
  save,
  knownActions,
}) => {
  const { t } = useTranslation('controls');
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [originalRules, setOriginalRules] = useState<PolicyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const cfg = unwrap<PolicyConfigDTO>(await load());
        setRules(cfg.rules ?? []);
        setOriginalRules(cfg.rules ?? []);
      } catch {
        toast.error(t('toastLoadError', { defaultValue: 'Failed to load controls and policies.' }));
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const hasChanges = useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(originalRules),
    [rules, originalRules]
  );

  const onSave = async () => {
    try {
      setSaving(true);
      const cfg = unwrap<PolicyConfigDTO>(await save({ rules }));
      setRules(cfg.rules ?? rules);
      setOriginalRules(cfg.rules ?? rules);
      toast.success(t('toastSaved', { defaultValue: 'Controls and policies saved.' }));
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message;
      toast.error(t('toastSaveError', { defaultValue: 'Failed to save controls and policies.' }) + (msg ? ` (${msg})` : ''));
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    setRules(originalRules);
    toast(t('discardInfo', { defaultValue: 'Changes discarded' }), { icon: 'ℹ️' });
  };

  if (loading) {
    return <div className="p-4 text-sm text-slate-500">{t('loading', { defaultValue: 'Loading…' })}</div>;
  }

  return (
    <div className="space-y-4">
      <PolicyRulesEditor
        rules={rules}
        onChange={setRules}
        allowedModule={module}
        knownActions={knownActions}
        hasChanges={hasChanges}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!hasChanges || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? t('saving', { defaultValue: 'Saving...' })
            : t('save', { defaultValue: 'Save' })}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={!hasChanges || saving}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          {t('discard', { defaultValue: 'Discard' })}
        </button>
      </div>
    </div>
  );
};

export default ModuleControlsTab;