/**
 * ControlsAndPoliciesPage.tsx — Company-wide Controls & Policies screen.
 *
 * Task 267-E: the full-matrix doorway to the engine-owned typed
 * `PolicyConfig`. Reads from `/tenant/settings/controls/policies`
 * (gated by `system.company.manage`). This is the ONLY place unscoped
 * TENANT/company-wide rules can be added or edited. Each consuming
 * module (POS, Sales, Purchases) has its own Controls tab that only
 * edits the rules tagged for that module — see `PolicyRulesEditor`
 * with `allowedModule`.
 *
 * The word "engine" never appears in user copy (rule per AGENTS.md).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Save } from 'lucide-react';
import { controlsPoliciesApi, PolicyConfigDTO, PolicyRule } from '../../../api/controlsPoliciesApi';
import { PolicyRulesEditor } from '../../../components/shared/PolicyRulesEditor';
import { UnsavedChangesBanner } from '../../../components/shared/UnsavedChangesBanner';
import toast from 'react-hot-toast';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const ControlsAndPoliciesPage: React.FC = () => {
  const { t } = useTranslation('controls');
  const [config, setConfig] = useState<PolicyConfigDTO | null>(null);
  const [original, setOriginal] = useState<PolicyConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await controlsPoliciesApi.getControlsPolicies();
        const cfg = unwrap<PolicyConfigDTO>(data);
        setConfig(cfg);
        setOriginal(cfg);
      } catch (err: any) {
        toast.error(t('toastLoadError', { defaultValue: 'Failed to load controls and policies.' }));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const rules: PolicyRule[] = useMemo(() => config?.rules ?? [], [config]);

  const hasChanges = useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(original?.rules ?? []),
    [rules, original]
  );

  const onChange = (next: PolicyRule[]) => {
    setConfig((prev) => (prev ? { ...prev, rules: next } : prev));
  };

  const onSave = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const saved = await controlsPoliciesApi.updateControlsPolicies({ rules });
      const savedCfg = unwrap<PolicyConfigDTO>(saved);
      setConfig(savedCfg);
      setOriginal(savedCfg);
      toast.success(t('toastSaved', { defaultValue: 'Controls and policies saved.' }));
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message;
      toast.error(t('toastSaveError', { defaultValue: 'Failed to save controls and policies.' }) + (msg ? ` (${msg})` : ''));
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    setConfig(original);
    toast(t('discardInfo', { defaultValue: 'Changes discarded' }), { icon: 'ℹ️' });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[var(--color-bg-primary)] relative">
      <div className="flex-none border-b border-gray-200 bg-white px-4 py-6 sm:px-8 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-secondary)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
              {t('pageTitle', { defaultValue: 'Controls and Policies' })}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">
              {t('pageSubtitle', { defaultValue: 'Company-wide rules that decide what is allowed and what needs approval across sales, purchases, and the till.' })}
            </p>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={!hasChanges || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? t('saving', { defaultValue: 'Saving...' }) : t('save', { defaultValue: 'Save' })}
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto bg-white dark:bg-[var(--color-bg-secondary)]">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl space-y-6 pb-32">
            <PolicyRulesEditor
              rules={rules}
              onChange={onChange}
              hasChanges={hasChanges}
            />
          </div>
        </div>
      </main>

      <UnsavedChangesBanner
        hasChanges={hasChanges}
        onSave={onSave}
        onDiscard={onDiscard}
        saving={saving}
      />
    </div>
  );
};

export default ControlsAndPoliciesPage;