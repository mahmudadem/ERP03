import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventorySettingsDTO, inventoryApi, InventoryWarehouseDTO } from '../../../api/inventoryApi';
import { Card } from '../../../components/ui/Card';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { useAccounts } from '../../../context/AccountsContext';
import { Loader2, Settings, Info, Warehouse, Hash, DollarSign } from 'lucide-react';
import { ModuleSettingsLayout, SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import { errorHandler } from '../../../services/errorHandler';
import {
  getAccountingModeLabel,
  resolveInventoryAccountingMode,
} from '../../../utils/documentPolicy';

const unwrap = <T,>(payload: any): T => {
  const data = payload?.data ?? payload;
  return (data?.data ?? data) as T;
};

type TabId = 'accounting' | 'operational' | 'item-coding';

const InventorySettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('accounting');
  const [settings, setSettings] = useState<InventorySettingsDTO | null>(null);
  const [originalSettings, setOriginalSettings] = useState<InventorySettingsDTO | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { accounts: allAccounts } = useAccounts();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const settingsResult = await inventoryApi.getSettings();
        const currentSettings = unwrap<InventorySettingsDTO | null>(settingsResult);
        setSettings(currentSettings);
        setOriginalSettings(currentSettings);

        const warehousesResult = await inventoryApi.listWarehouses({ active: true });
        setWarehouses(unwrap<InventoryWarehouseDTO[]>(warehousesResult) || []);
      } catch (err: any) {
        console.error('Failed to load inventory settings', err);
        errorHandler.showError('Failed to load inventory settings.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateSetting = <K extends keyof InventorySettingsDTO>(field: K, value: InventorySettingsDTO[K]) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleSave = async () => {
    if (!settings) return;

    const accountingMode = resolveInventoryAccountingMode(settings);
    if (accountingMode === 'PERPETUAL' && !settings.defaultInventoryAssetAccountId) {
      errorHandler.showError('Default Inventory Asset Account is required for Perpetual accounting.');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<InventorySettingsDTO> = {
        defaultCostCurrency: settings.defaultCostCurrency,
        defaultInventoryAssetAccountId: settings.defaultInventoryAssetAccountId || undefined,
        allowNegativeStock: settings.allowNegativeStock,
        defaultWarehouseId: settings.defaultWarehouseId || undefined,
        autoGenerateItemCode: settings.autoGenerateItemCode,
        itemCodePrefix: settings.itemCodePrefix || undefined,
        itemCodeNextSeq: settings.itemCodeNextSeq,
        defaultCOGSAccountId: settings.defaultCOGSAccountId || undefined,
      };

      const result = await inventoryApi.updateSettings(payload);
      const saved = unwrap<InventorySettingsDTO>(result);
      setSettings(saved);
      setOriginalSettings(saved);
      errorHandler.showSuccess('Inventory settings updated successfully.');
    } catch (err: any) {
      console.error('Failed to save inventory settings', err);
      errorHandler.showError(err?.response?.data?.error?.message || 'Failed to save inventory settings.');
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
  const accountingMode = resolveInventoryAccountingMode(settings);

  const tabs = [
    { id: 'accounting', label: 'Accounting Foundation', icon: DollarSign },
    { id: 'operational', label: 'Operational Rules', icon: Warehouse },
    { id: 'item-coding', label: 'Item Coding', icon: Hash },
  ];

  return (
    <ModuleSettingsLayout
      title="Inventory Settings"
      subtitle="Configure global inventory and accounting rules."
      tabs={tabs as any}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
    >
      {/* Accounting Foundation Tab */}
      {activeTab === 'accounting' && (
        <SettingsSection
          title="Accounting Foundation"
          description="Manage how inventory value and COGS are handled in your general ledger."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Accounting Mode</label>
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 font-semibold shadow-sm">
                    {getAccountingModeLabel(accountingMode)}
                  </div>
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-500">
                    <Info className="h-3.5 w-3.5 mt-0.5" />
                    <span>The accounting mode is immutable after initialization.</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Cost Currency</label>
                  <input
                    type="text"
                    value={settings.defaultCostCurrency}
                    onChange={(e) => updateSetting('defaultCostCurrency', e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    placeholder="e.g. USD"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Inventory Asset Account</label>
                    <AccountSelector
                      value={settings.defaultInventoryAssetAccountId}
                      onChange={(acc) => updateSetting('defaultInventoryAssetAccountId', acc?.id || '')}
                      placeholder="Select inventory asset account"
                      accounts={allAccounts.filter(a => a.accountRole === 'POSTING' && a.classification?.toUpperCase() === 'ASSET')}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      {accountingMode === 'PERPETUAL'
                        ? 'Required for perpetual mode to post real-time inventory value.'
                        : 'Recommended fallback for invoice-driven stock purchases and inventory recognition.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default COGS Account</label>
                    <AccountSelector
                      value={settings.defaultCOGSAccountId}
                      onChange={(acc) => updateSetting('defaultCOGSAccountId', acc?.id || '')}
                      placeholder="Select COGS account"
                      accounts={allAccounts.filter(a => 
                        a.accountRole === 'POSTING' && 
                        ['EXPENSE', 'COGS'].includes(a.classification?.toUpperCase() || '')
                      )}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      Optional fallback for stock cost recognition when the item or category has no own COGS account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </SettingsSection>
      )}

      {/* Operational Rules Tab */}
      {activeTab === 'operational' && (
        <SettingsSection
          title="Operational Rules"
          description="Configure stock handling and default logistics settings."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Warehouse</label>
                  <select
                    value={settings.defaultWarehouseId || ''}
                    onChange={(e) => updateSetting('defaultWarehouseId', e.target.value || undefined)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition appearance-none bg-white font-medium"
                  >
                    <option value="">No default</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({wh.code})
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 cursor-pointer hover:border-gray-300 transition">
                  <div>
                    <div className="text-sm font-bold text-gray-900">Allow Negative Stock</div>
                    <div className="text-xs text-gray-500 uppercase tracking-tighter">Enable if stock can go below zero.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowNegativeStock}
                    onChange={(e) => updateSetting('allowNegativeStock', e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              </div>
            </div>
          </Card>
        </SettingsSection>
      )}

      {/* Item Coding Tab */}
      {activeTab === 'item-coding' && (
        <SettingsSection
          title="Item Coding"
          description="Set up automatic numbering patterns for your items."
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="space-y-6">
              <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 cursor-pointer hover:border-gray-300 transition">
                <div>
                  <div className="text-sm font-bold text-gray-900">Auto-generate Item Codes</div>
                  <div className="text-xs text-gray-500 uppercase tracking-tighter">Automatically assign codes on item creation.</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoGenerateItemCode}
                  onChange={(e) => updateSetting('autoGenerateItemCode', e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              {settings.autoGenerateItemCode && (
                <div className="grid md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
                    <input
                      type="text"
                      value={settings.itemCodePrefix || ''}
                      onChange={(e) => updateSetting('itemCodePrefix', e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="ITM"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Next Sequence Number</label>
                    <input
                      type="number"
                      min={1}
                      value={settings.itemCodeNextSeq}
                      onChange={(e) => updateSetting('itemCodeNextSeq', parseInt(e.target.value, 10) || 1)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </SettingsSection>
      )}
    </ModuleSettingsLayout>
  );
};

export default InventorySettingsPage;
