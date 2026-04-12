import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { inventoryApi } from '../../../api/inventoryApi';
import { PurchaseSettingsDTO, purchasesApi } from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { useAccounts } from '../../../context/AccountsContext';
import { Loader2, Settings, ShieldCheck, DollarSign, Hash, Info } from 'lucide-react';
import { ModuleSettingsLayout, SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import { errorHandler } from '../../../services/errorHandler';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type TabId = 'policy' | 'accounts' | 'numbering';

const PurchaseSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('policy');
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [originalSettings, setOriginalSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [inventoryAccountingMethod, setInventoryAccountingMethod] = useState<'PERIODIC' | 'PERPETUAL'>('PERPETUAL');
  const [invSettings, setInvSettings] = useState<any>(null);
  const { getAccountById } = useAccounts();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const settingsResult = await purchasesApi.getSettings();
        const inventorySettings = await inventoryApi.getSettings().catch(() => null);

        const currentSettings = unwrap<any>(settingsResult)?.data ?? unwrap<any>(settingsResult);
        const invSettingsData = unwrap<any>(inventorySettings)?.data ?? unwrap<any>(inventorySettings);
        
        setSettings(currentSettings);
        setOriginalSettings(currentSettings);
        setInvSettings(invSettingsData);
        setInventoryAccountingMethod(invSettingsData?.inventoryAccountingMethod === 'PERIODIC' ? 'PERIODIC' : 'PERPETUAL');
      } catch (err: any) {
        console.error('Failed to load purchase settings', err);
        errorHandler.showError('Failed to load purchase settings.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateSetting = <K extends keyof PurchaseSettingsDTO>(field: K, value: PurchaseSettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleSave = async () => {
    if (!settings) return;
    if (!settings.defaultAPAccountId) {
      errorHandler.showError('Default Accounts Payable account is required.');
      return;
    }
    if (inventoryAccountingMethod === 'PERIODIC' && !settings.defaultPurchaseExpenseAccountId) {
      errorHandler.showError('Default Purchase Expense Account is required for PERIODIC inventory accounting.');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<PurchaseSettingsDTO> = {
        allowDirectInvoicing: settings.allowDirectInvoicing,
        requirePOForStockItems: settings.requirePOForStockItems,
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
      subtitle="Control purchasing policy, defaults, tolerances, and numbering."
      tabs={tabs as any}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {/* Policy Tab */}
      {activeTab === 'policy' && (
        <SettingsSection
          title="Procurement Policy"
          description="Define how your organization acquires goods and handles variances."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 cursor-pointer hover:border-indigo-200 transition bg-white shadow-sm">
                  <div>
                    <div className="text-sm font-bold text-gray-900">Allow Direct Invoicing</div>
                    <div className="text-xs text-gray-500 uppercase tracking-tight">Invoice vendors without a preceding PO/GRN.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowDirectInvoicing}
                    onChange={(e) => updateSetting('allowDirectInvoicing', e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50 cursor-pointer hover:border-indigo-200 transition bg-white shadow-sm">
                  <div>
                    <div className="text-sm font-bold text-gray-900">Require PO for Stock Items</div>
                    <div className="text-xs text-gray-500 uppercase tracking-tight">Force Purchase Order workflow for inventory.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requirePOForStockItems}
                    onChange={(e) => updateSetting('requirePOForStockItems', e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
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

      {/* Account Defaults Tab */}
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
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Accounts Payable</label>
                    <AccountSelector
                      value={settings.defaultAPAccountId || ''}
                      onChange={(account: any) => updateSetting('defaultAPAccountId', account?.id || '')}
                      placeholder="Select AP account"
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">Centralized liability account for vendors.</p>
                  </div>

                  {inventoryAccountingMethod === 'PERIODIC' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default Purchase Expense</label>
                      <AccountSelector
                        value={settings.defaultPurchaseExpenseAccountId || ''}
                        onChange={(account: any) => updateSetting('defaultPurchaseExpenseAccountId', account?.id || undefined)}
                        placeholder="Select Purchases account"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">FX Gain/Loss Account</label>
                    <AccountSelector
                      value={settings.exchangeGainLossAccountId || ''}
                      onChange={(account: any) => updateSetting('exchangeGainLossAccountId', account?.id || undefined)}
                      placeholder="Select FX account"
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">Used for posting rate differences.</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm self-start">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                      <Settings size={14} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">Linked Inventory Context</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Method:</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-400">{inventoryAccountingMethod}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Inventory Asset:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {invSettings?.defaultInventoryAssetAccountId ? (getAccountById(invSettings.defaultInventoryAssetAccountId)?.name || 'Account Assigned') : 'Not Assigned'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex gap-2">
                       <Info size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                       <p className="text-[10px] leading-relaxed text-slate-500 italic">
                        In Perpetual mode, purchases debited to inventory occur automatically via inventory settings.
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </SettingsSection>
      )}

      {/* Numbering Tab */}
      {activeTab === 'numbering' && (
        <SettingsSection
          title="Document Numbering"
          description="Prefixes and sequence counters for purchase documents."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {[
                 { id: 'po', label: 'Purchase Orders', prefix: 'poNumberPrefix', seq: 'poNumberNextSeq' },
                 { id: 'grn', label: 'Receipts (GRN)', prefix: 'grnNumberPrefix', seq: 'grnNumberNextSeq' },
                 { id: 'pi', label: 'Invoices (PI)', prefix: 'piNumberPrefix', seq: 'piNumberNextSeq' },
                 { id: 'pr', label: 'Returns (PR)', prefix: 'prNumberPrefix', seq: 'prNumberNextSeq' }
               ].map(doc => (
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

export default PurchaseSettingsPage;
