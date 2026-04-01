import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { StockLevelDTO, inventoryApi } from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const StockLevelsPage: React.FC = () => {
  const [levels, setLevels] = useState<StockLevelDTO[]>([]);
  const [warehouseId, setWarehouseId] = useState('');

  const load = async () => {
    try {
      const result = await inventoryApi.getStockLevels({
        warehouseId: warehouseId || undefined,
        limit: 200,
      });
      setLevels(unwrap<StockLevelDTO[]>(result) || []);
    } catch (error) {
      console.error('Failed to load stock levels', error);
    }
  };

  useEffect(() => {
    load();
  }, [warehouseId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Stock Levels</h1>

      <Card className="p-6">
        <div className="flex flex-wrap gap-3">
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm md:w-64"
            placeholder="Filter by warehouseId"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          />
          <button className="rounded bg-slate-700 px-3 py-2 text-sm text-white" onClick={load}>
            Refresh
          </button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-left">Warehouse</th>
                <th className="py-2 text-right">Qty On Hand</th>
                <th className="py-2 text-right">Avg Cost Base</th>
                <th className="py-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => {
                const value = level.qtyOnHand * level.avgCostBase;
                const rowClass =
                  level.qtyOnHand < 0
                    ? 'bg-red-50'
                    : level.qtyOnHand < 5
                      ? 'bg-amber-50'
                      : '';

                return (
                  <tr key={level.id} className={`border-b border-slate-100 ${rowClass}`}>
                    <td className="py-2">{level.itemId}</td>
                    <td className="py-2">{level.warehouseId}</td>
                    <td className="py-2 text-right">{level.qtyOnHand}</td>
                    <td className="py-2 text-right">{level.avgCostBase.toFixed(2)}</td>
                    <td className="py-2 text-right">{value.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default StockLevelsPage;
