import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CalendarDays } from 'lucide-react';
import {
  inventoryApi,
  InventoryItemDTO,
  InventoryWarehouseDTO,
  UnsettledCostReportDTO,
} from '../../../api/inventoryApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { Spinner } from '../../../components/ui/Spinner';
import { useTranslation } from "react-i18next";

type CostBasisFilter = 'ALL' | 'AVG' | 'LAST_KNOWN' | 'MISSING';

interface UnsettledCostsParams {
  itemId?: string;
  warehouseId?: string;
  costBasis: CostBasisFilter;
  fromDate?: string;
  toDate?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQty = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });

// ─── Initiator ──────────────────────────────────────────────────────────────

const Initiator: React.FC<{
  onSubmit: (p: UnsettledCostsParams) => void;
  initialParams?: UnsettledCostsParams | null;
}> = ({ onSubmit, initialParams }) => {
    const { t } = useTranslation('common');
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);

  const [itemId, setItemId] = useState(initialParams?.itemId || '');
  const [warehouseId, setWarehouseId] = useState(initialParams?.warehouseId || '');
  const [costBasis, setCostBasis] = useState<CostBasisFilter>(initialParams?.costBasis || 'ALL');
  const [fromDate, setFromDate] = useState(initialParams?.fromDate || '');
  const [toDate, setToDate] = useState(initialParams?.toDate || '');

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
          itemId: itemId || undefined,
          warehouseId: warehouseId || undefined,
          costBasis,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        <div className="md:col-span-3 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            From Date
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full" />
        </div>

        <div className="md:col-span-3 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            To Date
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full" />
        </div>

        <div className="md:col-span-6 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Item
          </label>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50 hover:bg-white hover:border-amber-300 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
          >
            <option value="">{t(`All items`)}</option>
            {items.map(it => (
              <option key={it.id} value={it.id}>{it.code} — {it.name}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-6 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Warehouse
          </label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50 hover:bg-white hover:border-emerald-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
          >
            <option value="">{t(`All warehouses`)}</option>
            {warehouses.map(wh => (
              <option key={wh.id} value={wh.id}>{wh.name}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-6 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Cost Basis
          </label>
          <select
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value as CostBasisFilter)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50 hover:bg-white hover:border-purple-300 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
          >
            <option value="ALL">{t(`All`)}</option>
            <option value="AVG">{t(`Moving Average`)}</option>
            <option value="LAST_KNOWN">{t(`Last Known`)}</option>
            <option value="MISSING">{t(`Missing (no cost)`)}</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button
          type="submit"
          className="bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-xl transition-all"
        >
          <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            Generate Report
            <ChevronRight className="w-4 h-4" />
          </span>
        </Button>
      </div>
    </form>
  );
};

// ─── Report Content ─────────────────────────────────────────────────────────

const ReportContent: React.FC<{
  params: UnsettledCostsParams;
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
  const [report, setReport] = useState<UnsettledCostReportDTO | null>(null);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageSize = pagination?.pageSize ?? 50;
  const offset = pagination ? (pagination.page - 1) * pageSize : 0;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      inventoryApi.getUnsettledCosts({
        itemId: params.itemId,
        warehouseId: params.warehouseId,
        costBasis: params.costBasis === 'ALL' ? undefined : params.costBasis,
        fromDate: params.fromDate,
        toDate: params.toDate,
        limit: pageSize,
        offset,
      }),
      inventoryApi.listItems({ active: true, limit: 1000 }),
      inventoryApi.listWarehouses({ active: true, limit: 200 }),
    ])
      .then(([rep, its, whs]) => {
        if (cancelled) return;
        setReport(rep);
        setItems(its);
        setWarehouses(whs);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load report');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.itemId, params.warehouseId, params.costBasis, params.fromDate, params.toDate, pageSize, offset]);

  const itemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const warehouseMap = useMemo(() => new Map(warehouses.map(w => [w.id, w])), [warehouses]);

  useEffect(() => {
    setTotalItems?.(report?.total ?? 0);
  }, [report?.total, setTotalItems]);

  const rows = report?.rows ?? [];
  const totalUnsettledQty = report?.totals?.unsettledQty ?? 0;
  const totalCostBase = report?.totals?.costBase ?? 0;

  const cellPad = density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-4';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Active filter chips */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {(params.fromDate || params.toDate) && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-xs font-semibold text-slate-800">
              <CalendarDays className="w-3 h-3 text-blue-600" />
              {params.fromDate || '—'} → {params.toDate || '—'}
            </span>
          )}
          {params.itemId && (
            <span className="text-xs font-semibold text-slate-700 border border-amber-200 bg-amber-50 rounded-full px-2 py-1">
              {t(`Item:`)} {itemMap.get(params.itemId)?.code ?? params.itemId}
            </span>
          )}
          {params.warehouseId && (
            <span className="text-xs font-semibold text-slate-700 border border-emerald-200 bg-emerald-50 rounded-full px-2 py-1">
              {t(`WH:`)} {warehouseMap.get(params.warehouseId)?.name ?? params.warehouseId}
            </span>
          )}
          {params.costBasis !== 'ALL' && (
            <span className="text-xs font-semibold text-slate-700 border border-purple-200 bg-purple-50 rounded-full px-2 py-1">
              {t(`Basis:`)} {params.costBasis}
            </span>
          )}
          <span className="text-xs font-bold text-slate-500 ml-auto">
            {report?.total ?? 0} {t(`row`)}{(report?.total ?? 0) === 1 ? '' : 's'} ·
            Unsettled qty: <span className="font-black text-slate-700">{fmtQty(totalUnsettledQty)}</span> ·
            Cost basis (base): <span className="font-black text-red-700">{fmt(totalCostBase)}</span>
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
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{t(`Loading...`)}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                <tr>
                  <th className={`${cellPad} text-left`}>{t(`Date`)}</th>
                  <th className={`${cellPad} text-left`}>{t(`Item`)}</th>
                  <th className={`${cellPad} text-left`}>{t(`Warehouse`)}</th>
                  <th className={`${cellPad} text-left`}>{t(`Movement Type`)}</th>
                  <th className={`${cellPad} text-right`}>{t(`Qty`)}</th>
                  <th className={`${cellPad} text-right`}>{t(`Unsettled Qty`)}</th>
                  <th className={`${cellPad} text-left`}>{t(`Cost Basis`)}</th>
                  <th className={`${cellPad} text-right`}>{t(`Total Cost (Base)`)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center text-sm text-slate-500">
                      No unsettled movements match your filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const item = itemMap.get(r.itemId);
                    const wh = warehouseMap.get(r.warehouseId);
                    return (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                        <td className={cellPad}>{r.date}</td>
                        <td className={cellPad}>{item ? `${item.code} — ${item.name}` : r.itemId}</td>
                        <td className={cellPad}>{wh?.name ?? r.warehouseId}</td>
                        <td className={cellPad}>{r.movementType}</td>
                        <td className={`${cellPad} text-right tabular-nums`}>{fmtQty(r.qty)}</td>
                        <td className={`${cellPad} text-right tabular-nums text-red-700 font-semibold`}>{fmtQty(r.unsettledQty)}</td>
                        <td className={cellPad}>{r.unsettledCostBasis ?? '—'}</td>
                        <td className={`${cellPad} text-right tabular-nums`}>{fmt(r.totalCostBase)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {(report?.total ?? 0) > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td colSpan={5} className={`${cellPad} text-right`}>{t(`Totals`)}</td>
                    <td className={`${cellPad} text-right tabular-nums text-red-800`}>{fmtQty(totalUnsettledQty)}</td>
                    <td className={cellPad}></td>
                    <td className={`${cellPad} text-right tabular-nums`}>{fmt(totalCostBase)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Page ───────────────────────────────────────────────────────────────────

const UnsettledCostsPage: React.FC = () => (
  <ReportContainer<UnsettledCostsParams>
    title="Unsettled Costs"
    subtitle="Stock-out movements awaiting cost settlement"
    initiator={Initiator}
    ReportContent={ReportContent}
    config={{ paginated: true, defaultPageSize: 50 }}
  />
);

export default UnsettledCostsPage;
