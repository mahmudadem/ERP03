import React, { useEffect, useMemo, useState } from 'react';
import { inventoryApi } from '../../../api/inventoryApi';
import { PurchaseSettingsDTO, purchasesApi } from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { useAccounts } from '../../../context/AccountsContext';
import { Loader2, Settings, ShieldCheck, DollarSign, Hash, Info } from 'lucide-react';
import { ModuleSettingsLayout, SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import { errorHandler } from '../../../services/errorHandler';
import {
  getAccountingModeLabel,
  getWorkflowModeLabel,
  resolveInventoryAccountingMode,
} from '../../../utils/documentPolicy';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type TabId = 'policy' | 'accounts' | 'numbering';

const PurchaseSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('policy');
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [originalSettings, setOriginalSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [invSettings, setInvSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { validAccounts, getAccountById } = useAccounts();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const settingsResult = await purchasesApi.getSettings();
        const inventorySettingsResult = await inventoryApi.getSettings().catch(() => null);

        const currentSettings = unwrap<any>(settingsResult)?.data ?? unwrap<any>(settingsResult);
        const invSettingsData = unwrap<any>(inventorySettingsResult)?.data ?? unwrap<any>(inventorySettingsResult);

        setSettings(currentSettings);
        setOriginalSettings(currentSettings);
        setInvSettings(invSettingsData);
      } catch (err: any) {
        console.error('Failed to load purchase settings', err);
        errorHandler.showError('Failed to load purchase settings.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const updateSetting = <K extends keyof PurchaseSettingsDTO>(field: K, value: PurchaseSettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const applyWorkflowMode = (mode: 'SIMPLE' | 'OPERATIONAL') => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        workflowMode: mode,
        allowDirectInvoicing: mode === 'SIMPLE' ? true : prev.allowDirectInvoicing,
        requirePOForStockItems: mode === 'SIMPLE' ? false : prev.requirePOForStockItems,
      };
    });
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
  const accountingMode = resolveInventoryAccountingMode(invSettings);
  const simpleWorkflowDisabled = accountingMode === 'PERPETUAL';

  const liabilityAccounts = useMemo(
    () =>
      validAccounts.filter((account) => {
        const classification = String(account.classification || account.type || '').toUpperCase();
        return classification === 'LIABILITY';
      }),
    [validAccounts]
  );

  const expenseAccounts = useMemo(
    () =>
      validAccounts.filter((account) => {
        const classification = String(account.classification || account.type || '').toUpperCase();
        return classification === 'EXPENSE';
      }),
    [validAccounts]
  );

  const handleSave = async () => {
    if (!settings) return;
    if (!settings.defaultAPAccountId) {
      errorHandler.showError('Default Accounts Payable account is required.');
      return;
    }
    if (accountingMode === 'PERPETUAL' && !settings.defaultGRNIAccountId) {
      errorHandler.showError('Default GRNI account is required for perpetual purchasing workflows.');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<PurchaseSettingsDTO> = {
        workflowMode: settings.workflowMode,
        allowDirectInvoicing: settings.workflowMode === 'SIMPLE' ? true : settings.allowDirectInvoicing,
        requirePOForStockItems: settings.workflowMode === 'SIMPLE' ? false : settings.requirePOForStockItems,
        defaultAPAccountId: settings.defaultAPAccountId,
        defaultPurchaseExpenseAccountId: settings.defaultPurchaseExpenseAccountId || undefined,
        defaultGRNIAccountId: accountingMode === 'PERPETUAL' ? settings.defaultGRNIAccountId || undefined : undefined,
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
        exchangeGainLossAccountId: settings.exchangeGainLossAccountId || undefined,
      };

      const result = await purchasesApi.updateSettings(payload);
      const saved = unwrap<PurchaseSettingsDTO>(result);
      setSettings(saved);
      setOriginalSettings(saved);
      errorHandler.showSuccess('Purchase settings updated successfully.');
    } catch (err: any) {
      console.error('Failed to save purchase settings', err);
      errorHandler.showError(err?.response?.data?.error?.message || 'Failed to save purchase settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!settings) return null;

  const tabs = [
    { id: 'policy', label: 'Procurement Policy', icon: ShieldCheck },
    { id: 'accounts', label: 'Account Defaults', icon: DollarSign },
    { id: 'numbering', label: 'No. Series', icon: Hash },
  ];

  return (
    <ModuleSettingsLayout
      title="Purchase Settings"
      subtitle="Control purchasing workflow, posting defaults, tolerances, and numbering."
      tabs={tabs as any}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {activeTab === 'policy' && (
        <SettingsSection
          title="Procurement Policy"
          description="Define which purchasing documents users can work with and how operational controls behave."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-sm font-bold text-gray-900">Workflow Mode</div>
                  <div className="space-y-3">
                    <label className={`flex items-start gap-3 rounded-lg border p-4 ${simpleWorkflowDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${settings.workflowMode === 'SIMPLE' ? 'border-indigo-500' : 'border-gray-200 hover:border-indigo-200'}`}>
                      <input
                        type="radio"
                        name="purchase-settings-workflow"
                        checked={settings.workflowMode === 'SIMPLE'}
                        onChange={() => applyWorkflowMode('SIMPLE')}
                        disabled={simpleWorkflowDisabled}
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Simple</div>
                        <div className="text-xs uppercase tracking-tight text-gray-500">Show invoices and returns only.</div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer ${settings.workflowMode === 'OPERATIONAL' ? 'border-indigo-500' : 'border-gray-200 hover:border-indigo-200'}`}>
                      <input
                        type="radio"
                        name="purchase-settings-workflow"
                        checked={settings.workflowMode === 'OPERATIONAL'}
                        onChange={() => applyWorkflowMode('OPERATIONAL')}
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Operational</div>
                        <div className="text-xs uppercase tracking-tight text-gray-500">Expose orders and goods receipts.</div>
                      </div>
                    </label>
                  </div>

                  {simpleWorkflowDisabled && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Perpetual accounting requires the operational workflow because Goods Receipts create inventory accounting.
                    </div>
                  )}
                </div>

                {settings.workflowMode === 'OPERATIONAL' ? (
                  <>
                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-indigo-200">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Allow Direct Invoicing</div>
                        <div className="text-xs uppercase tracking-tight text-gray-500">Invoice vendors without a preceding PO/GRN.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.allowDirectInvoicing}
                        onChange={(e) => updateSetting('allowDirectInvoicing', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-indigo-200">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Require PO For Stock Items</div>
                        <div className="text-xs uppercase tracking-tight text-gray-500">Force stock-item procurement to start from a Purchase Order.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.requirePOForStockItems}
                        onChange={(e) => updateSetting('requirePOForStockItems', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  </>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 shadow-sm">
                    Simple workflow automatically enables direct invoicing and hides Purchase Orders and Goods Receipts from end users.
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Default Payment Terms (Days)</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={settings.defaultPaymentTermsDays}
                    onChange={(e) => updateSetting('defaultPaymentTermsDays', Number(e.target.value))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Over-delivery (%)</label>
                    <input
                      type="number"
                      step={0.01}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={settings.overDeliveryTolerancePct}
                      onChange={(e) => updateSetting('overDeliveryTolerancePct', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Over-invoice (%)</label>
                    <input
                      type="number"
                      step={0.01}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={settings.overInvoiceTolerancePct}
                      onChange={(e) => updateSetting('overInvoiceTolerancePct', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </SettingsSection>
      )}

      {activeTab === 'accounts' && (
        <SettingsSection
          title="Account Defaults"
          description="Standard general ledger accounts used for purchasing transactions."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="space-y-8">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-6">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Default Accounts Payable</label>
                    <AccountSelector
                      value={settings.defaultAPAccountId || ''}
                      onChange={(account: any) => updateSetting('defaultAPAccountId', account?.id || '')}
                      accounts={liabilityAccounts}
                      placeholder="Select AP account"
                    />
                    <p className="mt-1.5 text-xs italic text-gray-500">Primary vendor liability account.</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Default Purchase Expense</label>
                    <AccountSelector
                      value={settings.defaultPurchaseExpenseAccountId || ''}
                      onChange={(account: any) => updateSetting('defaultPurchaseExpenseAccountId', account?.id || undefined)}
                      accounts={expenseAccounts}
                      placeholder="Select expense fallback for non-stock items"
                    />
                    <p className="mt-1.5 text-xs italic text-gray-500">Optional fallback for service and non-stock posting.</p>
                  </div>

                  {accountingMode === 'PERPETUAL' && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Default GRNI</label>
                      <AccountSelector
                        value={settings.defaultGRNIAccountId || ''}
                        onChange={(account: any) => updateSetting('defaultGRNIAccountId', account?.id || undefined)}
                        accounts={liabilityAccounts}
                        placeholder="Select GRNI account"
                      />
                      <p className="mt-1.5 text-xs italic text-gray-500">Required for perpetual receipt accrual posting.</p>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">FX Gain/Loss Account</label>
                    <AccountSelector
                      value={settings.exchangeGainLossAccountId || ''}
                      onChange={(account: any) => updateSetting('exchangeGainLossAccountId', account?.id || undefined)}
                      placeholder="Select FX account"
                    />
                    <p className="mt-1.5 text-xs italic text-gray-500">Used for posting supplier exchange differences.</p>
                  </div>
                </div>

                <div className="self-start rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="rounded-lg bg-indigo-50 p-1.5">
                      <Settings size={14} className="text-indigo-600" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">Linked Inventory Context</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Mode:</span>
                      <span className="font-bold text-indigo-700">{getAccountingModeLabel(accountingMode)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Inventory Asset:</span>
                      <span className="font-medium text-slate-700">
                        {invSettings?.defaultInventoryAssetAccountId
                          ? getAccountById(invSettings.defaultInventoryAssetAccountId)?.name || 'Account Assigned'
                          : 'Not Assigned'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Workflow:</span>
                      <span className="font-medium text-slate-700">{getWorkflowModeLabel(settings.workflowMode)}</span>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="flex gap-2">
                      <Info size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                      <p className="text-[10px] italic leading-relaxed text-slate-500">
                        Purchase posting follows the inventory accounting mode chosen during inventory setup. Perpetual mode requires GRNI for receipt accruals.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </SettingsSection>
      )}

      {activeTab === 'numbering' && (
        <SettingsSection
          title="Document Numbering"
          description="Prefixes and sequence counters for purchase documents."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Workflow mode: <span className="font-semibold">{getWorkflowModeLabel(settings.workflowMode)}</span>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                { id: 'po', label: 'Purchase Orders', prefix: 'poNumberPrefix', seq: 'poNumberNextSeq' },
                { id: 'grn', label: 'Receipts (GRN)', prefix: 'grnNumberPrefix', seq: 'grnNumberNextSeq' },
                { id: 'pi', label: 'Invoices (PI)', prefix: 'piNumberPrefix', seq: 'piNumberNextSeq' },
                { id: 'pr', label: 'Returns (PR)', prefix: 'prNumberPrefix', seq: 'prNumberNextSeq' },
              ].map((doc) => (
                <div key={doc.id} className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4 shadow-sm transition hover:border-indigo-100 hover:shadow-md">
                  <div className="mb-1 w-fit rounded border border-slate-100 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 shadow-sm">
                    {doc.label}
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Prefix</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold uppercase focus:ring-1 focus:ring-indigo-500"
                      value={(settings as any)[doc.prefix]}
                      onChange={(e) => updateSetting(doc.prefix as any, e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Next Number</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono focus:ring-1 focus:ring-indigo-500"
                      value={(settings as any)[doc.seq]}
                      onChange={(e) => updateSetting(doc.seq as any, Number(e.target.value))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </SettingsSection>
      )}
    </ModuleSettingsLayout>
  );
};

export default PurchaseSettingsPage;
