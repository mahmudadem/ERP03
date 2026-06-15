import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeftRight } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DatePicker, WarehouseSelector, ItemSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import {
  InventoryWarehouseDTO,
  StockLevelDTO,
  StockMovementDTO,
  StockTransferDTO,
  inventoryApi,
} from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type TransferMode = 'FLAT' | 'VALUED';

interface TLine {
  _key: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  qty: number;
  sourceCostBase: number;
  sourceCostCCY: number;
  landedCostBase: number;
  landedCostCCY: number;
}

let keySeq = 0;
const newKey = () => `trfln_${Date.now()}_${keySeq++}`;
const emptyLine = (): TLine => ({
  _key: newKey(),
  itemId: '',
  qty: 1,
  sourceCostBase: 0,
  sourceCostCCY: 0,
  landedCostBase: 0,
  landedCostCCY: 0,
});

const todayIso = () => new Date().toISOString().slice(0, 10);

const StockTransfersPage: React.FC = () => {
  const [transfers, setTransfers] = useState<StockTransferDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'COMPLETED'>('ALL');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<TransferMode>('FLAT');
  const [lines, setLines] = useState<TLine[]>([emptyLine()]);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<null | {
    kind: 'delete-draft' | 'complete' | 'undo';
    transfer: StockTransferDTO;
  }>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [expandedTransferId, setExpandedTransferId] = useState<string | null>(null);
  const [transferMovements, setTransferMovements] = useState<Record<string, StockMovementDTO[]>>({});

  const warehouseLabel = useMemo(
    () => warehouses.reduce<Record<string, string>>((acc, w) => { acc[w.id] = `${w.code} - ${w.name}`; return acc; }, {}),
    [warehouses]
  );

  const load = async () => {
    try {
      setLoading(true);
      const [transferRes, warehouseRes] = await Promise.all([
        inventoryApi.listTransfers(statusFilter === 'ALL' ? undefined : statusFilter),
        inventoryApi.listWarehouses({ active: true, limit: 500 }),
      ]);
      setTransfers(unwrap<StockTransferDTO[]>(transferRes) || []);
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(warehouseRes) || []);
    } catch (error) {
      console.error('Failed to load stock transfers', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLevel = async (itemId: string, whId: string): Promise<StockLevelDTO | null> => {
    if (!itemId || !whId) return null;
    try {
      const res = await inventoryApi.getStockLevels({ itemId, warehouseId: whId, limit: 1 });
      return (unwrap<StockLevelDTO[]>(res) || [])[0] || null;
    } catch {
      return null;
    }
  };

  const setLine = (index: number, patch: Partial<TLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const prefillSourceCost = async (index: number, itemId: string, whId: string) => {
    const level = await fetchLevel(itemId, whId);
    const base = level?.avgCostBase ?? 0;
    const ccy = level?.avgCostCCY ?? 0;
    setLine(index, { sourceCostBase: base, sourceCostCCY: ccy, landedCostBase: base, landedCostCCY: ccy });
  };

  const onSourceWarehouseChange = async (whId: string) => {
    setSourceWarehouseId(whId);
    if (!whId) return;
    const updated = await Promise.all(
      lines.map(async (l) => {
        if (!l.itemId) return l;
        const level = await fetchLevel(l.itemId, whId);
        const base = level?.avgCostBase ?? 0;
        const ccy = level?.avgCostCCY ?? 0;
        return { ...l, sourceCostBase: base, sourceCostCCY: ccy, landedCostBase: base, landedCostCCY: ccy };
      })
    );
    setLines(updated);
  };

  const resetForm = () => {
    setEditingTransferId(null);
    setSourceWarehouseId('');
    setDestinationWarehouseId('');
    setDate(todayIso());
    setNotes('');
    setMode('FLAT');
    setLines([emptyLine()]);
  };

  const loadTransferForEdit = (transfer: StockTransferDTO) => {
    if (transfer.status !== 'DRAFT') {
      toast.error('Only draft transfers can be edited.');
      return;
    }
    setEditingTransferId(transfer.id);
    setSourceWarehouseId(transfer.sourceWarehouseId);
    setDestinationWarehouseId(transfer.destinationWarehouseId);
    setDate(transfer.date);
    setNotes(transfer.notes || '');
    setMode(transfer.mode || 'FLAT');
    setLines(transfer.lines.map((line) => ({
      _key: newKey(),
      itemId: line.itemId,
      qty: line.qty,
      sourceCostBase: line.unitCostBaseAtTransfer,
      sourceCostCCY: line.unitCostCCYAtTransfer,
      landedCostBase: line.unitCostBaseAtTransfer,
      landedCostCCY: line.unitCostCCYAtTransfer,
      ...(line.revaluationUnitCostBaseAtTransfer !== undefined
        ? {
            landedCostBase: line.revaluationUnitCostBaseAtTransfer,
            landedCostCCY: line.revaluationUnitCostCCYAtTransfer ?? line.revaluationUnitCostBaseAtTransfer,
          }
        : {}),
    })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveTransfer = async () => {
    const filled = lines.filter((l) => l.itemId && l.qty > 0);
    if (!sourceWarehouseId || !destinationWarehouseId) {
      toast.error('Source and destination warehouses are required.');
      return;
    }
    if (sourceWarehouseId === destinationWarehouseId) {
      toast.error('Source and destination must be different.');
      return;
    }
    if (filled.length === 0) {
      toast.error('Add at least one item line.');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        sourceWarehouseId,
        destinationWarehouseId,
        date,
        notes: notes || undefined,
        mode,
        lines: filled.map((l) =>
          mode === 'VALUED'
            ? {
                itemId: l.itemId,
                qty: Number(l.qty),
                revaluationUnitCostBaseAtTransfer: Number(l.landedCostBase),
                revaluationUnitCostCCYAtTransfer: Number(l.landedCostCCY),
              }
            : { itemId: l.itemId, qty: Number(l.qty) }
        ),
      };
      if (editingTransferId) {
        await inventoryApi.updateTransfer(editingTransferId, payload);
        toast.success('Draft transfer updated.');
      } else {
        await inventoryApi.createTransfer(payload);
        toast.success('Stock transfer created.');
      }
      resetForm();
      await load();
    } catch (error) {
      console.error('Failed to save stock transfer', error);
      toast.error((error as any)?.response?.data?.error?.message || 'Failed to save stock transfer.');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTransfer = async (id: string) => {
    try {
      await inventoryApi.completeTransfer(id);
      toast.success('Stock transfer completed.');
      await load();
    } catch (error) {
      console.error('Failed to complete stock transfer', error);
      toast.error((error as any)?.response?.data?.error?.message || 'Failed to complete stock transfer.');
    }
  };

  const handleCancelTransfer = async (id: string) => {
    try {
      await inventoryApi.cancelTransfer(id);
      toast.success('Draft transfer cancelled.');
      await load();
    } catch (error) {
      console.error('Failed to cancel stock transfer', error);
      toast.error((error as any)?.response?.data?.error?.message || 'Failed to cancel stock transfer.');
    }
  };

  const handleUndoTransfer = async (id: string) => {
    try {
      await inventoryApi.undoTransfer(id, todayIso());
      toast.success('Stock transfer undone with a linked reverse transfer.');
      await load();
    } catch (error) {
      console.error('Failed to undo stock transfer', error);
      toast.error((error as any)?.response?.data?.error?.message || 'Failed to undo stock transfer.');
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    try {
      setActionBusy(true);
      if (pendingAction.kind === 'delete-draft') {
        await handleCancelTransfer(pendingAction.transfer.id);
      } else if (pendingAction.kind === 'complete') {
        await handleCompleteTransfer(pendingAction.transfer.id);
      } else {
        await handleUndoTransfer(pendingAction.transfer.id);
      }
      setPendingAction(null);
    } finally {
      setActionBusy(false);
    }
  };

  const toggleDetails = async (transferId: string) => {
    if (expandedTransferId === transferId) {
      setExpandedTransferId(null);
      return;
    }
    setExpandedTransferId(transferId);
    if (!transferMovements[transferId]) {
      try {
        const movementRes = await inventoryApi.getMovements({ referenceType: 'STOCK_TRANSFER', referenceId: transferId, limit: 200 });
        setTransferMovements((prev) => ({ ...prev, [transferId]: unwrap<StockMovementDTO[]>(movementRes) || [] }));
      } catch (error) {
        console.error('Failed to load transfer movements', error);
      }
    }
  };

  const columns: ColumnDef<TLine>[] = [
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
              setLine(index, { itemId: '', itemCode: undefined, itemName: undefined, sourceCostBase: 0, sourceCostCCY: 0, landedCostBase: 0, landedCostCCY: 0 });
              return;
            }
            setLine(index, { itemId: item.id, itemCode: item.code, itemName: item.name });
            prefillSourceCost(index, item.id, sourceWarehouseId);
          }}
        />
      ),
    } as ColumnDef<TLine>,
    { id: 'qty', label: 'Qty', kind: 'number', width: '120px', accessor: (l) => l.qty, setter: (v) => ({ qty: Number(v) }) },
    ...(mode === 'VALUED'
      ? [
          { id: 'sourceCost', label: 'Source Cost', kind: 'computed', width: '120px', compute: (l: TLine) => l.sourceCostBase } as ColumnDef<TLine>,
          {
            id: 'landedCost',
            label: 'Revaluation Unit Cost',
            kind: 'custom',
            width: '150px',
            align: 'right',
            render: (line, index) => (
              <input
                type="number"
                min={0}
                step="any"
                disabled={saving}
                className="w-full bg-transparent text-right text-xs outline-none"
                value={line.landedCostBase || ''}
                placeholder="0.00"
                onChange={(e) => {
                  const base = Number(e.target.value) || 0;
                  const ratio = line.landedCostBase > 0 && line.landedCostCCY > 0 ? line.landedCostCCY / line.landedCostBase : 1;
                  setLine(index, { landedCostBase: base, landedCostCCY: base * ratio });
                }}
              />
            ),
          } as ColumnDef<TLine>,
          { id: 'variance', label: 'Variance', kind: 'computed', width: '120px', compute: (l: TLine) => (Number(l.landedCostBase) - Number(l.sourceCostBase)) * Number(l.qty) } as ColumnDef<TLine>,
        ]
      : []),
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-6 w-6 text-slate-500" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Stock Transfers</h1>
      </div>

      <Card className="p-4">
        {editingTransferId && (
          <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
            Editing draft transfer. Posted transfers use Undo instead of direct edit.
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Source Warehouse</label>
            <WarehouseSelector value={sourceWarehouseId} onChange={(wh) => onSourceWarehouseChange(wh?.id || '')} placeholder="Source" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Destination Warehouse</label>
            <WarehouseSelector value={destinationWarehouseId} onChange={(wh) => setDestinationWarehouseId(wh?.id || '')} placeholder="Destination" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Date</label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Notes</label>
            <input className="h-9 w-full rounded border border-slate-300 px-2 text-xs dark:border-slate-700 dark:bg-slate-800" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Mode</label>
            <div className="inline-flex h-9 overflow-hidden rounded border border-slate-300 dark:border-slate-600">
              <button
                className={`px-3 text-xs ${mode === 'FLAT' ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                onClick={() => setMode('FLAT')}
                type="button"
              >
                Flat
              </button>
              <button
                className={`px-3 text-xs ${mode === 'VALUED' ? 'bg-slate-700 text-white' : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                onClick={() => setMode('VALUED')}
                type="button"
              >
                Valued
              </button>
            </div>
          </div>
        </div>

        <p className="mt-2 text-[10px] uppercase tracking-tighter text-slate-400">
          {mode === 'FLAT'
            ? 'Flat: move stock A→B at source cost. No ledger effect.'
            : 'Valued: explicit revaluation. The variance posts to the Inventory Revaluation account; freight/customs belong to added-cost transfer handling.'}
        </p>

        <div className="mt-3">
          <ClassicLineItemsTable<TLine>
            tableId="inventory.transfer.lines"
            title="Transfer Lines"
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
            minTableWidth={mode === 'VALUED' ? '900px' : '520px'}
          />
        </div>

        <div className="mt-4 flex justify-end border-t border-slate-200 pt-3 dark:border-slate-700">
          {editingTransferId && (
            <button
              className="mr-2 rounded border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={resetForm}
              disabled={saving}
              type="button"
            >
              Cancel Edit
            </button>
          )}
          <button
            className="rounded bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            onClick={handleSaveTransfer}
            disabled={saving}
          >
            {saving ? 'Saving…' : editingTransferId ? 'Save Draft' : 'Create Transfer'}
          </button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <select
            className="h-9 rounded border border-slate-300 px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'DRAFT' | 'COMPLETED')}
          >
            <option value="ALL">All</option>
            <option value="DRAFT">Draft</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <button className="h-9 rounded bg-slate-700 px-3 text-xs text-white" onClick={load} type="button">
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-left">Source</th>
                <th className="py-2 text-left">Destination</th>
                <th className="py-2 text-left">Mode</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">GL</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <React.Fragment key={transfer.id}>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2">{transfer.date}</td>
                    <td className="py-2">{warehouseLabel[transfer.sourceWarehouseId] || transfer.sourceWarehouseId}</td>
                    <td className="py-2">{warehouseLabel[transfer.destinationWarehouseId] || transfer.destinationWarehouseId}</td>
                    <td className="py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${transfer.mode === 'VALUED' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                        {transfer.mode || 'FLAT'}
                      </span>
                    </td>
                    <td className="py-2">{transfer.status}</td>
                    <td className="py-2">{transfer.voucherId ? '✓' : '—'}</td>
                    <td className="py-2 text-right space-x-2">
                      {transfer.status === 'DRAFT' && (
                        <>
                          <button className="rounded border border-slate-300 px-3 py-1 text-xs dark:border-slate-600" onClick={() => loadTransferForEdit(transfer)}>
                            Edit
                          </button>
                          <button className="rounded bg-blue-600 px-3 py-1 text-xs text-white" onClick={() => setPendingAction({ kind: 'complete', transfer })}>
                            Complete
                          </button>
                          <button className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/30" onClick={() => setPendingAction({ kind: 'delete-draft', transfer })}>
                            Delete
                          </button>
                        </>
                      )}
                      {transfer.status === 'COMPLETED' && !transfer.reversedByTransferId && !transfer.reversesTransferId && (
                        <button className="rounded border border-amber-300 px-3 py-1 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30" onClick={() => setPendingAction({ kind: 'undo', transfer })}>
                          Undo
                        </button>
                      )}
                      {transfer.reversedByTransferId && (
                        <span className="text-xs font-medium text-slate-500">Undone</span>
                      )}
                      {transfer.reversesTransferId && (
                        <span className="text-xs font-medium text-slate-500">Reversal</span>
                      )}
                      <button className="rounded border border-slate-300 px-3 py-1 text-xs dark:border-slate-600" onClick={() => toggleDetails(transfer.id)}>
                        {expandedTransferId === transfer.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>

                  {expandedTransferId === transfer.id && (
                    <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
                      <td className="py-3" colSpan={7}>
                        <div className="space-y-4">
                          <div>
                            <div className="mb-1 text-sm font-semibold">Transfer Lines</div>
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                  <th className="py-1 text-left">Item</th>
                                  <th className="py-1 text-right">Qty</th>
                                  <th className="py-1 text-right">Landed Unit Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transfer.lines.map((line, index) => (
                                  <tr key={`${transfer.id}_line_${index}`} className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="py-1">{line.itemId}</td>
                                    <td className="py-1 text-right">{line.qty}</td>
                                    <td className="py-1 text-right">{line.unitCostBaseAtTransfer.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div>
                            <div className="mb-1 text-sm font-semibold">Paired Movements</div>
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                  <th className="py-1 text-left">Type</th>
                                  <th className="py-1 text-left">Warehouse</th>
                                  <th className="py-1 text-right">Qty</th>
                                  <th className="py-1 text-right">Unit Cost Base</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(transferMovements[transfer.id] || []).map((movement) => (
                                  <tr key={movement.id} className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="py-1">{movement.movementType}</td>
                                    <td className="py-1">{warehouseLabel[movement.warehouseId] || movement.warehouseId}</td>
                                    <td className="py-1 text-right">{movement.qty}</td>
                                    <td className="py-1 text-right">{movement.unitCostBase.toFixed(2)}</td>
                                  </tr>
                                ))}
                                {(transferMovements[transfer.id] || []).length === 0 && (
                                  <tr>
                                    <td className="py-1 text-slate-500" colSpan={4}>No movements found yet.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td className="py-8 text-center text-slate-400" colSpan={7}>
                    {loading ? 'Loading…' : 'No transfers found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        isOpen={!!pendingAction}
        title={
          pendingAction?.kind === 'delete-draft'
            ? 'Delete draft transfer?'
            : pendingAction?.kind === 'complete'
              ? 'Complete transfer?'
              : 'Undo completed transfer?'
        }
        message={
          pendingAction?.kind === 'delete-draft'
            ? 'This removes the draft only. No stock or ledger entries are affected.'
            : pendingAction?.kind === 'complete'
              ? 'This will post the paired stock movements and any valued-transfer accounting entry.'
              : 'This creates and posts a linked reverse transfer. The original remains in history for audit.'
        }
        confirmLabel={
          pendingAction?.kind === 'delete-draft'
            ? 'Delete Draft'
            : pendingAction?.kind === 'complete'
              ? 'Complete'
              : 'Undo Transfer'
        }
        cancelLabel="Keep"
        tone={pendingAction?.kind === 'delete-draft' ? 'danger' : pendingAction?.kind === 'undo' ? 'warning' : 'info'}
        isConfirming={actionBusy}
        onConfirm={confirmPendingAction}
        onCancel={() => !actionBusy && setPendingAction(null)}
      />
    </div>
  );
};

export default StockTransfersPage;
