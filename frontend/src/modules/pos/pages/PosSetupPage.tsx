/**
 * PosSetupPage.tsx - POS initialization wizard.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { AlertCircle, CheckCircle, ShoppingCart } from 'lucide-react';
import { posApi, PosPaymentMethodCode, PosSettingsDTO } from '../../../api/posApi';
import { companyModulesApi } from '../../../api/companyModules';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { emitCompanyModulesRefresh } from '../../../utils/companyModulesEvents';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { AccountSelector } from '../../../modules/accounting/components/shared/AccountSelector';

const ALL_METHOD_CODES: PosPaymentMethodCode[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'];

const createDefaultSettings = (): PosSettingsDTO => ({
  companyId: '',
  requireOpenShift: true,
  receiptPrefix: 'R',
  receiptNextSeq: 1,
  cashRounding: 'none',
  allowPosDirectSales: false,
  paymentMethods: ALL_METHOD_CODES.map((code) => ({
    code,
    settlementAccountId: '',
    requiresReference: code !== 'CASH',
    allowsChange: code === 'CASH',
    isEnabled: code === 'CASH',
  })),
});

const normalizeSettings = (data: PosSettingsDTO | null | undefined): PosSettingsDTO => {
  const base = data || createDefaultSettings();
  const existing = new Map(base.paymentMethods.map((m) => [m.code, m]));
  return {
    ...base,
    paymentMethods: ALL_METHOD_CODES.map((code) => {
      const prev = existing.get(code);
      return (
        prev || {
          code,
          settlementAccountId: '',
          requiresReference: code !== 'CASH',
          allowsChange: code === 'CASH',
          isEnabled: code === 'CASH',
        }
      );
    }),
  };
};

const PosSetupPage: React.FC = () => {
  const { t } = useTranslation('pos');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyAccess();
  const [settings, setSettings] = useState<PosSettingsDTO>(() => createDefaultSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadExistingSettings = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const existing = await posApi.getSettings();
        if (!cancelled) {
          setSettings(normalizeSettings(existing));
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          const message =
            err?.response?.data?.error?.message ||
            err?.response?.data?.error ||
            err?.message ||
            t('setup.loadFailed', { defaultValue: 'Failed to load existing POS settings.' });
          setError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadExistingSettings();

    return () => {
      cancelled = true;
    };
  }, [companyId, t]);

  const update = <K extends keyof PosSettingsDTO>(field: K, value: PosSettingsDTO[K]) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updateMethod = (code: PosPaymentMethodCode, patch: Partial<PosSettingsDTO['paymentMethods'][number]>) => {
    setSettings((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((m) => (m.code === code ? { ...m, ...patch } : m)),
    }));
  };

  const applyDefaults = () => {
    setSettings(normalizeSettings(createDefaultSettings()));
    setError(null);
    toast.success(t('setup.defaultsApplied', { defaultValue: 'POS defaults applied. Review and finish setup when ready.' }));
  };

  const validate = (): boolean => {
    if (!companyId) {
      setError(t('setup.noCompany', { defaultValue: 'No active company is selected.' }));
      return false;
    }

    if (!settings.receiptPrefix.trim()) {
      setError(t('setup.validation.receiptPrefix', { defaultValue: 'Receipt prefix is required.' }));
      return false;
    }

    setError(null);
    return true;
  };

  const requestFinish = () => {
    if (!validate()) return;
    setConfirmOpen(true);
  };

  const finishSetup = async () => {
    if (!companyId) return;

    try {
      setSaving(true);
      setConfirmOpen(false);
      await posApi.updateSettings({ ...settings, companyId });
      const savedSettings = await posApi.getSettings();
      setSettings(normalizeSettings(savedSettings));
      await companyModulesApi.initialize(companyId, 'pos', { initializedFrom: 'pos-setup-page' });
      emitCompanyModulesRefresh({ companyId, moduleCode: 'pos' });
      await queryClient.refetchQueries({ queryKey: ['companyModules', companyId] });
      toast.success(t('setup.readyToast', { defaultValue: 'POS setup completed.' }));
      navigate('/pos/settings', { replace: true });
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.error ||
        err?.message ||
        t('setup.failed', { defaultValue: 'Failed to complete POS setup.' });
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold text-slate-900">
                  {t('setup.title', { defaultValue: 'Configure Point of Sale' })}
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  {t('setup.subtitle', {
                    defaultValue:
                      'Review POS operating rules, payment settlement accounts, and cash control accounts before enabling the module.',
                  })}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={applyDefaults}
                disabled={loading || saving}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('setup.useDefaults', { defaultValue: 'Use defaults' })}
              </button>
              <button
                type="button"
                onClick={requestFinish}
                disabled={loading || saving}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading
                  ? t('common.loading', { defaultValue: 'Loading...' })
                  : saving
                  ? t('setup.finishing', { defaultValue: 'Finishing...' })
                  : t('setup.finish', { defaultValue: 'Finish setup' })}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <Card>
              <div className="p-4 text-sm text-slate-500">
                {t('common.loading', { defaultValue: 'Loading...' })}
              </div>
            </Card>
          )}

          {!loading && <Card padding="none">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {t('setup.general.title', { defaultValue: 'Operating rules' })}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.requireOpenShift}
                  onChange={(e) => update('requireOpenShift', e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>{t('settings.requireOpenShift', { defaultValue: 'Require an open shift to sell' })}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.allowPosDirectSales}
                  onChange={(e) => update('allowPosDirectSales', e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-medium">
                  {t('settings.allowPosDirectSales', { defaultValue: 'Allow POS direct sales' })}
                </span>
              </label>
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 md:col-span-2">
                {t('setup.directSalesWarning', {
                  defaultValue:
                    'Allowing POS direct sales enables real posted Sales Invoices from the cashier screen. Keep it off until payment methods, cash drawer accounts, and cashier permissions are ready.',
                })}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t('settings.walkInCustomer', { defaultValue: 'Walk-in customer' })}
                </label>
                <PartySelector
                  role="CUSTOMER"
                  value={settings.walkInCustomerId}
                  onChange={(p) => update('walkInCustomerId', p?.id || undefined)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t('settings.receiptPrefix', { defaultValue: 'Receipt number prefix' })}
                </label>
                <input
                  type="text"
                  value={settings.receiptPrefix}
                  onChange={(e) => update('receiptPrefix', e.target.value.slice(0, 4))}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t('settings.cashRounding', { defaultValue: 'Cash rounding' })}
                </label>
                <select
                  value={settings.cashRounding}
                  onChange={(e) => update('cashRounding', e.target.value as PosSettingsDTO['cashRounding'])}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="none">{t('settings.rounding.none', { defaultValue: 'None' })}</option>
                  <option value="nearest_05">{t('settings.rounding.nearest_05', { defaultValue: 'Nearest 0.05' })}</option>
                  <option value="nearest_1">{t('settings.rounding.nearest_1', { defaultValue: 'Nearest 1' })}</option>
                </select>
              </div>
            </div>
          </Card>}

          {!loading && <Card padding="none">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {t('settings.paymentMethods.title', { defaultValue: 'Payment methods' })}
              </h2>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="px-2 py-2">{t('settings.method.code', { defaultValue: 'Code' })}</th>
                    <th className="px-2 py-2">{t('settings.method.label', { defaultValue: 'Label' })}</th>
                    <th className="px-2 py-2 text-center">{t('settings.method.change', { defaultValue: 'Allows change' })}</th>
                    <th className="px-2 py-2 text-center">{t('settings.method.reference', { defaultValue: 'Requires ref' })}</th>
                    <th className="px-2 py-2 text-center">{t('settings.method.enabled', { defaultValue: 'Enabled' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.paymentMethods.map((m) => (
                    <tr key={m.code} className="border-b last:border-b-0">
                      <td className="px-2 py-2 font-mono text-xs">{m.code}</td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={m.label || ''}
                          onChange={(e) => updateMethod(m.code, { label: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.allowsChange}
                          onChange={(e) => updateMethod(m.code, { allowsChange: e.target.checked })}
                          className="rounded border-slate-300"
                          disabled={m.code !== 'CASH'}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.requiresReference}
                          onChange={(e) => updateMethod(m.code, { requiresReference: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.isEnabled}
                          onChange={(e) => updateMethod(m.code, { isEnabled: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>}

          {!loading && <Card padding="none">
            <div className="border-b border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {t('settings.overShort.title', { defaultValue: 'Cash over/short accounts' })}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t('settings.cashOver', { defaultValue: 'Cash over account' })}
                </label>
                <AccountSelector
                  value={settings.cashOverAccountId}
                  onChange={(a) => update('cashOverAccountId', a?.id || undefined)}
                  allowedClassifications={['REVENUE']}
                  contextLabel={t('settings.cashOverContext', { defaultValue: 'Income' })}
                  enforceClassification
                  enforceScope
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {t('settings.cashShort', { defaultValue: 'Cash short account' })}
                </label>
                <AccountSelector
                  value={settings.cashShortAccountId}
                  onChange={(a) => update('cashShortAccountId', a?.id || undefined)}
                  allowedClassifications={['EXPENSE']}
                  contextLabel={t('settings.cashShortContext', { defaultValue: 'Expense' })}
                  enforceClassification
                  enforceScope
                />
              </div>
            </div>
          </Card>}

          {!loading && <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={applyDefaults}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('setup.useDefaults', { defaultValue: 'Use defaults' })}
            </button>
            <button
              type="button"
              onClick={requestFinish}
              disabled={saving}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {saving
                  ? t('setup.finishing', { defaultValue: 'Finishing...' })
                  : t('setup.finish', { defaultValue: 'Finish setup' })}
              </span>
            </button>
          </div>}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={t('setup.confirm.title', { defaultValue: 'Finish POS setup?' })}
        message={t('setup.confirm.body', {
          defaultValue:
            'This will save these POS settings and mark the POS module as initialized for this company.',
        })}
        tone="warning"
        confirmLabel={t('setup.finish', { defaultValue: 'Finish setup' })}
        onConfirm={finishSetup}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

export default PosSetupPage;
