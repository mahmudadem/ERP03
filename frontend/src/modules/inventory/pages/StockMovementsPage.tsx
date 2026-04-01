import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { StockMovementDTO, inventoryApi } from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const StockMovementsPage: React.FC = () => {
  const [movements, setMovements] = useState<StockMovementDTO[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    try {
      const result = await inventoryApi.getMovements({
        from: from || undefined,
        to: to || undefined,
        limit: 300,
        offset: 0,
      });
      setMovements(unwrap<StockMovementDTO[]>(result) || []);
    } catch (error) {
      console.error('Failed to load movements', error);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          <button className="rounded bg-slate-700 px-3 py-2 text-sm text-white md:col-span-2" onClick={load}>
            Apply Filters
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
                <tr key={movement.id} className="border-b border-slate-100">
                  <td className="py-2">{movement.date}</td>
                  <td className="py-2">{movement.itemId}</td>
                  <td className="py-2">{movement.warehouseId}</td>
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
