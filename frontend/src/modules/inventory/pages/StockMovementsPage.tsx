import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { StockMovementDTO, InventoryItemDTO, InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const StockMovementsPage: React.FC = () => {
  const [movements, setMovements] = useState<StockMovementDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [movementsResult, itemsResult, warehousesResult] = await Promise.all([
        inventoryApi.getMovements({
          from: from || undefined,
          to: to || undefined,
          limit: 300,
          offset: 0,
        }),
        inventoryApi.listItems({ active: true, limit: 1000 }),
        inventoryApi.listWarehouses({ active: true }),
      ]);
      
      setMovements(unwrap<StockMovementDTO[]>(movementsResult) || []);
      setItems(unwrap<InventoryItemDTO[]>(itemsResult) || []);
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(warehousesResult) || []);
    } catch (error) {
      console.error('Failed to load movements data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getItemLabel = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    return item ? `${item.code} - ${item.name}` : itemId;
  };

  const getWarehouseName = (warehouseId: string) => {
    const wh = warehouses.find((w) => w.id === warehouseId);
    return wh ? wh.name : warehouseId;
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Stock Movements</h1>

      <Card className="p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            type="date"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button className="rounded bg-slate-700 px-3 py-2 text-sm text-white md:col-span-2 disabled:opacity-50" onClick={loadData} disabled={loading}>
            {loading ? 'Applying...' : 'Apply Filters'}
          </button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-left">Warehouse</th>
                <th className="py-2 text-left">Type</th>
                <th className="py-2 text-left">Direction</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Cost Base</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 text-slate-600">{movement.date}</td>
                  <td className="py-2 font-medium text-slate-900">{getItemLabel(movement.itemId)}</td>
                  <td className="py-2 text-slate-700">{getWarehouseName(movement.warehouseId)}</td>
                  <td className="py-2">{movement.movementType}</td>
                  <td className="py-2">{movement.direction}</td>
                  <td className="py-2 text-right">{movement.qty}</td>
                  <td className="py-2 text-right">{movement.totalCostBase.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default StockMovementsPage;
