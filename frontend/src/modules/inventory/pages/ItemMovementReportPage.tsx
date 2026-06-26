import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  InventoryItemDTO,
  InventoryWarehouseDTO,
  StockMovementDTO,
  inventoryApi,
} from '../../../api/inventoryApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { ItemSelector, WarehouseSelector } from '../../../components/shared/selectors';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { Spinner } from '../../../components/ui/Spinner';

type DirectionFilter = 'ALL' | 'IN' | 'OUT';

interface ItemMovementParams {
  itemId: string;
  warehouseId?: string;
  fromDate?: string;
  toDate?: string;
  movementType?: string;
  referenceType?: string;
  direction: DirectionFilter;
}

interface MovementRow extends StockMovementDTO {
  runningQty: number;
  runningValueBase: number;
}

const fmt = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQty = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const sourcePath = (movement: StockMovementDTO): string | null => {
  if (!movement.referenceId) return null;
  const id = encodeURIComponent(movement.referenceId);
  switch (movement.referenceType) {
    case 'PURCHASE_INVOICE':
      return `/purchases/invoices/${id}`;
    case 'GOODS_RECEIPT':
      return `/purchases/goods-receipts/${id}`;
    case 'PURCHASE_RETURN':
      return `/purchases/returns/${id}`;
    case 'SALES_INVOICE':
      return `/sales/invoices/${id}`;
    case 'DELIVERY_NOTE':
      return `/sales/delivery-notes/${id}`;
    case 'SALES_RETURN':
      return `/sales/returns/${id}`;
    case 'STOCK_ADJUSTMENT':
      return `/inventory/adjustments/${id}`;
    case 'OPENING':
      return `/inventory/opening-stock/${id}`;
    default:
      return null;
  }
};

