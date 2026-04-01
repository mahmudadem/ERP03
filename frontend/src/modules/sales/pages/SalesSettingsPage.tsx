import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountDTO, accountingApi } from '../../../api/accountingApi';
import { SalesSettingsDTO, salesApi } from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const accountLabel = (account: AccountDTO): string =>
  `${account.userCode || account.code || account.systemCode} - ${account.name}`;

const SalesSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [settingsResult, accountsResult] = await Promise.all([
          salesApi.getSettings(),
          accountingApi.getAccounts(),
        ]);

        const currentSettings = unwrap<SalesSettingsDTO | null>(settingsResult);
        const accountList = unwrap<AccountDTO[]>(accountsResult);
        setSettings(currentSettings);
        setAccounts(Array.isArray(accountList) ? accountList : []);
      } catch (err: any) {
        console.error('Failed to load sales settings', err);
        setError(
          err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            'Failed to load sales settings.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: accountLabel(account),
      })),
    [accounts]
  );

  const updateSetting = <K extends keyof SalesSettingsDTO>(field: K, value: SalesSettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const save = async () => {
    if (!settings) return;
    if (!settings.defaultARAccountId) {
      setError('Default AR account is required.');
      return;
    }
    if (!settings.defaultRevenueAccountId) {
      setError('Default Revenue account is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const payload: Partial<SalesSettingsDTO> = {
        salesControlMode: settings.salesControlMode,
        requireSOForStockItems: settings.salesControlMode === 'CONTROLLED' ? true : settings.requireSOForStockItems,
        defaultARAccountId: settings.defaultARAccountId,
        defaultRevenueAccountId: settings.defaultRevenueAccountId,
        defaultCOGSAccountId: settings.defaultCOGSAccountId || undefined,
        defaultSalesExpenseAccountId: settings.defaultSalesExpenseAccountId || undefined,
        allowOverDelivery: settings.allowOverDelivery,
        overDeliveryTolerancePct: settings.overDeliveryTolerancePct,
        overInvoiceTolerancePct: settings.overInvoiceTolerancePct,
        defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
        salesVoucherTypeId: settings.salesVoucherTypeId || undefined,
        defaultWarehouseId: settings.defaultWarehouseId || undefined,
        soNumberPrefix: settings.soNumberPrefix,
        soNumberNextSeq: settings.soNumberNextSeq,
        dnNumberPrefix: settings.dnNumberPrefix,
        dnNumberNextSeq: settings.dnNumberNextSeq,
        siNumberPrefix: settings.siNumberPrefix,
        siNumberNextSeq: settings.siNumberNextSeq,
        srNumberPrefix: settings.srNumberPrefix,
        srNumberNextSeq: settings.srNumberNextSeq,
      };

      const result = await salesApi.updateSettings(payload);
      const saved = unwrap<SalesSettingsDTO>(result);
      setSettings(saved);
      setNotice('Sales settings updated.');
    } catch (err: any) {
      console.error('Failed to save sales settings', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save sales settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Settings</h1>
        <Card className="p-6">Loading settings...</Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Settings</h1>
        <Card className="space-y-3 p-6">
          <p className="text-sm text-slate-700">Sales module is not initialized yet.</p>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => navigate('/sales')}
          >
            Open Initialization Wizard
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Settings</h1>
          <p className="text-sm text-slate-600">Control sales mode, account defaults, tolerances, and numbering.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Sales Policy</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sales Mode</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.salesControlMode}
              onChange={(e) => updateSetting('salesControlMode', e.target.value as 'SIMPLE' | 'CONTROLLED')}
            >
              <option value="SIMPLE">SIMPLE</option>
              <option value="CONTROLLED">CONTROLLED</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.salesControlMode === 'CONTROLLED' ? true : settings.requireSOForStockItems}
              disabled={settings.salesControlMode === 'CONTROLLED'}
              onChange={(e) => updateSetting('requireSOForStockItems', e.target.checked)}
            />
            Require SO for stock items
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Account Defaults</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Default AR Account</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.defaultARAccountId}
              onChange={(e) => updateSetting('defaultARAccountId', e.target.value)}
            >
              <option value="">Select AR account</option>
              {accountOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Default Revenue Account</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.defaultRevenueAccountId}
              onChange={(e) => updateSetting('defaultRevenueAccountId', e.target.value)}
            >
              <option value="">Select Revenue account</option>
              {accountOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Default COGS Account</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.defaultCOGSAccountId || ''}
              onChange={(e) => updateSetting('defaultCOGSAccountId', e.target.value || undefined)}
            >
              <option value="">Optional</option>
              {accountOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Tolerance & Terms</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.allowOverDelivery}
              onChange={(e) => updateSetting('allowOverDelivery', e.target.checked)}
            />
            Allow over-delivery
          </label>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Over-delivery Tolerance (%)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.overDeliveryTolerancePct}
              onChange={(e) => updateSetting('overDeliveryTolerancePct', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Over-invoice Tolerance (%)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.overInvoiceTolerancePct}
              onChange={(e) => updateSetting('overInvoiceTolerancePct', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Default Payment Terms (Days)</label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.defaultPaymentTermsDays}
              onChange={(e) => updateSetting('defaultPaymentTermsDays', Number(e.target.value))}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Document Numbering</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">SO Prefix</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              value={settings.soNumberPrefix}
              onChange={(e) => updateSetting('soNumberPrefix', e.target.value.toUpperCase())}
            />
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.soNumberNextSeq}
              onChange={(e) => updateSetting('soNumberNextSeq', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">DN Prefix</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              value={settings.dnNumberPrefix}
              onChange={(e) => updateSetting('dnNumberPrefix', e.target.value.toUpperCase())}
            />
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.dnNumberNextSeq}
              onChange={(e) => updateSetting('dnNumberNextSeq', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">SI Prefix</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              value={settings.siNumberPrefix}
              onChange={(e) => updateSetting('siNumberPrefix', e.target.value.toUpperCase())}
            />
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.siNumberNextSeq}
              onChange={(e) => updateSetting('siNumberNextSeq', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">SR Prefix</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              value={settings.srNumberPrefix}
              onChange={(e) => updateSetting('srNumberPrefix', e.target.value.toUpperCase())}
            />
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.srNumberNextSeq}
              onChange={(e) => updateSetting('srNumberNextSeq', Number(e.target.value))}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SalesSettingsPage;
