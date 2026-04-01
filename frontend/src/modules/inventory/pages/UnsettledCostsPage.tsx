import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { InventoryItemDTO, UnsettledCostReportDTO, inventoryApi } from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const UnsettledCostsPage: React.FC = () => {
  const [report, setReport] = useState<UnsettledCostReportDTO | null>(null);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [itemId, setItemId] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [reportRes, itemRes] = await Promise.all([
        inventoryApi.getUnsettledCosts({ itemId: itemId || undefined, limit: 300, offset: 0 }),
        inventoryApi.listItems({ active: true, limit: 500 }),
      ]);

      setReport(unwrap<UnsettledCostReportDTO>(reportRes));
      setItems(unwrap<InventoryItemDTO[]>(itemRes) || []);
    } catch (error) {
      console.error('Failed to load unsettled costs report', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Unsettled Costs Report</h1>

      <Card className="p-6">
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="">All Items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>

          <button className="rounded bg-slate-700 px-3 py-2 text-sm text-white" onClick={load} type="button">
            Refresh
          </button>

          <div className="self-center text-sm text-slate-600">
            Total unsettled: {report?.total ?? 0}
          </div>
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
                <th className="py-2 text-left">Movement Type</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unsettled Qty</th>
                <th className="py-2 text-left">Cost Basis</th>
                <th className="py-2 text-right">Cost Basis Amount</th>
              </tr>
            </thead>
            <tbody>
              {(report?.rows || []).map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2">{row.date}</td>
                  <td className="py-2">{row.itemId}</td>
                  <td className="py-2">{row.warehouseId}</td>
                  <td className="py-2">{row.movementType}</td>
                  <td className="py-2 text-right">{row.qty}</td>
                  <td className="py-2 text-right text-red-700 font-semibold">{row.unsettledQty}</td>
                  <td className="py-2">{row.unsettledCostBasis || '-'}</td>
                  <td className="py-2 text-right">{row.totalCostBase.toFixed(2)}</td>
                </tr>
              ))}
              {!loading && (report?.rows.length ?? 0) === 0 && (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={8}>
                    No unsettled movements.
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

export default UnsettledCostsPage;
