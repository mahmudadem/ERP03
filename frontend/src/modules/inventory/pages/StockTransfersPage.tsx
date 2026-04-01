import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import {
  InventoryItemDTO,
  InventoryWarehouseDTO,
  StockMovementDTO,
  StockTransferDTO,
  inventoryApi,
} from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

interface DraftLine {
  itemId: string;
  qty: number;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const StockTransfersPage: React.FC = () => {
  const [transfers, setTransfers] = useState<StockTransferDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'COMPLETED'>('ALL');
  const [loading, setLoading] = useState(false);

  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [lineItemId, setLineItemId] = useState('');
  const [lineQty, setLineQty] = useState(1);
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [expandedTransferId, setExpandedTransferId] = useState<string | null>(null);
  const [transferMovements, setTransferMovements] = useState<Record<string, StockMovementDTO[]>>({});

  const load = async () => {
    try {
      setLoading(true);
      const [transferRes, warehouseRes, itemRes] = await Promise.all([
        inventoryApi.listTransfers(statusFilter === 'ALL' ? undefined : statusFilter),
        inventoryApi.listWarehouses({ active: true, limit: 500 }),
        inventoryApi.listItems({ active: true, limit: 500 }),
      ]);

      setTransfers(unwrap<StockTransferDTO[]>(transferRes) || []);
      setWarehouses(unwrap<InventoryWarehouseDTO[]>(warehouseRes) || []);
      setItems((unwrap<InventoryItemDTO[]>(itemRes) || []).filter((item) => item.trackInventory));
    } catch (error) {
      console.error('Failed to load stock transfers', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const addLine = () => {
    if (!lineItemId || lineQty <= 0) return;
    setLines((prev) => [...prev, { itemId: lineItemId, qty: lineQty }]);
    setLineItemId('');
    setLineQty(1);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWarehouseId || !destinationWarehouseId || lines.length === 0) {
      return;
    }

    try {
      await inventoryApi.createTransfer({
        sourceWarehouseId,
        destinationWarehouseId,
        date,
        notes: notes || undefined,
        lines,
      });

      setLines([]);
      setNotes('');
      setDate(todayIso());
      await load();
    } catch (error) {
      console.error('Failed to create stock transfer', error);
    }
  };

  const handleCompleteTransfer = async (id: string) => {
    try {
      await inventoryApi.completeTransfer(id);
      await load();
    } catch (error) {
      console.error('Failed to complete stock transfer', error);
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
        const movementRes = await inventoryApi.getMovements({
          referenceType: 'STOCK_TRANSFER',
          referenceId: transferId,
          limit: 200,
        });
        setTransferMovements((prev) => ({
          ...prev,
          [transferId]: unwrap<StockMovementDTO[]>(movementRes) || [],
        }));
      } catch (error) {
        console.error('Failed to load transfer movements', error);
      }
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Stock Transfers</h1>

      <Card className="p-6">
        <form className="space-y-4" onSubmit={handleCreateTransfer}>
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={sourceWarehouseId}
              onChange={(e) => setSourceWarehouseId(e.target.value)}
              required
            >
              <option value="">Source warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>

            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={destinationWarehouseId}
              onChange={(e) => setDestinationWarehouseId(e.target.value)}
              required
            >
              <option value="">Destination warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>

            <input
              type="date"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />

            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lineItemId}
              onChange={(e) => setLineItemId(e.target.value)}
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0.000001}
              step="any"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={lineQty}
              onChange={(e) => setLineQty(Number(e.target.value))}
            />
            <button
              type="button"
              className="rounded bg-slate-700 px-3 py-2 text-sm text-white"
              onClick={addLine}
            >
              Add Line
            </button>
            <button
              type="submit"
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              disabled={lines.length === 0}
            >
              Create Transfer
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.itemId}_${index}`} className="border-b border-slate-100">
                    <td className="py-2">{line.itemId}</td>
                    <td className="py-2 text-right">{line.qty}</td>
                    <td className="py-2 text-right">
                      <button
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                        type="button"
                        onClick={() => removeLine(index)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td className="py-2 text-slate-500" colSpan={3}>
                      No lines added.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'DRAFT' | 'COMPLETED')}
          >
            <option value="ALL">ALL</option>
            <option value="DRAFT">DRAFT</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
          <button className="rounded bg-slate-700 px-3 py-2 text-sm text-white" onClick={load} type="button">
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-left">Source</th>
                <th className="py-2 text-left">Destination</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Pair ID</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => (
                <React.Fragment key={transfer.id}>
                  <tr className="border-b border-slate-100">
                    <td className="py-2">{transfer.date}</td>
                    <td className="py-2">{transfer.sourceWarehouseId}</td>
                    <td className="py-2">{transfer.destinationWarehouseId}</td>
                    <td className="py-2">{transfer.status}</td>
                    <td className="py-2">{transfer.transferPairId}</td>
                    <td className="py-2 text-right space-x-2">
                      {transfer.status === 'DRAFT' && (
                        <button
                          className="rounded bg-blue-600 px-3 py-1 text-xs text-white"
                          onClick={() => handleCompleteTransfer(transfer.id)}
                        >
                          Complete
                        </button>
                      )}
                      <button
                        className="rounded border border-slate-300 px-3 py-1 text-xs"
                        onClick={() => toggleDetails(transfer.id)}
                      >
                        {expandedTransferId === transfer.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </tr>

                  {expandedTransferId === transfer.id && (
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td className="py-3" colSpan={6}>
                        <div className="space-y-4">
                          <div>
                            <div className="mb-1 text-sm font-semibold">Transfer Lines</div>
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="py-1 text-left">Item</th>
                                  <th className="py-1 text-right">Qty</th>
                                  <th className="py-1 text-right">Unit Cost Base</th>
                                  <th className="py-1 text-right">Unit Cost CCY</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transfer.lines.map((line, index) => (
                                  <tr key={`${transfer.id}_line_${index}`} className="border-b border-slate-100">
                                    <td className="py-1">{line.itemId}</td>
                                    <td className="py-1 text-right">{line.qty}</td>
                                    <td className="py-1 text-right">{line.unitCostBaseAtTransfer.toFixed(2)}</td>
                                    <td className="py-1 text-right">{line.unitCostCCYAtTransfer.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div>
                            <div className="mb-1 text-sm font-semibold">Paired Movements</div>
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="py-1 text-left">Movement ID</th>
                                  <th className="py-1 text-left">Type</th>
                                  <th className="py-1 text-left">Warehouse</th>
                                  <th className="py-1 text-right">Qty</th>
                                  <th className="py-1 text-right">Unit Cost Base</th>
                                  <th className="py-1 text-left">Pair ID</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(transferMovements[transfer.id] || []).map((movement) => (
                                  <tr key={movement.id} className="border-b border-slate-100">
                                    <td className="py-1">{movement.id}</td>
                                    <td className="py-1">{movement.movementType}</td>
                                    <td className="py-1">{movement.warehouseId}</td>
                                    <td className="py-1 text-right">{movement.qty}</td>
                                    <td className="py-1 text-right">{movement.unitCostBase.toFixed(2)}</td>
                                    <td className="py-1">{movement.transferPairId || '-'}</td>
                                  </tr>
                                ))}
                                {(transferMovements[transfer.id] || []).length === 0 && (
                                  <tr>
                                    <td className="py-1 text-slate-500" colSpan={6}>
                                      No movements found yet.
                                    </td>
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
                  <td className="py-3 text-slate-500" colSpan={6}>
                    {loading ? 'Loading...' : 'No transfers found.'}
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

export default StockTransfersPage;
