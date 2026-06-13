import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardList } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { StockAdjustmentDTO, StockLevelDTO, inventoryApi } from '../../../api/inventoryApi';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { WarehouseSelector, ItemSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

interface AdjLine {
  _key: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  currentQty: number;
  newQty: number;
  unitCostBase: number;
  unitCostCCY: number;
  costCurrency?: string;
}

let keySeq = 0;
const newKey = () => `adjln_${Date.now()}_${keySeq++}`;
const emptyLine = (): AdjLine => ({
  _key: newKey(),
  itemId: '',
  currentQty: 0,
  newQty: 0,
  unitCostBase: 0,
  unitCostCCY: 0,
});

const REASONS = ['CORRECTION', 'LOSS', 'DAMAGE', 'FOUND', 'EXPIRED', 'OTHER'];

const statusTone = (status: string) =>
  status === 'POSTED'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';

const StockAdjustmentPage: React.FC = () => {
  const [adjustments, setAdjustments] = useState<StockAdjustmentDTO[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('CORRECTION');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<AdjLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

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

  const fetchLevel = async (itemId: string, whId: string): Promise<StockLevelDTO | null> => {
    if (!itemId || !whId) return null;
    try {
      const res = await inventoryApi.getStockLevels({ itemId, warehouseId: whId, limit: 1 });
      const list = unwrap<StockLevelDTO[]>(res) || [];
      return list[0] || null;
    } catch {
      return null;
    }
  };

  const setLine = (index: number, patch: Partial<AdjLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  // Prefill the current quantity AND the current average cost so the GL/stock
  // post at the real cost — the user only changes the New Qty for a count, and
  // can override the cost for a revaluation. (Kills the old zero-cost footgun.)
  const prefillLine = async (index: number, itemId: string, whId: string) => {
    const level = await fetchLevel(itemId, whId);
    setLine(index, level
      ? { currentQty: level.qtyOnHand, newQty: level.qtyOnHand, unitCostBase: level.avgCostBase, unitCostCCY: level.avgCostCCY }
      : { currentQty: 0, newQty: 0 });
  };

  const onWarehouseChange = async (whId: string) => {
    setWarehouseId(whId);
    if (!whId) return;
    const updated = await Promise.all(
      lines.map(async (l) => {
        if (!l.itemId) return l;
        const level = await fetchLevel(l.itemId, whId);
        return level
          ? { ...l, currentQty: level.qtyOnHand, newQty: l.newQty || level.qtyOnHand, unitCostBase: level.avgCostBase, unitCostCCY: level.avgCostCCY }
          : l;
      })
    );
    setLines(updated);
  };

  const totalValue = useMemo(
    () => lines.reduce((sum, l) => sum + Math.abs(l.newQty - l.currentQty) * l.unitCostBase, 0),
    [lines]
  );

  const handleCreate = async () => {
    const filled = lines.filter((l) => l.itemId && Number(l.newQty) !== Number(l.currentQty));
    if (!warehouseId || !date) {
      toast.error('Warehouse and date are required.');
      return;
    }
    if (filled.length === 0) {
      toast('No stock quantity change to adjust.', { icon: 'ℹ️' });
      return;
    }
    try {
      setSaving(true);
      await inventoryApi.createAdjustment({
        warehouseId,
        date,
        reason,
        notes: notes || undefined,
        lines: filled.map((l) => ({
          itemId: l.itemId,
          currentQty: Number(l.currentQty),
          newQty: Number(l.newQty),
          unitCostBase: Number(l.unitCostBase),
          unitCostCCY: Number(l.unitCostCCY),
        })),
      });
      toast.success('Stock adjustment created.');
      setLines([emptyLine()]);
      setNotes('');
      await load();
    } catch (error) {
      console.error('Failed to create adjustment', error);
      toast.error(
        (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          'Failed to create adjustment.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (id: string) => {
    try {
      await inventoryApi.postAdjustment(id);
      toast.success('Stock adjustment posted.');
      await load();
    } catch (error) {
      console.error('Failed to post adjustment', error);
      toast.error(
        (error as any)?.response?.data?.error?.message ||
          (error as any)?.response?.data?.message ||
          'Failed to post adjustment.'
      );
    }
  };

  const columns: ColumnDef<AdjLine>[] = [
    {
      id: 'item',
      label: 'Item',
      kind: 'custom',
      width: '300px',
      render: (line, index) => (
        <ItemSelector
          value={line.itemId}
          noBorder
          placeholder="Select item"
          trackInventoryOnly
          disabled={saving}
          onChange={(item) => {
            if (!item) {
              setLine(index, { itemId: '', itemCode: undefined, itemName: undefined, currentQty: 0, newQty: 0, unitCostBase: 0, unitCostCCY: 0 });
              return;
            }
            setLine(index, { itemId: item.id, itemCode: item.code, itemName: item.name, costCurrency: item.costCurrency });
            prefillLine(index, item.id, warehouseId);
          }}
        />
      ),
    } as ColumnDef<AdjLine>,
    { id: 'currentQty', label: 'Current Qty', kind: 'number', width: '120px', accessor: (l) => l.currentQty, setter: (v) => ({ currentQty: Number(v) }) },
    { id: 'newQty', label: 'New Qty', kind: 'number', width: '120px', accessor: (l) => l.newQty, setter: (v) => ({ newQty: Number(v) }) },
    { id: 'adjQty', label: 'Adj Qty', kind: 'computed', width: '110px', compute: (l) => Number(l.newQty) - Number(l.currentQty) },
    {
      id: 'unitCost',
      label: 'Unit Cost (Base)',
      kind: 'custom',
      width: '140px',
      align: 'right',
      render: (line, index) => (
        <input
          type="number"
          min={0}
          step="any"
          disabled={saving}
          className="w-full bg-transparent text-right text-xs outline-none"
          value={line.unitCostBase || ''}
          placeholder="0.00"
          onChange={(e) => {
            const newBase = Number(e.target.value) || 0;
            const ratio = line.unitCostBase > 0 && line.unitCostCCY > 0 ? line.unitCostCCY / line.unitCostBase : 1;
            setLine(index, { unitCostBase: newBase, unitCostCCY: newBase * ratio });
          }}
        />
      ),
    },
    { id: 'adjValue', label: 'Adj Value', kind: 'computed', width: '130px', compute: (l) => Math.abs(Number(l.newQty) - Number(l.currentQty)) * Number(l.unitCostBase) },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-slate-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Stock Adjustments</h1>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Warehouse</label>
            <WarehouseSelector value={warehouseId} onChange={(wh) => onWarehouseChange(wh?.id || '')} placeholder="Select Warehouse" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Adjustment Date</label>
            <DatePicker value={date} onChange={(val) => setDate(val)} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Reason</label>
            <select
              className="h-9 w-full rounded border border-slate-300 px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Notes</label>
            <input
              className="h-9 w-full rounded border border-slate-300 px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="mt-4">
          <ClassicLineItemsTable<AdjLine>
            tableId="inventory.adjustment.lines"
            title="Adjustment Lines"
            columns={columns}
            rows={lines}
            disabled={saving}
            onRowChange={setLine}
            onRowRemove={(i) => setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
            onRowsChange={setLines}
            createEmptyRow={emptyLine}
            getRowKey={(l) => l._key}
            isRowFilled={(l) => Boolean(l.itemId)}
            onRowAdd={() => setLines((prev) => [...prev, emptyLine()])}
            addLabel="Add Item"
            minTableWidth="900px"
          />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Total adjustment value: <span className="font-bold text-slate-900 dark:text-slate-100">{totalValue.toFixed(2)}</span>
          </div>
          <button
            className="rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Create Adjustment'}
          </button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Recent Adjustments</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
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
                <tr key={adjustment.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2">{adjustment.date}</td>
                  <td className="py-2">{adjustment.warehouseId}</td>
                  <td className="py-2">{adjustment.reason}</td>
                  <td className="py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(adjustment.status)}`}>
                      {adjustment.status}
                    </span>
                  </td>
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
              {adjustments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">No adjustments yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default StockAdjustmentPage;
