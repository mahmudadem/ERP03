import React, { useEffect, useState } from 'react';
import { InventorySettingsDTO, inventoryApi, InventoryWarehouseDTO } from '../../../api/inventoryApi';
import { Card } from '../../../components/ui/Card';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { useAccounts } from '../../../context/AccountsContext';
import { Info, Warehouse, Hash, DollarSign } from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import { ModuleSettingsLayout, SettingsSection } from '../../../components/shared/ModuleSettingsLayout';
import { AccountingIntegrationStatus } from '../../../components/shared/AccountingIntegrationStatus';
import { errorHandler } from '../../../services/errorHandler';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  resolveInventoryAccountingMode,
} from '../../../utils/documentPolicy';

const unwrap = <T,>(payload: any): T => {
  const data = payload?.data ?? payload;
  return (data?.data ?? data) as T;
};

type TabId = 'accounting' | 'operational' | 'item-coding';

const InventorySettingsPage: React.FC = () => {
  const { t } = useTranslation('inventory');
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
        errorHandler.showError(t('settings.messages.loadFailed', { defaultValue: 'Failed to load inventory settings.' }));
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
      errorHandler.showError(t('settings.messages.assetRequired', { defaultValue: 'Default Inventory Asset Account is required for Perpetual accounting.' }));
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<InventorySettingsDTO> = {
        accountingMode: settings.accountingMode,
        defaultCostCurrency: settings.defaultCostCurrency,
        costingBasis: settings.costingBasis || 'WAREHOUSE',
        defaultInventoryAssetAccountId: settings.defaultInventoryAssetAccountId || undefined,
        allowNegativeStock: settings.allowNegativeStock,
        allowDeferredCost: settings.allowDeferredCost,
        defaultWarehouseId: settings.defaultWarehouseId || undefined,
        autoGenerateItemCode: settings.autoGenerateItemCode,
        itemCodePrefix: settings.itemCodePrefix || undefined,
        itemCodeNextSeq: settings.itemCodeNextSeq,
        defaultCOGSAccountId: settings.defaultCOGSAccountId || undefined,
        defaultInventoryGainAccountId: settings.defaultInventoryGainAccountId || undefined,
        defaultInventoryLossAccountId: settings.defaultInventoryLossAccountId || undefined,
        defaultInventoryTransferClearingAccountId: settings.defaultInventoryTransferClearingAccountId || undefined,
        defaultInventoryRevaluationAccountId: settings.defaultInventoryRevaluationAccountId || undefined,
        defaultOpeningBalanceAccountId: settings.defaultOpeningBalanceAccountId || undefined,
        allowNegativeInventoryValue: settings.allowNegativeInventoryValue || false,
      };

      const result = await inventoryApi.updateSettings(payload);
      const saved = unwrap<InventorySettingsDTO>(result);
      setSettings(saved);
      setOriginalSettings(saved);
      errorHandler.showSuccess(t('settings.messages.saved', { defaultValue: 'Inventory settings updated successfully.' }));
    } catch (err: any) {
      console.error('Failed to save inventory settings', err);
      errorHandler.showError(err?.response?.data?.error?.message || t('settings.messages.saveFailed', { defaultValue: 'Failed to save inventory settings.' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" variant="indigo" />
      </div>
    );
  }

  if (!settings) return null;
  const accountingMode = resolveInventoryAccountingMode(settings);
  const accountingModeLocked = settings.accountingModeLocked === true;

  const tabs = [
    { id: 'accounting', label: t('settings.tabs.accounting', { defaultValue: 'Accounting Foundation' }), icon: DollarSign },
    { id: 'operational', label: t('settings.tabs.operational', { defaultValue: 'Operational Rules' }), icon: Warehouse },
    { id: 'item-coding', label: t('settings.tabs.itemCoding', { defaultValue: 'Item Coding' }), icon: Hash },
  ];

  return (
    <ModuleSettingsLayout
      title={t('settings.title', { defaultValue: 'Inventory Settings' })}
      subtitle={t('settings.subtitle', { defaultValue: 'Configure global inventory and accounting rules.' })}
      tabs={tabs as any}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as TabId)}
      hasChanges={hasChanges}
      onSave={handleSave}
      onDiscard={() => {
        setSettings(originalSettings);
        toast(t('settings.messages.discarded', { defaultValue: 'Changes discarded' }), { icon: 'ℹ️' });
      }}
      saving={saving}
    >
      <AccountingIntegrationStatus
        moduleCode="inventory"
        hasMappings={!!settings?.defaultInventoryAssetAccountId}
        integrationRoute="/inventory/financial-integration"
      />

      {/* Accounting Foundation Tab */}
      {activeTab === 'accounting' && (
        <SettingsSection
          title={t('settings.accounting.title', { defaultValue: 'Accounting Foundation' })}
          description={t('settings.accounting.description', { defaultValue: 'Manage how inventory value and COGS are handled in your general ledger.' })}
          onSave={handleSave}
          disabled={!hasChanges || saving}
          saving={saving}
        >
          <Card className="p-6">
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('settings.accountingMode.label', { defaultValue: 'Accounting Mode' })}
                  </label>
                  <select
                    value={settings.accountingMode}
                    onChange={(e) => updateSetting('accountingMode', e.target.value as InventorySettingsDTO['accountingMode'])}
                    disabled={accountingModeLocked}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition appearance-none bg-white font-medium disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    <option value="PERIODIC">
                      {t('settings.accountingMode.options.periodic', { defaultValue: 'Periodic' })}
                    </option>
                    <option value="INVOICE_DRIVEN">
                      {t('settings.accountingMode.options.invoiceDriven', { defaultValue: 'Invoice-driven' })}
                    </option>
                    <option value="PERPETUAL">
                      {t('settings.accountingMode.options.perpetual', { defaultValue: 'Perpetual' })}
                    </option>
                  </select>
                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-500">
                    <Info className="h-3.5 w-3.5 mt-0.5" />
                    <span>
                      {accountingModeLocked
                        ? (settings.accountingModeLockReason
                          || t('settings.accountingMode.locked', {
                            defaultValue: 'Inventory accounting mode is locked after the first posted stock or accounting transaction.',
                          }))
                        : t('settings.accountingMode.unlocked', {
                          defaultValue: 'You can still change the mode until the first posted stock or accounting transaction.',
                        })}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.accounting.defaultCostCurrency', { defaultValue: 'Default Cost Currency' })}</label>
                  <input
                    type="text"
                    value={settings.defaultCostCurrency}
                    onChange={(e) => updateSetting('defaultCostCurrency', e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    placeholder="e.g. USD"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.accounting.costingBasis', { defaultValue: 'Costing Basis' })}</label>
                  <select
                    value={settings.costingBasis || 'WAREHOUSE'}
                    onChange={(e) => updateSetting('costingBasis', e.target.value as 'WAREHOUSE' | 'GLOBAL')}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition appearance-none bg-white font-medium"
                  >
                    <option value="WAREHOUSE">{t('settings.accounting.costingPerWarehouse', { defaultValue: 'Per Warehouse (moving average per item + warehouse)' })}</option>
                    <option value="GLOBAL">{t('settings.accounting.costingGlobal', { defaultValue: 'Global (one company-wide average per item)' })}</option>
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500 italic">
                    {t('settings.accounting.costingBasisHint', { defaultValue: 'Set once during setup. Changing it after stock movements exist is not recommended.' })}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.accounting.inventoryAsset', { defaultValue: 'Default Inventory Asset Account' })}</label>
                    <AccountSelector
                      value={settings.defaultInventoryAssetAccountId}
                      onChange={(acc) => updateSetting('defaultInventoryAssetAccountId', acc?.id || '')}
                      placeholder={t('settings.accounting.selectInventoryAsset', { defaultValue: 'Select inventory asset account' })}
                      accounts={allAccounts.filter(a => a.accountRole === 'POSTING' && a.classification?.toUpperCase() === 'ASSET')}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      {accountingMode === 'PERPETUAL'
                        ? t('settings.accounting.inventoryAssetRequired', { defaultValue: 'Required for perpetual mode to post real-time inventory value.' })
                        : t('settings.accounting.inventoryAssetRecommended', { defaultValue: 'Recommended fallback for invoice-driven stock purchases and inventory recognition.' })}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.accounting.openingBalance', { defaultValue: 'Default Opening Balance Account' })}</label>
                    <AccountSelector
                      value={settings.defaultOpeningBalanceAccountId}
                      onChange={(acc) => updateSetting('defaultOpeningBalanceAccountId', acc?.id || '')}
                      placeholder={t('settings.accounting.selectOpeningBalance', { defaultValue: 'Select opening balance equity account' })}
                      accounts={allAccounts.filter(a =>
                        a.accountRole === 'POSTING' &&
                        a.classification?.toUpperCase() === 'EQUITY'
                      )}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      {t('settings.accounting.openingBalanceHint', { defaultValue: 'Prefills Opening Stock Documents. Users can override it per document, but posting still requires an active posting equity account.' })}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.accounting.cogs', { defaultValue: 'Default COGS Account' })}</label>
                    <AccountSelector
                      value={settings.defaultCOGSAccountId}
                      onChange={(acc) => updateSetting('defaultCOGSAccountId', acc?.id || '')}
                      placeholder={t('settings.accounting.selectCogs', { defaultValue: 'Select COGS account' })}
                      accounts={allAccounts.filter(a => 
                        a.accountRole === 'POSTING' && 
                        ['EXPENSE', 'COGS'].includes(a.classification?.toUpperCase() || '')
                      )}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      {t('settings.accounting.cogsHint', { defaultValue: 'Optional fallback for stock cost recognition when the item or category has no own COGS account.' })}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.accounting.lossAccount', { defaultValue: 'Inventory Loss / Write-down Account' })}</label>
                    <AccountSelector
                      value={settings.defaultInventoryLossAccountId}
                      onChange={(acc) => updateSetting('defaultInventoryLossAccountId', acc?.id || '')}
                      placeholder={t('settings.accounting.selectLossAccount', { defaultValue: 'Select inventory loss account' })}
                      accounts={allAccounts.filter(a =>
                        a.accountRole === 'POSTING' &&
                        ['EXPENSE', 'COGS'].includes(a.classification?.toUpperCase() || '')
                      )}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      {t('settings.accounting.lossHint', { defaultValue: 'Debited when stock is written down on a negative stock adjustment. Falls back to COGS if unset.' })}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Gain / Write-up Account</label>
                    <AccountSelector
                      value={settings.defaultInventoryGainAccountId}
                      onChange={(acc) => updateSetting('defaultInventoryGainAccountId', acc?.id || '')}
                      placeholder="Select inventory gain account"
                      accounts={allAccounts.filter(a =>
                        a.accountRole === 'POSTING' &&
                        ['INCOME', 'REVENUE', 'EXPENSE', 'COGS'].includes(a.classification?.toUpperCase() || '')
                      )}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      Credited when stock is found / written up on a positive stock adjustment. Falls back to COGS if unset.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Transfer Clearing Account</label>
                    <AccountSelector
                      value={settings.defaultInventoryTransferClearingAccountId}
                      onChange={(acc) => updateSetting('defaultInventoryTransferClearingAccountId', acc?.id || '')}
                      placeholder="Select transfer clearing account"
                      accounts={allAccounts.filter(a => a.accountRole === 'POSTING')}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      Used only for explicit added transfer costs such as freight, customs, or handling. Value-only corrections use Inventory Revaluation instead.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Revaluation Account</label>
                    <AccountSelector
                      value={settings.defaultInventoryRevaluationAccountId}
                      onChange={(acc) => updateSetting('defaultInventoryRevaluationAccountId', acc?.id || '')}
                      placeholder="Select inventory revaluation account"
                      accounts={allAccounts.filter(a => a.accountRole === 'POSTING')}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 italic">
                      Used only when stock transfer value is explicitly revalued. Do not use gain/loss or transfer clearing for value-only cost corrections.
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

                <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 cursor-pointer hover:border-gray-300 transition">
                  <div>
                    <div className="text-sm font-bold text-gray-900">Allow Deferred Cost Posting</div>
                    <div className="text-xs text-gray-500 uppercase tracking-tighter">
                      Post sales invoices before stock cost is known. COGS is recognized later when cost settles.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowDeferredCost}
                    onChange={(e) => updateSetting('allowDeferredCost', e.target.checked)}
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
