import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, CalendarDays, Layers } from 'lucide-react';
import {
  inventoryApi,
  AsOfValuationDTO,
  InventoryValuationDTO,
  InventoryItemDTO,
  InventoryPricingPolicy,
  InventoryWarehouseDTO,
} from '../../../api/inventoryApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { Spinner } from '../../../components/ui/Spinner';
import { useTranslation } from 'react-i18next';

type Mode = 'CURRENT' | 'AS_OF';

interface ValuationParams {
  mode: Mode;
  asOfDate?: string;
  pricingPolicy: InventoryPricingPolicy;
  warehouseId?: string;
  itemId?: string;
}

interface UnifiedRow {
  itemId: string;
  warehouseId: string;
  qtyOnHand: number;
  avgCostBase: number;
  avgCostCCY: number;
  lastPurchaseCostBase: number;
  lastPurchaseCostCCY: number;
  pricingUnitCostBase: number;
  pricingUnitCostCCY: number;
  valueBase: number;
}

const today = () => new Date().toISOString().slice(0, 10);

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQty = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });

// ─── Initiator ──────────────────────────────────────────────────────────────

const Initiator: React.FC<{
  onSubmit: (p: ValuationParams) => void;
  initialParams?: ValuationParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('common');
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);

  const [mode, setMode] = useState<Mode>(initialParams?.mode || 'CURRENT');
  const [asOfDate, setAsOfDate] = useState(initialParams?.asOfDate || today());
  const [pricingPolicy, setPricingPolicy] = useState<InventoryPricingPolicy>(initialParams?.pricingPolicy || 'AVERAGE');
  const [warehouseId, setWarehouseId] = useState(initialParams?.warehouseId || '');
  const [itemId, setItemId] = useState(initialParams?.itemId || '');

  useEffect(() => {
    Promise.all([
      inventoryApi.listItems({ active: true, limit: 1000 }),
      inventoryApi.listWarehouses({ active: true, limit: 200 }),
    ])
      .then(([its, whs]) => {
        setItems(its);
        setWarehouses(whs);
      })
      .catch(() => { /* best effort */ });
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          mode,
          asOfDate: mode === 'AS_OF' ? asOfDate : undefined,
          pricingPolicy,
          warehouseId: warehouseId || undefined,
          itemId: itemId || undefined,
        });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            {t('inventory.valuation.filters.mode', { defaultValue: 'Mode' })}
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50 hover:bg-white hover:border-indigo-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
          >
            <option value="CURRENT">{t('inventory.valuation.mode.current', { defaultValue: 'Current (live)' })}</option>
            <option value="AS_OF">{t('inventory.valuation.mode.asOf', { defaultValue: 'As of a date' })}</option>
          </select>
        </div>

        {mode === 'AS_OF' && (
          <div className="md:col-span-4 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {t('inventory.valuation.filters.asOfDate', { defaultValue: 'As Of Date' })}
            </label>
            <DatePicker value={asOfDate} onChange={setAsOfDate} className="w-full" />
          </div>
        )}

        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
            {t('inventory.valuation.filters.pricingPolicy', { defaultValue: 'Pricing Policy' })}
          </label>
          <select
            value={pricingPolicy}
            onChange={(e) => setPricingPolicy(e.target.value as InventoryPricingPolicy)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50 hover:bg-white hover:border-fuchsia-300 focus:bg-white focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10 outline-none transition-all"
          >
            <option value="AVERAGE">{t('inventory.valuation.pricingPolicy.average', { defaultValue: 'Average Cost' })}</option>
            <option value="LAST_PURCHASE">{t('inventory.valuation.pricingPolicy.lastPurchase', { defaultValue: 'Last Purchase Cost' })}</option>
          </select>
        </div>

        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {t('inventory.valuation.filters.warehouse', { defaultValue: 'Warehouse' })}
          </label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50 hover:bg-white hover:border-emerald-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
          >
            <option value="">{t('inventory.valuation.filters.allWarehouses', { defaultValue: 'All warehouses' })}</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-12 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {t('inventory.valuation.filters.item', { defaultValue: 'Item' })}
          </label>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50 hover:bg-white hover:border-amber-300 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
          >
            <option value="">{t('inventory.valuation.filters.allItems', { defaultValue: 'All items' })}</option>
            {items.map(it => (
              <option key={it.id} value={it.id}>{it.code} — {it.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button
          type="submit"
          className="bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-xl transition-all"
        >
          <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            {t('common.generate', { defaultValue: 'Generate Report' })}
            <ChevronRight className="w-4 h-4" />
          </span>
        </Button>
      </div>
    </form>
  );
};

// ─── ReportContent ──────────────────────────────────────────────────────────

const ReportContent: React.FC<{
  params: ValuationParams;
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
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [totalValueBase, setTotalValueBase] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [snapshotPeriodKey, setSnapshotPeriodKey] = useState<string | undefined>();
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const valuationCall = params.mode === 'AS_OF' && params.asOfDate
      ? inventoryApi.getAsOfValuation(params.asOfDate, params.pricingPolicy)
      : inventoryApi.getValuation(params.pricingPolicy);

    Promise.all([
      valuationCall,
      inventoryApi.listItems({ active: true, limit: 1000 }),
      inventoryApi.listWarehouses({ active: true, limit: 200 }),
    ])
      .then(([val, its, whs]) => {
        if (cancelled) return;
        const raw: UnifiedRow[] = (val as AsOfValuationDTO).items
          ?? (val as InventoryValuationDTO).items
          ?? [];
        // Server-side filters not supported yet; for now narrow client-side.
        // (These two filters are SELECTION, not calculation — totals
        // displayed reflect SERVER totals across the full set.)
        const filtered = raw.filter(r =>
          (!params.warehouseId || r.warehouseId === params.warehouseId) &&
          (!params.itemId || r.itemId === params.itemId)
        );
        setRows(filtered);
        setTotalValueBase(val.totalValueBase);
        setTotalLines(val.totalItems);
        setSnapshotPeriodKey((val as AsOfValuationDTO).snapshotPeriodKey);
        setItems(its);
        setWarehouses(whs);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || t('inventory.valuation.loadFailed', { defaultValue: 'Failed to load valuation' }));
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [params.mode, params.asOfDate, params.pricingPolicy, params.warehouseId, params.itemId]);

  const itemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const warehouseMap = useMemo(() => new Map(warehouses.map(w => [w.id, w])), [warehouses]);

  useEffect(() => {
    setTotalItems?.(rows.length);
  }, [rows.length, setTotalItems]);

  const pagedRows = useMemo(() => {
    if (!pagination) return rows;
    const start = (pagination.page - 1) * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [rows, pagination]);

  const cellPad = density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-4';
  const getModeLabel = () => params.mode === 'AS_OF'
    ? t('inventory.valuation.chips.asOf', { date: params.asOfDate, defaultValue: 'As of {{date}}' })
    : t('inventory.valuation.mode.current', { defaultValue: 'Current (live)' });
  const getPricingPolicyLabel = () => params.pricingPolicy === 'LAST_PURCHASE'
    ? t('inventory.valuation.pricingPolicy.lastPurchaseShort', { defaultValue: 'Last Purchase' })
    : t('inventory.valuation.pricingPolicy.averageShort', { defaultValue: 'Average' });

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Filter chips + summary */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-xs font-semibold text-slate-800">
            {params.mode === 'AS_OF' && <CalendarDays className="w-3 h-3 text-indigo-600" />}
            {getModeLabel()}
          </span>
          <span className="text-xs font-semibold text-slate-700 border border-fuchsia-200 bg-fuchsia-50 rounded-full px-2 py-1">
            {t('inventory.valuation.chips.policy', { defaultValue: 'Policy' })}: {getPricingPolicyLabel()}
          </span>
          {snapshotPeriodKey && (
            <span className="text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 rounded-full px-2 py-1">
              {t('inventory.valuation.chips.basedOnSnapshot', { snapshot: snapshotPeriodKey, defaultValue: 'Based on snapshot {{snapshot}}' })}
            </span>
          )}
          {params.warehouseId && (
            <span className="text-xs font-semibold text-slate-700 border border-emerald-200 bg-emerald-50 rounded-full px-2 py-1">
              {t('inventory.valuation.chips.warehouseShort', { defaultValue: 'WH' })}: {warehouseMap.get(params.warehouseId)?.name ?? params.warehouseId}
            </span>
          )}
          {params.itemId && (
            <span className="text-xs font-semibold text-slate-700 border border-amber-200 bg-amber-50 rounded-full px-2 py-1">
              {t('inventory.valuation.chips.item', { defaultValue: 'Item' })}: {itemMap.get(params.itemId)?.code ?? params.itemId}
            </span>
          )}
          <span className="text-xs font-bold text-slate-500 ml-auto">
            {t('inventory.valuation.summary.totalLinesFullSet', { defaultValue: 'Total lines (full set)' })}: <span className="font-black text-slate-700">{totalLines}</span> ·
            {t('inventory.valuation.summary.totalValueBase', { defaultValue: 'Total value (base)' })}: <span className="font-black text-emerald-700">{fmt(totalValueBase)}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
        )}

        {loading ? (
          <div className="bg-white border rounded-xl p-6 shadow-sm flex items-center justify-center min-h-[180px]">
            <div className="text-center">
              <Spinner size="lg" variant="slate" className="mx-auto mb-3" />
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{t('inventory.valuation.loading', { defaultValue: 'Loading valuation...' })}</p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 shadow-sm">
            <div className="text-center space-y-3">
              <div className="inline-flex p-5 bg-slate-50 rounded-full text-slate-300">
                <Layers className="w-10 h-10" />
              </div>
              <p className="text-sm font-bold text-slate-600">{t('inventory.valuation.empty', { defaultValue: 'No stock lines to value' })}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                <tr>
                  <th className={`${cellPad} text-left`}>{t('inventory.valuation.columns.itemCode', { defaultValue: 'Item Code' })}</th>
                  <th className={`${cellPad} text-left`}>{t('inventory.valuation.columns.itemName', { defaultValue: 'Item Name' })}</th>
                  <th className={`${cellPad} text-left`}>{t('inventory.valuation.columns.warehouse', { defaultValue: 'Warehouse' })}</th>
                  <th className={`${cellPad} text-right`}>{t('inventory.valuation.columns.qtyOnHand', { defaultValue: 'Qty on Hand' })}</th>
                  <th className={`${cellPad} text-right`}>{t('inventory.valuation.columns.policyCostBase', { defaultValue: 'Policy Cost (Base)' })}</th>
                  <th className={`${cellPad} text-right`}>{t('inventory.valuation.columns.avgCostBase', { defaultValue: 'Avg Cost (Base)' })}</th>
                  <th className={`${cellPad} text-right`}>{t('inventory.valuation.columns.valueBase', { defaultValue: 'Value (Base)' })}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r, i) => {
                  const item = itemMap.get(r.itemId);
                  const wh = warehouseMap.get(r.warehouseId);
                  return (
                    <tr key={`${r.itemId}__${r.warehouseId}__${i}`} className="border-t border-slate-100 hover:bg-blue-50/40">
                      <td className={`${cellPad} font-mono text-slate-600`}>{item?.code ?? r.itemId}</td>
                      <td className={cellPad}>{item?.name ?? '—'}</td>
                      <td className={cellPad}>{wh?.name ?? r.warehouseId}</td>
                      <td className={`${cellPad} text-right tabular-nums`}>{fmtQty(r.qtyOnHand)}</td>
                      <td className={`${cellPad} text-right tabular-nums font-semibold text-fuchsia-700`}>{fmt(r.pricingUnitCostBase)}</td>
                      <td className={`${cellPad} text-right tabular-nums`}>{fmt(r.avgCostBase)}</td>
                      <td className={`${cellPad} text-right tabular-nums font-bold text-emerald-700`}>{fmt(r.valueBase)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td colSpan={6} className={`${cellPad} text-right`}>{t('inventory.valuation.grandTotalServer', { defaultValue: 'Grand Total (server)' })}</td>
                  <td className={`${cellPad} text-right tabular-nums text-emerald-800`}>{fmt(totalValueBase)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Page ───────────────────────────────────────────────────────────────────

const InventoryValuationPage: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <ReportContainer<ValuationParams>
      title={t('inventory.valuation.title', { defaultValue: 'Inventory Valuation' })}
      subtitle={t('inventory.valuation.subtitle', { defaultValue: 'Stock value by item, warehouse, and pricing policy' })}
      initiator={Initiator}
      ReportContent={ReportContent}
      config={{ paginated: true, defaultPageSize: 50 }}
    />
  );
};

export default InventoryValuationPage;
