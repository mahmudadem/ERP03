import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Layers, TriangleAlert } from 'lucide-react';
import {
  InventoryItemDTO,
  InventoryWarehouseDTO,
  StockLevelDTO,
  inventoryApi,
} from '../../../api/inventoryApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { ItemSelector, WarehouseSelector } from '../../../components/shared/selectors';
import { Spinner } from '../../../components/ui/Spinner';

type ViewMode = 'byItem' | 'byWarehouse';

interface StockLevelParams {
  itemId?: string;
  warehouseId?: string;
  viewMode: ViewMode;
  includeZero: boolean;
  includeNegative: boolean;
}

interface ItemRollup {
  itemId: string;
  totalQty: number;
  totalValue: number | null;
  blendedUnitCost: number | null;
  unvaluedNegativeStock: boolean;
  warehouses: StockLevelDTO[];
}

const fmt = (value: number | null | undefined) =>
  value === null || value === undefined
    ? 'Unvalued'
    : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQty = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });

const costLabel = (basis?: StockLevelDTO['costBasis']) => {
  if (basis === 'AVG') return 'Average';
  if (basis === 'LAST_KNOWN') return 'Last known';
  return 'Missing';
};

const Initiator: React.FC<{
  onSubmit: (params: StockLevelParams) => void;
  initialParams?: StockLevelParams | null;
}> = ({ onSubmit, initialParams }) => {
  const [itemId, setItemId] = useState(initialParams?.itemId || '');
  const [warehouseId, setWarehouseId] = useState(initialParams?.warehouseId || '');
  const [viewMode, setViewMode] = useState<ViewMode>(initialParams?.viewMode || 'byItem');
  const [includeZero, setIncludeZero] = useState(initialParams?.includeZero ?? false);
  const [includeNegative, setIncludeNegative] = useState(initialParams?.includeNegative ?? true);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          itemId: itemId || undefined,
          warehouseId: warehouseId || undefined,
          viewMode,
          includeZero,
          includeNegative,
        });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        <div className="md:col-span-6 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Item</label>
          <ItemSelector
            value={itemId}
            trackInventoryOnly
            onChange={(item) => setItemId(item?.id || '')}
            placeholder="All tracked items"
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
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">View</label>
          <select
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value as ViewMode)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50"
          >
            <option value="byItem">By item</option>
            <option value="byWarehouse">By warehouse</option>
          </select>
        </div>
        <label className="md:col-span-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={includeZero}
            onChange={(event) => setIncludeZero(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Include zero quantity
        </label>
        <label className="md:col-span-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={includeNegative}
            onChange={(event) => setIncludeNegative(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Include negative stock
        </label>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button type="submit" className="bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-xl">
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
  params: StockLevelParams;
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
  const [levels, setLevels] = useState<StockLevelDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      inventoryApi.getStockLevels({
        itemId: params.itemId,
        warehouseId: params.warehouseId,
        includeZero: params.includeZero,
        includeNegative: params.includeNegative,
        limit: 5000,
      }),
      inventoryApi.listItems({ active: true, limit: 1000 }),
      inventoryApi.listWarehouses({ active: true, limit: 300 }),
    ])
      .then(([nextLevels, nextItems, nextWarehouses]) => {
        if (cancelled) return;
        setLevels(nextLevels);
        setItems(nextItems);
        setWarehouses(nextWarehouses);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load stock levels');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.itemId, params.warehouseId, params.includeZero, params.includeNegative]);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const warehouseMap = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);

  const itemRollups = useMemo<ItemRollup[]>(() => {
    const byItem = new Map<string, ItemRollup>();
    for (const level of levels) {
      const current =
        byItem.get(level.itemId) ||
        { itemId: level.itemId, totalQty: 0, totalValue: 0, blendedUnitCost: 0, unvaluedNegativeStock: false, warehouses: [] };
      current.totalQty += level.qtyOnHand;
      current.warehouses.push(level);
      if (level.unvaluedNegativeStock || level.reportValueBase === null || level.reportValueBase === undefined) {
        current.unvaluedNegativeStock = true;
        current.totalValue = null;
      } else if (current.totalValue !== null) {
        current.totalValue += level.reportValueBase;
      }
      byItem.set(level.itemId, current);
    }

    return Array.from(byItem.values())
      .map((row) => ({
        ...row,
        blendedUnitCost:
          row.totalValue === null || Math.abs(row.totalQty) < 0.0000001
            ? null
            : row.totalValue / row.totalQty,
      }))
      .sort((a, b) => {
        const left = itemMap.get(a.itemId)?.code || a.itemId;
        const right = itemMap.get(b.itemId)?.code || b.itemId;
        return left.localeCompare(right);
      });
  }, [itemMap, levels]);

  const rows = params.viewMode === 'byItem' ? itemRollups : levels;

  useEffect(() => {
    setTotalItems?.(rows.length);
  }, [rows.length, setTotalItems]);

  const pagedRows = useMemo(() => {
    if (!pagination) return rows;
    const start = (pagination.page - 1) * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [pagination, rows]);

  const totalValue = useMemo(() => {
    if (levels.some((level) => level.unvaluedNegativeStock)) return null;
    return levels.reduce((sum, level) => sum + (level.reportValueBase ?? 0), 0);
  }, [levels]);

  const negativeCount = levels.filter((level) => level.qtyOnHand < 0).length;
  const unvaluedCount = levels.filter((level) => level.unvaluedNegativeStock).length;
  const cellPad = density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-4';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-700 border border-slate-200 bg-slate-50 rounded-full px-2 py-1">
            {params.viewMode === 'byItem' ? 'By item' : 'By warehouse'}
          </span>
          {negativeCount > 0 && (
            <span className="text-xs font-semibold text-red-700 border border-red-200 bg-red-50 rounded-full px-2 py-1">
              Negative lines: {negativeCount}
            </span>
          )}
          {unvaluedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 border border-amber-200 bg-amber-50 rounded-full px-2 py-1">
              <TriangleAlert className="h-3 w-3" />
              Unvalued negatives: {unvaluedCount}
            </span>
          )}
          <span className="text-xs font-bold text-slate-500 ml-auto">
            Lines: <span className="font-black text-slate-700">{levels.length}</span> ·
            Value: <span className="font-black text-emerald-700">{fmt(totalValue)}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
        {loading ? (
          <div className="bg-white border rounded-xl p-6 shadow-sm flex items-center justify-center min-h-[180px]">
            <div className="text-center">
              <Spinner size="lg" variant="slate" className="mx-auto mb-3" />
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Loading stock levels...</p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 shadow-sm text-center">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">No stock levels match the filters.</p>
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm overflow-auto">
            {params.viewMode === 'byItem' ? (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                  <tr>
                    <th className={`${cellPad} text-left`}>Item</th>
                    <th className={`${cellPad} text-right`}>Warehouses</th>
                    <th className={`${cellPad} text-right`}>Total Qty</th>
                    <th className={`${cellPad} text-right`}>Blended Cost</th>
                    <th className={`${cellPad} text-right`}>Total Value</th>
                    <th className={`${cellPad} text-left`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(pagedRows as ItemRollup[]).map((row) => {
                    const item = itemMap.get(row.itemId);
                    return (
                      <tr key={row.itemId} className={`border-t border-slate-100 ${row.totalQty < 0 ? 'bg-red-50/60' : ''}`}>
                        <td className={cellPad}>{item ? `${item.code} - ${item.name}` : row.itemId}</td>
                        <td className={`${cellPad} text-right tabular-nums`}>{row.warehouses.length}</td>
                        <td className={`${cellPad} text-right tabular-nums font-semibold`}>{fmtQty(row.totalQty)}</td>
                        <td className={`${cellPad} text-right tabular-nums`}>{fmt(row.blendedUnitCost)}</td>
                        <td className={`${cellPad} text-right tabular-nums font-bold ${row.totalValue !== null && row.totalValue < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(row.totalValue)}</td>
                        <td className={cellPad}>{row.unvaluedNegativeStock ? 'Negative stock has no cost basis' : row.totalQty < 0 ? 'Negative valued stock' : 'Valued'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                  <tr>
                    <th className={`${cellPad} text-left`}>Item</th>
                    <th className={`${cellPad} text-left`}>Warehouse</th>
                    <th className={`${cellPad} text-right`}>Qty</th>
                    <th className={`${cellPad} text-right`}>Report Cost</th>
                    <th className={`${cellPad} text-left`}>Basis</th>
                    <th className={`${cellPad} text-right`}>Report Value</th>
                    <th className={`${cellPad} text-left`}>Warning</th>
                  </tr>
                </thead>
                <tbody>
                  {(pagedRows as StockLevelDTO[]).map((level) => {
                    const item = itemMap.get(level.itemId);
                    const warehouse = warehouseMap.get(level.warehouseId);
                    return (
                      <tr key={level.id} className={`border-t border-slate-100 ${level.qtyOnHand < 0 ? 'bg-red-50/60' : ''}`}>
                        <td className={cellPad}>{item ? `${item.code} - ${item.name}` : level.itemId}</td>
                        <td className={cellPad}>{warehouse ? `${warehouse.code} - ${warehouse.name}` : level.warehouseId}</td>
                        <td className={`${cellPad} text-right tabular-nums font-semibold`}>{fmtQty(level.qtyOnHand)}</td>
                        <td className={`${cellPad} text-right tabular-nums`}>{fmt(level.reportUnitCostBase)}</td>
                        <td className={cellPad}>{costLabel(level.costBasis)}</td>
                        <td className={`${cellPad} text-right tabular-nums font-bold ${(level.reportValueBase ?? 0) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(level.reportValueBase)}</td>
                        <td className={cellPad}>{level.unvaluedNegativeStock ? 'Negative stock has no cost basis' : level.qtyOnHand < 0 ? 'Negative valued stock' : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StockLevelsPage: React.FC = () => (
  <ReportContainer<StockLevelParams>
    title="Stock Levels"
    subtitle="On-hand quantity and valuation by item or warehouse"
    initiator={Initiator}
    ReportContent={ReportContent}
    config={{ paginated: true, defaultPageSize: 50 }}
  />
);

export default StockLevelsPage;
