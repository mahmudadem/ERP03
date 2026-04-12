import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { InventoryDashboardDTO, InventorySettingsDTO, inventoryApi } from '../../../api/inventoryApi';
import { companyModulesApi } from '../../../api/companyModules';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { InventoryInitializationWizard } from '../wizards/InventoryInitializationWizard';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const InventoryHomePage: React.FC = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { companyId } = useCompanyAccess();
  const [dashboard, setDashboard] = useState<InventoryDashboardDTO | null>(null);
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [itemsMap, setItemsMap] = useState<Record<string, string>>({});
  const [warehousesMap, setWarehousesMap] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      if (companyId) {
        const modules = await companyModulesApi.list(companyId);
        const inventoryModule = modules.find((m) => m.moduleCode === 'inventory');
        if (inventoryModule && !inventoryModule.initialized) {
          setInitialized(false);
          setDashboard(null);
          return;
        }
      }

      const settingsResult = await inventoryApi.getSettings();
      const settings = unwrap<InventorySettingsDTO | null>(settingsResult);

      if (!settings) {
        setInitialized(false);
        setDashboard(null);
        return;
      }

      setInitialized(true);
      const [dashboardResult, itemsResult, warehousesResult] = await Promise.all([
        inventoryApi.getDashboard(),
        inventoryApi.listItems(),
        inventoryApi.listWarehouses()
      ]);

      const items = unwrap<any[]>(itemsResult) || [];
      const warehouses = unwrap<any[]>(warehousesResult) || [];
      
      const iMap: Record<string, string> = {};
      items.forEach(i => iMap[i.id] = `${i.name} (${i.code})`);
      setItemsMap(iMap);

      const wMap: Record<string, string> = {};
      warehouses.forEach(w => wMap[w.id] = w.name);
      setWarehousesMap(wMap);

      setDashboard(unwrap<InventoryDashboardDTO>(dashboardResult));
    } catch (error: any) {
      console.error('Failed to load inventory dashboard', error);
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        'Failed to load inventory module.';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpiClass = 'p-5 transition hover:shadow-sm';

  if (loading && initialized === null) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">
          {t('modulePlaceholders.inventory.title', { defaultValue: 'Inventory Overview' })}
        </h1>
        <Card className="p-6">Loading inventory module...</Card>
      </div>
    );
  }

  if (loadError && initialized === null) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">
          {t('modulePlaceholders.inventory.title', { defaultValue: 'Inventory Overview' })}
        </h1>
        <Card className="p-6">
          <p className="text-sm text-red-700">{loadError}</p>
        </Card>
      </div>
    );
  }

  if (initialized === false) {
    return (
      <InventoryInitializationWizard
        onComplete={() => {
          setInitialized(true);
          setReloadTick((prev) => prev + 1);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">
        {t('modulePlaceholders.inventory.title', { defaultValue: 'Inventory Overview' })}
      </h1>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className={kpiClass}>
          <div className="text-sm text-slate-500">Total Value (Base)</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {loading ? '...' : (dashboard?.totalInventoryValueBase ?? 0).toFixed(2)}
          </div>
        </Card>

        <Card className={kpiClass}>
          <div className="text-sm text-slate-500">Items</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {loading ? '...' : dashboard?.totalTrackedItems ?? 0}
          </div>
        </Card>

        <Card className={`${kpiClass} cursor-pointer`} onClick={() => navigate('/inventory/alerts/low-stock')}>
          <div className="text-sm text-slate-500">Low Stock Alerts</div>
          <div className="mt-2 text-2xl font-semibold text-amber-700">
            {loading ? '...' : dashboard?.lowStockAlerts ?? 0}
          </div>
        </Card>

        <Card className={kpiClass}>
          <div className="text-sm text-slate-500">Negative Stock</div>
          <div className="mt-2 text-2xl font-semibold text-red-700">
            {loading ? '...' : dashboard?.negativeStockCount ?? 0}
          </div>
        </Card>

        <Card className={`${kpiClass} cursor-pointer`} onClick={() => navigate('/inventory/reports/unsettled-costs')}>
          <div className="text-sm text-slate-500">Unsettled</div>
          <div className="mt-2 text-2xl font-semibold text-blue-700">
            {loading ? '...' : dashboard?.unsettledMovementsCount ?? 0}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Movements</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left font-semibold">Date</th>
                <th className="py-2 text-left font-semibold">Item</th>
                <th className="py-2 text-left font-semibold">Warehouse</th>
                <th className="py-2 text-left font-semibold">Type</th>
                <th className="py-2 text-left font-semibold">Dir</th>
                <th className="py-2 text-right font-semibold">Qty</th>
                <th className="py-2 text-right font-semibold">Cost Base</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.recentMovements || []).map((movement) => (
                <tr key={movement.id} className="border-b border-slate-100 transition hover:bg-slate-50/50">
                  <td className="py-2 text-slate-600 font-mono text-[11px]">{movement.date}</td>
                  <td className="py-2 font-medium text-slate-900">{itemsMap[movement.itemId] || movement.itemId}</td>
                  <td className="py-2 text-slate-600">{warehousesMap[movement.warehouseId] || movement.warehouseId}</td>
                  <td className="py-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tighter uppercase ${
                      movement.movementType.includes('STOCK') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {movement.movementType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`font-bold ${movement.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {movement.direction}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono font-bold text-slate-900">{movement.qty}</td>
                  <td className="py-2 text-right font-mono text-slate-600">{movement.totalCostBase.toFixed(2)}</td>
                </tr>
              ))}
              {!loading && (dashboard?.recentMovements?.length ?? 0) === 0 && (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={7}>
                    No recent movements.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default InventoryHomePage;
