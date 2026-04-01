import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { StockAdjustmentDTO, inventoryApi } from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const StockAdjustmentPage: React.FC = () => {
  const [adjustments, setAdjustments] = useState<StockAdjustmentDTO[]>([]);
  const [form, setForm] = useState({
    warehouseId: '',
    date: '',
    reason: 'CORRECTION',
    itemId: '',
    currentQty: 0,
    newQty: 0,
    unitCostBase: 0,
    unitCostCCY: 0,
  });

  const load = async () => {
    try {
      const result = await inventoryApi.listAdjustments();
      setAdjustments(unwrap<StockAdjustmentDTO[]>(result) || []);
    } catch (error) {
      console.error('Failed to load adjustments', error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createAdjustment({
        warehouseId: form.warehouseId,
        date: form.date,
        reason: form.reason,
        lines: [{
          itemId: form.itemId,
          currentQty: Number(form.currentQty),
          newQty: Number(form.newQty),
          unitCostBase: Number(form.unitCostBase),
          unitCostCCY: Number(form.unitCostCCY),
        }],
      });
      await load();
    } catch (error) {
      console.error('Failed to create adjustment', error);
    }
  };

  const handlePost = async (id: string) => {
    try {
      await inventoryApi.postAdjustment(id);
      await load();
    } catch (error) {
      console.error('Failed to post adjustment', error);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Stock Adjustments</h1>

      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={handleCreate}>
          <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Warehouse ID" value={form.warehouseId} onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))} required />
          <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Item ID" value={form.itemId} onChange={(e) => setForm((p) => ({ ...p, itemId: e.target.value }))} required />
          <input type="date" className="rounded border border-slate-300 px-3 py-2 text-sm" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required />
          <select className="rounded border border-slate-300 px-3 py-2 text-sm" value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}>
            <option value="CORRECTION">CORRECTION</option>
            <option value="LOSS">LOSS</option>
            <option value="DAMAGE">DAMAGE</option>
            <option value="FOUND">FOUND</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="OTHER">OTHER</option>
          </select>
          <input type="number" className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Current Qty" value={form.currentQty} onChange={(e) => setForm((p) => ({ ...p, currentQty: Number(e.target.value) }))} />
          <input type="number" className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="New Qty" value={form.newQty} onChange={(e) => setForm((p) => ({ ...p, newQty: Number(e.target.value) }))} />
          <input type="number" className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Unit Cost Base" value={form.unitCostBase} onChange={(e) => setForm((p) => ({ ...p, unitCostBase: Number(e.target.value) }))} />
          <input type="number" className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Unit Cost CCY" value={form.unitCostCCY} onChange={(e) => setForm((p) => ({ ...p, unitCostCCY: Number(e.target.value) }))} />
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white md:col-span-4" type="submit">
            Create Adjustment
          </button>
        </form>
      </Card>

      <Card className="p-6">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 text-left">Date</th>
              <th className="py-2 text-left">Warehouse</th>
              <th className="py-2 text-left">Reason</th>
              <th className="py-2 text-left">Status</th>
              <th className="py-2 text-right">Value Base</th>
              <th className="py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map((adjustment) => (
              <tr key={adjustment.id} className="border-b border-slate-100">
                <td className="py-2">{adjustment.date}</td>
                <td className="py-2">{adjustment.warehouseId}</td>
                <td className="py-2">{adjustment.reason}</td>
                <td className="py-2">{adjustment.status}</td>
                <td className="py-2 text-right">{adjustment.adjustmentValueBase.toFixed(2)}</td>
                <td className="py-2 text-right">
                  {adjustment.status === 'DRAFT' && (
                    <button className="rounded bg-blue-600 px-3 py-1 text-xs text-white" onClick={() => handlePost(adjustment.id)}>
                      Post
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default StockAdjustmentPage;