const Initiator: React.FC<{
  onSubmit: (params: ItemMovementParams) => void;
  initialParams?: ItemMovementParams | null;
}> = ({ onSubmit, initialParams }) => {
  const [itemId, setItemId] = useState(initialParams?.itemId || '');
  const [warehouseId, setWarehouseId] = useState(initialParams?.warehouseId || '');
  const [fromDate, setFromDate] = useState(initialParams?.fromDate || '');
  const [toDate, setToDate] = useState(initialParams?.toDate || '');
  const [movementType, setMovementType] = useState(initialParams?.movementType || '');
  const [referenceType, setReferenceType] = useState(initialParams?.referenceType || '');
  const [direction, setDirection] = useState<DirectionFilter>(initialParams?.direction || 'ALL');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!itemId) return;
        onSubmit({
          itemId,
          warehouseId: warehouseId || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          movementType: movementType || undefined,
          referenceType: referenceType || undefined,
          direction,
        });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        <div className="md:col-span-12 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Item</label>
          <ItemSelector
            value={itemId}
            trackInventoryOnly
            onChange={(item) => setItemId(item?.id || '')}
            placeholder="Select tracked item"
          />
        </div>
        <div className="md:col-span-6 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Warehouse</label>
          <WarehouseSelector
            value={warehouseId}
            onChange={(warehouse) => setWarehouseId(warehouse?.id || '')}
            placeholder="All warehouses"
          />
        </div>
        <div className="md:col-span-3 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">From</label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full" />
        </div>
        <div className="md:col-span-3 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">To</label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full" />
        </div>
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Direction</label>
          <select value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50">
            <option value="ALL">All</option>
            <option value="IN">In</option>
            <option value="OUT">Out</option>
          </select>
        </div>
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Movement Type</label>
          <select value={movementType} onChange={(event) => setMovementType(event.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50">
            <option value="">All</option>
            <option value="OPENING_STOCK">Opening</option>
            <option value="PURCHASE_RECEIPT">Purchase receipt</option>
            <option value="SALES_DELIVERY">Sales delivery</option>
            <option value="ADJUSTMENT_IN">Adjustment in</option>
            <option value="ADJUSTMENT_OUT">Adjustment out</option>
            <option value="TRANSFER_IN">Transfer in</option>
            <option value="TRANSFER_OUT">Transfer out</option>
            <option value="RETURN_IN">Return in</option>
            <option value="RETURN_OUT">Return out</option>
          </select>
        </div>
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Source Type</label>
          <select value={referenceType} onChange={(event) => setReferenceType(event.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50">
            <option value="">All</option>
            <option value="PURCHASE_INVOICE">Purchase Invoice</option>
            <option value="GOODS_RECEIPT">Goods Receipt</option>
            <option value="PURCHASE_RETURN">Purchase Return</option>
            <option value="SALES_INVOICE">Sales Invoice</option>
            <option value="DELIVERY_NOTE">Delivery Note</option>
            <option value="SALES_RETURN">Sales Return</option>
            <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
            <option value="STOCK_TRANSFER">Stock Transfer</option>
            <option value="OPENING">Opening</option>
            <option value="POS_DIRECT_SALE">POS Sale</option>
            <option value="POS_RETURN">POS Return</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button type="submit" disabled={!itemId} className="bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-xl disabled:opacity-50">
          <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            Generate Report
            <ChevronRight className="w-4 h-4" />
          </span>
        </Button>
      </div>
    </form>
  );
};

const ReportContent: React.FC<{
  params: ItemMovementParams;
  pagination?: {
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    totalItems: number;
  };
  setTotalItems?: (total: number) => void;
  density?: 'compact' | 'comfortable';
}> = ({ params, pagination, setTotalItems, density }) => {
  const navigate = useNavigate();
  const [movements, setMovements] = useState<StockMovementDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      inventoryApi.getMovements({
        itemId: params.itemId,
        warehouseId: params.warehouseId,
        from: params.fromDate,
        to: params.toDate,
        limit: 5000,
      }),
      inventoryApi.listItems({ active: true, limit: 1000 }),
      inventoryApi.listWarehouses({ active: true, limit: 300 }),
    ])
      .then(([nextMovements, nextItems, nextWarehouses]) => {
        if (cancelled) return;
        setMovements(nextMovements);
        setItems(nextItems);
        setWarehouses(nextWarehouses);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load item movement report');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.itemId, params.warehouseId, params.fromDate, params.toDate]);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const warehouseMap = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);

  const rows = useMemo<MovementRow[]>(() => {
    const filtered = movements
      .filter((movement) => !params.fromDate || movement.date >= params.fromDate)
      .filter((movement) => !params.toDate || movement.date <= params.toDate)
      .filter((movement) => params.direction === 'ALL' || movement.direction === params.direction)
      .filter((movement) => !params.movementType || movement.movementType === params.movementType)
      .filter((movement) => !params.referenceType || movement.referenceType === params.referenceType)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.postingSeq !== b.postingSeq) return a.postingSeq - b.postingSeq;
        return a.id.localeCompare(b.id);
      });

    let runningQty = 0;
    let runningValueBase = 0;
    return filtered.map((movement) => {
      const qtyDelta = movement.direction === 'IN' ? movement.qty : -movement.qty;
      const valueDelta = movement.direction === 'IN' ? movement.totalCostBase : -movement.totalCostBase;
      runningQty += qtyDelta;
      runningValueBase += valueDelta;
      return {
        ...movement,
        runningQty,
        runningValueBase,
      };
    });
  }, [movements, params.direction, params.movementType, params.referenceType]);

  useEffect(() => {
    setTotalItems?.(rows.length);
  }, [rows.length, setTotalItems]);

  const pagedRows = useMemo(() => {
    if (!pagination) return rows;
    const start = (pagination.page - 1) * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [pagination, rows]);

  const item = itemMap.get(params.itemId);
  const cellPad = density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-4';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-700 border border-amber-200 bg-amber-50 rounded-full px-2 py-1">
            Item: {item ? `${item.code} - ${item.name}` : params.itemId}
          </span>
          {params.warehouseId && (
            <span className="text-xs font-semibold text-slate-700 border border-emerald-200 bg-emerald-50 rounded-full px-2 py-1">
              WH: {warehouseMap.get(params.warehouseId)?.name ?? params.warehouseId}
            </span>
          )}
          <span className="text-xs font-bold text-slate-500 ml-auto">
            Movements: <span className="font-black text-slate-700">{rows.length}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
        {loading ? (
          <div className="bg-white border rounded-xl p-6 shadow-sm flex items-center justify-center min-h-[180px]">
            <div className="text-center">
              <Spinner size="lg" variant="slate" className="mx-auto mb-3" />
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Loading item movement...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                <tr>
                  <th className={`${cellPad} text-left`}>Date</th>
                  <th className={`${cellPad} text-left`}>Warehouse</th>
                  <th className={`${cellPad} text-left`}>Movement</th>
                  <th className={`${cellPad} text-left`}>Source</th>
                  <th className={`${cellPad} text-right`}>Qty In</th>
                  <th className={`${cellPad} text-right`}>Qty Out</th>
                  <th className={`${cellPad} text-right`}>Running Qty</th>
                  <th className={`${cellPad} text-right`}>Unit Cost</th>
                  <th className={`${cellPad} text-right`}>Movement Value</th>
                  <th className={`${cellPad} text-right`}>Running Value</th>
                  <th className={`${cellPad} text-left`}>Created By</th>
                  <th className={`${cellPad} text-left`}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-20 text-center text-sm text-slate-500">
                      No item movements match the filters.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((movement) => {
                    const warehouse = warehouseMap.get(movement.warehouseId);
                    const path = sourcePath(movement);
                    return (
                      <tr key={movement.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                        <td className={cellPad}>{movement.date}</td>
                        <td className={cellPad}>{warehouse ? `${warehouse.code} - ${warehouse.name}` : movement.warehouseId}</td>
                        <td className={cellPad}>{movement.movementType}</td>
                        <td className={cellPad}>
                          {path ? (
                            <button
                              type="button"
                              onClick={() => navigate(path)}
                              className="inline-flex items-center gap-1 text-slate-900 font-semibold hover:underline"
                            >
                              {movement.referenceType} {movement.referenceId}
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          ) : (
                            <span>{movement.referenceType} {movement.referenceId || ''}</span>
                          )}
                        </td>
                        <td className={`${cellPad} text-right tabular-nums text-emerald-700`}>{movement.direction === 'IN' ? fmtQty(movement.qty) : ''}</td>
                        <td className={`${cellPad} text-right tabular-nums text-red-700`}>{movement.direction === 'OUT' ? fmtQty(movement.qty) : ''}</td>
                        <td className={`${cellPad} text-right tabular-nums font-semibold`}>{fmtQty(movement.runningQty)}</td>
                        <td className={`${cellPad} text-right tabular-nums`}>{fmt(movement.unitCostBase)}</td>
                        <td className={`${cellPad} text-right tabular-nums`}>{fmt(movement.direction === 'IN' ? movement.totalCostBase : -movement.totalCostBase)}</td>
                        <td className={`${cellPad} text-right tabular-nums font-bold ${movement.runningValueBase < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(movement.runningValueBase)}</td>
                        <td className={cellPad}>{movement.createdBy}</td>
                        <td className={cellPad}>{movement.notes || ''}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const ItemMovementReportPage: React.FC = () => (
  <ReportContainer<ItemMovementParams>
    title="Item Movement"
    subtitle="Historical movement ledger with running quantity and value"
    initiator={Initiator}
    ReportContent={ReportContent}
    config={{ paginated: true, defaultPageSize: 50 }}
  />
);

export default ItemMovementReportPage;
