/**
 * PosSettingsPage.tsx — POS settings (registers, payment methods, governance).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ModuleSettingsLayout } from '../../../components/shared/ModuleSettingsLayout';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { AccountSelector } from '../../../modules/accounting/components/shared/AccountSelector';
import { posApi, PosSettingsDTO, PosPaymentMethodDTO, PosPaymentMethodCode } from '../../../api/posApi';
import { errorHandler } from '../../../services/errorHandler';
import { Info, Shield, ShieldCheck } from 'lucide-react';

interface Props { isWindow?: boolean }

const unwrap = <T,>(p: any): T => (p?.data ?? p) as T;

const ALL_METHOD_CODES: PosPaymentMethodCode[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'];

const PosSettingsPage: React.FC<Props> = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<PosSettingsDTO | null>(null);
  const [original, setOriginal] = useState<PosSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('general');
  const [showAllowDirectConfirm, setShowAllowDirectConfirm] = useState(false);
  const [pendingAllowDirect, setPendingAllowDirect] = useState<boolean | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await posApi.getSettings();
        const data = unwrap<PosSettingsDTO | null>(result);
        const normalized = normalizeSettings(data);
        setSettings(normalized);
        setOriginal(normalized);
      } catch (err) {
        console.error('Failed to load POS settings', err);
        toast.error(t('pos.settings.loadError', { defaultValue: 'Failed to load POS settings.' }));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const normalizeSettings = (data: PosSettingsDTO | null): PosSettingsDTO => {
    const base: PosSettingsDTO = data || {
      companyId: '',
      requireOpenShift: true,
      receiptPrefix: 'R',
      receiptNextSeq: 1,
      cashRounding: 'none',
      allowPosDirectSales: false,
      paymentMethods: [],
    };
    const existing = new Map(base.paymentMethods.map((m) => [m.code, m]));
    base.paymentMethods = ALL_METHOD_CODES.map((code) => {
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
    });
    return base;
  };

  const update = <K extends keyof PosSettingsDTO>(field: K, value: PosSettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateMethod = (code: PosPaymentMethodCode, patch: Partial<PosPaymentMethodDTO>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        paymentMethods: prev.paymentMethods.map((m) =>
          m.code === code ? { ...m, ...patch } : m
        ),
      };
    });
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(original);

  const onToggleAllowDirect = (next: boolean) => {
    setPendingAllowDirect(next);
    setShowAllowDirectConfirm(true);
  };

  const confirmToggleAllowDirect = async () => {
    if (pendingAllowDirect === null || !settings) return;
    update('allowPosDirectSales', pendingAllowDirect);
    setShowAllowDirectConfirm(false);
  };

  const onSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const result = await posApi.updateSettings(settings);
      const next = normalizeSettings(unwrap(result));
      setSettings(next);
      setOriginal(next);
      toast.success(t('pos.settings.saved', { defaultValue: 'POS settings saved.' }));
    } catch (err: any) {
      console.error('Failed to save POS settings', err);
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to save POS settings.';
      errorHandler.showError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">{t('common.loading', { defaultValue: 'Loading…' })}</div>;
  }
  if (!settings) {
    return <div className="p-6 text-sm text-rose-600">{t('pos.settings.loadError', { defaultValue: 'Failed to load POS settings.' })}</div>;
  }

  const tabs = [
    { id: 'general', label: t('pos.settings.general.title', { defaultValue: 'General' }), icon: Info },
    { id: 'payments', label: t('pos.settings.paymentMethods.title', { defaultValue: 'Payment Methods' }), icon: Shield },
    { id: 'overShort', label: t('pos.settings.overShort.title', { defaultValue: 'Cash Over/Short' }), icon: ShieldCheck },
  ];

  return (
    <>
      <ModuleSettingsLayout
        title={t('pos.settings.title', { defaultValue: 'POS Settings' })}
        subtitle={t('pos.settings.subtitle', { defaultValue: 'Configure registers, payment methods, and the governance gate for direct sales.' })}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSave={onSave}
        saving={saving}
        hasChanges={hasChanges}
      >
        {activeTab === 'general' && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.requireOpenShift}
                  onChange={(e) => update('requireOpenShift', e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>{t('pos.settings.requireOpenShift', { defaultValue: 'Require an open shift to sell' })}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.allowPosDirectSales}
                  onChange={(e) => onToggleAllowDirect(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-medium">
                  {t('pos.settings.allowPosDirectSales', { defaultValue: 'Allow POS direct sales' })}
                </span>
              </label>
              <div className="text-xs text-slate-500 md:col-span-2">
                {t('pos.settings.allowPosDirectSalesHelp', {
                  defaultValue:
                    'When enabled, the backend creates a form-scoped governance rule allowing the "direct" persona for formType "pos_sale" so cashiers can post direct Sales Invoices. Disabling it removes the rule.',
                })}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos.settings.walkInCustomer', { defaultValue: 'Walk-in customer' })}
                </label>
                <PartySelector
                  role="CUSTOMER"
                  value={settings.walkInCustomerId}
                  onChange={(p) => update('walkInCustomerId', p?.id || undefined)}
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos.settings.walkInCustomerHelp', {
                    defaultValue: 'Default customer for receipts with no named party. Required when completing a sale.',
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos.settings.receiptPrefix', { defaultValue: 'Receipt number prefix' })}
                </label>
                <input
                  type="text"
                  value={settings.receiptPrefix}
                  onChange={(e) => update('receiptPrefix', e.target.value.slice(0, 4))}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos.settings.cashRounding', { defaultValue: 'Cash rounding' })}
                </label>
                <select
                  value={settings.cashRounding}
                  onChange={(e) => update('cashRounding', e.target.value as any)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="none">{t('pos.settings.rounding.none', { defaultValue: 'None' })}</option>
                  <option value="nearest_05">{t('pos.settings.rounding.nearest_05', { defaultValue: 'Nearest 0.05' })}</option>
                  <option value="nearest_1">{t('pos.settings.rounding.nearest_1', { defaultValue: 'Nearest 1' })}</option>
                </select>
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos.settings.cashRoundingHelp', { defaultValue: 'V1 reserves this field; "none" is applied at the till.' })}
                </div>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'payments' && (
          <Card>
            <div className="p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 px-2">{t('pos.settings.method.code', { defaultValue: 'Code' })}</th>
                    <th className="py-2 px-2">{t('pos.settings.method.label', { defaultValue: 'Label' })}</th>
                    <th className="py-2 px-2">{t('pos.settings.method.account', { defaultValue: 'Settlement account' })}</th>
                    <th className="py-2 px-2">{t('pos.settings.method.change', { defaultValue: 'Allows change' })}</th>
                    <th className="py-2 px-2">{t('pos.settings.method.reference', { defaultValue: 'Requires ref' })}</th>
                    <th className="py-2 px-2">{t('pos.settings.method.enabled', { defaultValue: 'Enabled' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.paymentMethods.map((m) => (
                    <tr key={m.code} className="border-b last:border-b-0">
                      <td className="py-2 px-2 font-mono text-xs">{m.code}</td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={m.label || ''}
                          onChange={(e) => updateMethod(m.code, { label: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="py-2 px-2 min-w-[200px]">
                        <AccountSelector
                          value={m.settlementAccountId}
                          onChange={(a) => updateMethod(m.code, { settlementAccountId: a?.id || '' })}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.allowsChange}
                          onChange={(e) => updateMethod(m.code, { allowsChange: e.target.checked })}
                          className="rounded border-slate-300"
                          disabled={m.code !== 'CASH'}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={m.requiresReference}
                          onChange={(e) => updateMethod(m.code, { requiresReference: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
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
          </Card>
        )}

        {activeTab === 'overShort' && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos.settings.cashOver', { defaultValue: 'Cash over account' })}
                </label>
                <AccountSelector
                  value={settings.cashOverAccountId}
                  onChange={(a) => update('cashOverAccountId', a?.id || undefined)}
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos.settings.cashOverHelp', { defaultValue: 'Credit account for over-counts at shift close.' })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pos.settings.cashShort', { defaultValue: 'Cash short account' })}
                </label>
                <AccountSelector
                  value={settings.cashShortAccountId}
                  onChange={(a) => update('cashShortAccountId', a?.id || undefined)}
                />
                <div className="text-xs text-slate-500 mt-1">
                  {t('pos.settings.cashShortHelp', { defaultValue: 'Debit account for short-counts at shift close. Required to close a shift that has a non-zero over/short.' })}
                </div>
              </div>
            </div>
          </Card>
        )}
      </ModuleSettingsLayout>

      <ConfirmDialog
        isOpen={showAllowDirectConfirm}
        title={t('pos.settings.confirmAllowDirect.title', { defaultValue: 'Toggle POS direct sales?' })}
        message={t('pos.settings.confirmAllowDirect.body', {
          defaultValue: pendingAllowDirect
            ? 'This will insert a form-scoped governance rule that allows the "direct" persona for pos_sale invoices. Use it only when you intend to take real walk-in cash/card sales from the POS terminal.'
            : 'This will remove the form-scoped governance rule that allows the "direct" persona for pos_sale invoices. After this, the POS terminal cannot post direct cash sales and will be blocked by the backend.',
        })}
        tone="warning"
        onConfirm={confirmToggleAllowDirect}
        onCancel={() => setShowAllowDirectConfirm(false)}
        confirmLabel={t('common.confirm', { defaultValue: 'Confirm' })}
      />
    </>
  );
};

export default PosSettingsPage;
