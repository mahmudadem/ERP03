import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { LowStockAlertDTO, inventoryApi } from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const LowStockAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<LowStockAlertDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const result = await inventoryApi.getLowStockAlerts();
      setAlerts(unwrap<LowStockAlertDTO[]>(result) || []);
    } catch (error) {
      console.error('Failed to load low stock alerts', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Low Stock Alerts</h1>

      <Card className="p-6">
        <div className="mb-3">
          <button className="rounded bg-slate-700 px-3 py-2 text-sm text-white" onClick={load} type="button">
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-left">Warehouse</th>
                <th className="py-2 text-right">Current Qty</th>
                <th className="py-2 text-right">Min Level</th>
                <th className="py-2 text-right">Deficit</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => {
                const rowClass = alert.qtyOnHand < 0 ? 'bg-red-50' : 'bg-amber-50';
                return (
                  <tr key={`${alert.itemId}_${alert.warehouseId}`} className={`border-b border-slate-100 ${rowClass}`}>
                    <td className="py-2">{alert.itemName} ({alert.itemId})</td>
                    <td className="py-2">{alert.warehouseId}</td>
                    <td className="py-2 text-right">{alert.qtyOnHand}</td>
                    <td className="py-2 text-right">{alert.minStockLevel}</td>
                    <td className="py-2 text-right font-semibold">{alert.deficit}</td>
                  </tr>
                );
              })}
              {!loading && alerts.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={5}>
                    No low stock alerts.
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

export default LowStockAlertsPage;
