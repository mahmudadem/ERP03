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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('common');
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
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('inventory.itemMovement.filters.item', { defaultValue: 'Item' })}</label>
          <ItemSelector
            value={itemId}
            trackInventoryOnly
            onChange={(item) => setItemId(item?.id || '')}
            placeholder={t('inventory.itemMovement.filters.selectTrackedItem', { defaultValue: 'Select tracked item' })}
          />
        </div>
        <div className="md:col-span-6 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('inventory.itemMovement.filters.warehouse', { defaultValue: 'Warehouse' })}</label>
          <WarehouseSelector
            value={warehouseId}
            onChange={(warehouse) => setWarehouseId(warehouse?.id || '')}
            placeholder={t('inventory.itemMovement.filters.allWarehouses', { defaultValue: 'All warehouses' })}
          />
        </div>
        <div className="md:col-span-3 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('inventory.itemMovement.filters.from', { defaultValue: 'From' })}</label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full" />
        </div>
        <div className="md:col-span-3 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('inventory.itemMovement.filters.to', { defaultValue: 'To' })}</label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full" />
        </div>
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('inventory.itemMovement.filters.direction', { defaultValue: 'Direction' })}</label>
          <select value={direction} onChange={(event) => setDirection(event.target.value as DirectionFilter)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50">
            <option value="ALL">{t('inventory.itemMovement.direction.all', { defaultValue: 'All' })}</option>
            <option value="IN">{t('inventory.itemMovement.direction.in', { defaultValue: 'In' })}</option>
            <option value="OUT">{t('inventory.itemMovement.direction.out', { defaultValue: 'Out' })}</option>
          </select>
        </div>
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('inventory.itemMovement.filters.movementType', { defaultValue: 'Movement Type' })}</label>
          <select value={movementType} onChange={(event) => setMovementType(event.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50">
            <option value="">{t('inventory.itemMovement.direction.all', { defaultValue: 'All' })}</option>
            <option value="OPENING_STOCK">{t('inventory.itemMovement.movementType.OPENING_STOCK', { defaultValue: 'Opening' })}</option>
            <option value="PURCHASE_RECEIPT">{t('inventory.itemMovement.movementType.PURCHASE_RECEIPT', { defaultValue: 'Purchase receipt' })}</option>
            <option value="SALES_DELIVERY">{t('inventory.itemMovement.movementType.SALES_DELIVERY', { defaultValue: 'Sales delivery' })}</option>
            <option value="ADJUSTMENT_IN">{t('inventory.itemMovement.movementType.ADJUSTMENT_IN', { defaultValue: 'Adjustment in' })}</option>
            <option value="ADJUSTMENT_OUT">{t('inventory.itemMovement.movementType.ADJUSTMENT_OUT', { defaultValue: 'Adjustment out' })}</option>
            <option value="TRANSFER_IN">{t('inventory.itemMovement.movementType.TRANSFER_IN', { defaultValue: 'Transfer in' })}</option>
            <option value="TRANSFER_OUT">{t('inventory.itemMovement.movementType.TRANSFER_OUT', { defaultValue: 'Transfer out' })}</option>
            <option value="RETURN_IN">{t('inventory.itemMovement.movementType.RETURN_IN', { defaultValue: 'Return in' })}</option>
            <option value="RETURN_OUT">{t('inventory.itemMovement.movementType.RETURN_OUT', { defaultValue: 'Return out' })}</option>
          </select>
        </div>
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('inventory.itemMovement.filters.sourceType', { defaultValue: 'Source Type' })}</label>
          <select value={referenceType} onChange={(event) => setReferenceType(event.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50">
            <option value="">{t('inventory.itemMovement.direction.all', { defaultValue: 'All' })}</option>
            <option value="PURCHASE_INVOICE">{t('inventory.itemMovement.sourceType.PURCHASE_INVOICE', { defaultValue: 'Purchase Invoice' })}</option>
            <option value="GOODS_RECEIPT">{t('inventory.itemMovement.sourceType.GOODS_RECEIPT', { defaultValue: 'Goods Receipt' })}</option>
            <option value="PURCHASE_RETURN">{t('inventory.itemMovement.sourceType.PURCHASE_RETURN', { defaultValue: 'Purchase Return' })}</option>
            <option value="SALES_INVOICE">{t('inventory.itemMovement.sourceType.SALES_INVOICE', { defaultValue: 'Sales Invoice' })}</option>
            <option value="DELIVERY_NOTE">{t('inventory.itemMovement.sourceType.DELIVERY_NOTE', { defaultValue: 'Delivery Note' })}</option>
            <option value="SALES_RETURN">{t('inventory.itemMovement.sourceType.SALES_RETURN', { defaultValue: 'Sales Return' })}</option>
            <option value="STOCK_ADJUSTMENT">{t('inventory.itemMovement.sourceType.STOCK_ADJUSTMENT', { defaultValue: 'Stock Adjustment' })}</option>
            <option value="STOCK_TRANSFER">{t('inventory.itemMovement.sourceType.STOCK_TRANSFER', { defaultValue: 'Stock Transfer' })}</option>
            <option value="OPENING">{t('inventory.itemMovement.sourceType.OPENING', { defaultValue: 'Opening' })}</option>
            <option value="POS_DIRECT_SALE">{t('inventory.itemMovement.sourceType.POS_DIRECT_SALE', { defaultValue: 'POS Sale' })}</option>
            <option value="POS_RETURN">{t('inventory.itemMovement.sourceType.POS_RETURN', { defaultValue: 'POS Return' })}</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button type="submit" disabled={!itemId} className="bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-xl disabled:opacity-50">
          <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            {t('common.generate', { defaultValue: 'Generate Report' })}
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
  const { t } = useTranslation('common');
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
        setError(err?.message || t('inventory.itemMovement.loadFailed', { defaultValue: 'Failed to load item movement report' }));
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
  const getMovementTypeLabel = (type?: string) =>
    type ? t(`inventory.itemMovement.movementType.${type}`, { defaultValue: type }) : '';
  const getSourceTypeLabel = (type?: string) =>
    type ? t(`inventory.itemMovement.sourceType.${type}`, { defaultValue: type }) : '';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-700 border border-amber-200 bg-amber-50 rounded-full px-2 py-1">
            {t('inventory.itemMovement.chips.item', { defaultValue: 'Item' })}: {item ? `${item.code} - ${item.name}` : params.itemId}
          </span>
          {params.warehouseId && (
            <span className="text-xs font-semibold text-slate-700 border border-emerald-200 bg-emerald-50 rounded-full px-2 py-1">
              {t('inventory.itemMovement.chips.warehouseShort', { defaultValue: 'WH' })}: {warehouseMap.get(params.warehouseId)?.name ?? params.warehouseId}
            </span>
          )}
          <span className="text-xs font-bold text-slate-500 ml-auto">
            {t('inventory.itemMovement.summary.movements', { defaultValue: 'Movements' })}: <span className="font-black text-slate-700">{rows.length}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
        {loading ? (
          <div className="bg-white border rounded-xl p-6 shadow-sm flex items-center justify-center min-h-[180px]">
            <div className="text-center">
              <Spinner size="lg" variant="slate" className="mx-auto mb-3" />
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{t('inventory.itemMovement.loading', { defaultValue: 'Loading item movement...' })}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                <tr>
                  <th className={`${cellPad} text-left`}>{t('inventory.itemMovement.columns.date', { defaultValue: 'Date' })}</th>
                  <th className={`${cellPad} text-left`}>{t('inventory.itemMovement.columns.warehouse', { defaultValue: 'Warehouse' })}</th>
                  <th className={`${cellPad} text-left`}>{t('inventory.itemMovement.columns.movement', { defaultValue: 'Movement' })}</th>
                  <th className={`${cellPad} text-left`}>{t('inventory.itemMovement.columns.source', { defaultValue: 'Source' })}</th>
                  <th className={`${cellPad} text-right`}>{t('inventory.itemMovement.columns.qtyIn', { defaultValue: 'Qty In' })}</th>
                  <th className={`${cellPad} text-right`}>{t('inventory.itemMovement.columns.qtyOut', { defaultValue: 'Qty Out' })}</th>
                  <th className={`${cellPad} text-right`}>{t('inventory.itemMovement.columns.runningQty', { defaultValue: 'Running Qty' })}</th>
                  <th className={`${cellPad} text-right`}>{t('inventory.itemMovement.columns.unitCost', { defaultValue: 'Unit Cost' })}</th>
                  <th className={`${cellPad} text-right`}>{t('inventory.itemMovement.columns.movementValue', { defaultValue: 'Movement Value' })}</th>
                  <th className={`${cellPad} text-right`}>{t('inventory.itemMovement.columns.runningValue', { defaultValue: 'Running Value' })}</th>
                  <th className={`${cellPad} text-left`}>{t('inventory.itemMovement.columns.createdBy', { defaultValue: 'Created By' })}</th>
                  <th className={`${cellPad} text-left`}>{t('inventory.itemMovement.columns.notes', { defaultValue: 'Notes' })}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-20 text-center text-sm text-slate-500">
                      {t('inventory.itemMovement.empty', { defaultValue: 'No item movements match the filters.' })}
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
                        <td className={cellPad}>{getMovementTypeLabel(movement.movementType)}</td>
                        <td className={cellPad}>
                          {path ? (
                            <button
                              type="button"
                              onClick={() => navigate(path)}
                              className="inline-flex items-center gap-1 text-slate-900 font-semibold hover:underline"
                            >
                              {getSourceTypeLabel(movement.referenceType)} {movement.referenceId}
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          ) : (
                            <span>{getSourceTypeLabel(movement.referenceType)} {movement.referenceId || ''}</span>
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

const ItemMovementReportPage: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <ReportContainer<ItemMovementParams>
      title={t('inventory.itemMovement.title', { defaultValue: 'Item Movement' })}
      subtitle={t('inventory.itemMovement.subtitle', { defaultValue: 'Historical movement ledger with running quantity and value' })}
      initiator={Initiator}
      ReportContent={ReportContent}
      config={{ paginated: true, defaultPageSize: 50 }}
    />
  );
};

export default ItemMovementReportPage;
