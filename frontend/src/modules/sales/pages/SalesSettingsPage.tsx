import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../../api/inventoryApi';
import { SalesSettingsDTO, salesApi } from '../../../api/salesApi';
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

const SalesSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('policy');
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SalesSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { getAccountById } = useAccounts();
  const [invSettings, setInvSettings] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const settingsResult = await salesApi.getSettings();
        const inventorySettings = await inventoryApi.getSettings().catch(() => null);

        const currentSettings = unwrap<any>(settingsResult)?.data ?? unwrap<any>(settingsResult);
        const invSettingsData = unwrap<any>(inventorySettings)?.data ?? unwrap<any>(inventorySettings);

        setSettings(currentSettings);
        setOriginalSettings(currentSettings);
        setInvSettings(invSettingsData);
      } catch (err: any) {
        console.error('Failed to load sales settings', err);
        errorHandler.showError('Failed to load sales settings.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const updateSetting = <K extends keyof SalesSettingsDTO>(field: K, value: SalesSettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const applyWorkflowMode = (mode: 'SIMPLE' | 'OPERATIONAL') => {
    setSettings((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        workflowMode: mode,
        allowDirectInvoicing: mode === 'SIMPLE' ? true : prev.allowDirectInvoicing,
        requireSOForStockItems: mode === 'SIMPLE' ? false : prev.requireSOForStockItems,
      };
    });
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
  const accountingMode = resolveInventoryAccountingMode(invSettings);
  const simpleWorkflowDisabled = accountingMode === 'PERPETUAL';

  const handleSave = async () => {
    if (!settings) return;
    if (!settings.defaultRevenueAccountId) {
      errorHandler.showError('Default Revenue account is required.');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<SalesSettingsDTO> = {
        workflowMode: settings.workflowMode,
        allowDirectInvoicing: settings.workflowMode === 'SIMPLE' ? true : settings.allowDirectInvoicing,
        requireSOForStockItems: settings.workflowMode === 'SIMPLE' ? false : settings.requireSOForStockItems,
        defaultRevenueAccountId: settings.defaultRevenueAccountId,
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
      setOriginalSettings(saved);
      errorHandler.showSuccess('Sales settings updated successfully.');
    } catch (err: any) {
      console.error('Failed to save sales settings', err);
      errorHandler.showError(err?.response?.data?.error?.message || 'Failed to save sales settings.');
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
    { id: 'policy', label: 'Sales Policy', icon: ShieldCheck },
    { id: 'accounts', label: 'Account Defaults', icon: DollarSign },
    { id: 'numbering', label: 'No. Series', icon: Hash },
  ];

  return (
    <ModuleSettingsLayout
      title="Sales Settings"
      subtitle="Control sales workflow, account defaults, tolerances, and numbering."
      tabs={tabs as any}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {activeTab === 'policy' && (
        <SettingsSection
          title="Sales Policy"
          description="Define which sales documents users can work with and how operational controls behave."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-sm font-bold text-gray-900">Workflow Mode</div>
                  <div className="space-y-3">
                    <label className={`flex items-start gap-3 rounded-lg border p-4 ${simpleWorkflowDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${settings.workflowMode === 'SIMPLE' ? 'border-indigo-500' : 'border-gray-200 hover:border-indigo-200'}`}>
                      <input
                        type="radio"
                        name="sales-settings-workflow"
                        checked={settings.workflowMode === 'SIMPLE'}
                        onChange={() => applyWorkflowMode('SIMPLE')}
                        disabled={simpleWorkflowDisabled}
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Simple</div>
                        <div className="text-xs text-gray-500 uppercase tracking-tight">Show invoices and returns only.</div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer ${settings.workflowMode === 'OPERATIONAL' ? 'border-indigo-500' : 'border-gray-200 hover:border-indigo-200'}`}>
                      <input
                        type="radio"
                        name="sales-settings-workflow"
                        checked={settings.workflowMode === 'OPERATIONAL'}
                        onChange={() => applyWorkflowMode('OPERATIONAL')}
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Operational</div>
                        <div className="text-xs text-gray-500 uppercase tracking-tight">Expose orders and delivery documents.</div>
                      </div>
                    </label>
                  </div>
                  {simpleWorkflowDisabled && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Perpetual accounting requires the operational workflow because Delivery Notes create inventory accounting.
                    </div>
                  )}
                </div>

                {settings.workflowMode === 'OPERATIONAL' ? (
                  <>
                    <label className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white cursor-pointer hover:border-indigo-200 transition shadow-sm">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Allow Direct Invoicing</div>
                        <div className="text-xs text-gray-500 uppercase tracking-tight">Invoice customers without a preceding SO/DN.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.allowDirectInvoicing}
                        onChange={(e) => updateSetting('allowDirectInvoicing', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white cursor-pointer hover:border-indigo-200 transition shadow-sm">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Require SO for Stock Items</div>
                        <div className="text-xs text-gray-500 uppercase tracking-tight">Force Sales Order workflow for inventory.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.requireSOForStockItems}
                        onChange={(e) => updateSetting('requireSOForStockItems', e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  </>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 shadow-sm">
                    Simple workflow automatically enables direct invoicing and hides Sales Orders and Delivery Notes from end users.
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms (Days)</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Over-delivery (%)</label>
                    <input
                      type="number"
                      step={0.01}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={settings.overDeliveryTolerancePct}
                      onChange={(e) => updateSetting('overDeliveryTolerancePct', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Over-invoice (%)</label>
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
          description="Standard general ledger accounts used for sales transactions."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Revenue Account</label>
                    <AccountSelector
                      value={settings.defaultRevenueAccountId}
                      onChange={(account: any) => updateSetting('defaultRevenueAccountId', account?.id || '')}
                      placeholder="Select Revenue account"
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">Global fallback for all Sales Invoices.</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 shadow-sm self-start">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                      <Settings size={14} className="text-indigo-600" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Linked Inventory Context</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Mode:</span>
                      <span className="font-bold text-indigo-700">{getAccountingModeLabel(accountingMode)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Inventory Asset:</span>
                      <span className="font-medium text-slate-700">
                        {invSettings?.defaultInventoryAssetAccountId ? (getAccountById(invSettings.defaultInventoryAssetAccountId)?.name || 'Account Assigned') : 'Not Assigned'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">COGS Account:</span>
                      <span className="font-medium text-slate-700">
                        {invSettings?.defaultCOGSAccountId ? (getAccountById(invSettings.defaultCOGSAccountId)?.name || 'Account Assigned') : 'Not Assigned'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex gap-2">
                      <Info size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] leading-relaxed text-slate-500 italic">
                        Sales posting follows the inventory accounting mode chosen during inventory setup.
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
          description="Prefixes and sequence counters for sales documents."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Workflow mode: <span className="font-semibold">{getWorkflowModeLabel(settings.workflowMode)}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { id: 'so', label: 'Sales Orders', prefix: 'soNumberPrefix', seq: 'soNumberNextSeq' },
                { id: 'dn', label: 'Deliveries (DN)', prefix: 'dnNumberPrefix', seq: 'dnNumberNextSeq' },
                { id: 'si', label: 'Invoices (SI)', prefix: 'siNumberPrefix', seq: 'siNumberNextSeq' },
                { id: 'sr', label: 'Returns (SR)', prefix: 'srNumberPrefix', seq: 'srNumberNextSeq' },
              ].map((doc) => (
                <div key={doc.id} className="space-y-4 p-4 rounded-xl border border-slate-100 bg-slate-50 shadow-sm transition hover:shadow-md hover:border-indigo-100">
                  <div className="bg-white px-2 py-1 rounded text-[10px] font-bold text-slate-400 uppercase tracking-widest w-fit mb-1 border border-slate-100 shadow-sm">
                    {doc.label}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Prefix</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold uppercase focus:ring-1 focus:ring-indigo-500"
                      value={(settings as any)[doc.prefix]}
                      onChange={(e) => updateSetting(doc.prefix as any, e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Next Number</label>
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

export default SalesSettingsPage;
