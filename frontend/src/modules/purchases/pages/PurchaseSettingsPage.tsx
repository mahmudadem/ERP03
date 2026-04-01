import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountDTO, accountingApi } from '../../../api/accountingApi';
import { PurchaseSettingsDTO, purchasesApi } from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const accountLabel = (account: AccountDTO): string =>
  `${account.userCode || account.code || account.systemCode} - ${account.name}`;

const PurchaseSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
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
          purchasesApi.getSettings(),
          accountingApi.getAccounts(),
        ]);

        const currentSettings = unwrap<PurchaseSettingsDTO | null>(settingsResult);
        const accountList = unwrap<AccountDTO[]>(accountsResult);
        setSettings(currentSettings);
        setAccounts(Array.isArray(accountList) ? accountList : []);
      } catch (err: any) {
        console.error('Failed to load purchase settings', err);
        setError(
          err?.response?.data?.error?.message ||
            err?.response?.data?.message ||
            err?.message ||
            'Failed to load purchase settings.'
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

  const updateSetting = <K extends keyof PurchaseSettingsDTO>(field: K, value: PurchaseSettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const save = async () => {
    if (!settings) return;

    if (!settings.defaultAPAccountId) {
      setError('Default AP account is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const payload: Partial<PurchaseSettingsDTO> = {
        procurementControlMode: settings.procurementControlMode,
        requirePOForStockItems:
          settings.procurementControlMode === 'CONTROLLED' ? true : settings.requirePOForStockItems,
        defaultAPAccountId: settings.defaultAPAccountId,
        defaultPurchaseExpenseAccountId: settings.defaultPurchaseExpenseAccountId || undefined,
        allowOverDelivery: settings.allowOverDelivery,
        overDeliveryTolerancePct: settings.overDeliveryTolerancePct,
        overInvoiceTolerancePct: settings.overInvoiceTolerancePct,
        defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
        purchaseVoucherTypeId: settings.purchaseVoucherTypeId || undefined,
        defaultWarehouseId: settings.defaultWarehouseId || undefined,
        poNumberPrefix: settings.poNumberPrefix,
        poNumberNextSeq: settings.poNumberNextSeq,
        grnNumberPrefix: settings.grnNumberPrefix,
        grnNumberNextSeq: settings.grnNumberNextSeq,
        piNumberPrefix: settings.piNumberPrefix,
        piNumberNextSeq: settings.piNumberNextSeq,
        prNumberPrefix: settings.prNumberPrefix,
        prNumberNextSeq: settings.prNumberNextSeq,
      };

      const result = await purchasesApi.updateSettings(payload);
      const saved = unwrap<PurchaseSettingsDTO>(result);
      setSettings(saved);
      setNotice('Purchase settings updated.');
    } catch (err: any) {
      console.error('Failed to save purchase settings', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save purchase settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Settings</h1>
        <Card className="p-6">Loading settings...</Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Settings</h1>
        <Card className="space-y-3 p-6">
          <p className="text-sm text-slate-700">Purchases module is not initialized yet.</p>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => navigate('/purchases')}
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Settings</h1>
          <p className="text-sm text-slate-600">Control procurement mode, defaults, tolerances, and numbering.</p>
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
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Procurement Policy</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Procurement Mode</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.procurementControlMode}
              onChange={(e) => updateSetting('procurementControlMode', e.target.value as 'SIMPLE' | 'CONTROLLED')}
            >
              <option value="SIMPLE">SIMPLE</option>
              <option value="CONTROLLED">CONTROLLED</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pt-7 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={
                settings.procurementControlMode === 'CONTROLLED'
                  ? true
                  : settings.requirePOForStockItems
              }
              disabled={settings.procurementControlMode === 'CONTROLLED'}
              onChange={(e) => updateSetting('requirePOForStockItems', e.target.checked)}
            />
            Require PO for stock items
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Account Defaults</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Default AP Account</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.defaultAPAccountId}
              onChange={(e) => updateSetting('defaultAPAccountId', e.target.value)}
            >
              <option value="">Select AP account</option>
              {accountOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Default Expense Account</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.defaultPurchaseExpenseAccountId || ''}
              onChange={(e) =>
                updateSetting('defaultPurchaseExpenseAccountId', e.target.value || undefined)
              }
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
            <label className="mb-1 block text-sm font-medium text-slate-700">PO Prefix</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              value={settings.poNumberPrefix}
              onChange={(e) => updateSetting('poNumberPrefix', e.target.value.toUpperCase())}
            />
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.poNumberNextSeq}
              onChange={(e) => updateSetting('poNumberNextSeq', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">GRN Prefix</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              value={settings.grnNumberPrefix}
              onChange={(e) => updateSetting('grnNumberPrefix', e.target.value.toUpperCase())}
            />
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.grnNumberNextSeq}
              onChange={(e) => updateSetting('grnNumberNextSeq', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">PI Prefix</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              value={settings.piNumberPrefix}
              onChange={(e) => updateSetting('piNumberPrefix', e.target.value.toUpperCase())}
            />
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.piNumberNextSeq}
              onChange={(e) => updateSetting('piNumberNextSeq', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">PR Prefix</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              value={settings.prNumberPrefix}
              onChange={(e) => updateSetting('prNumberPrefix', e.target.value.toUpperCase())}
            />
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={settings.prNumberNextSeq}
              onChange={(e) => updateSetting('prNumberNextSeq', Number(e.target.value))}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PurchaseSettingsPage;
