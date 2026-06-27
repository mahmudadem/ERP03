import React, { useEffect, useState } from 'react';
import { ChevronRight, CalendarDays, BarChart2 } from 'lucide-react';
import {
  salesReportingApi,
  SalesByCustomerReportDTO,
  SalesByItemReportDTO,
  SalesBySalespersonReportDTO,
} from '../../../api/salesReportingApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { Card } from '../../../components/ui/Card';
import { clsx } from 'clsx';
import { useTranslation } from "react-i18next";

type Mode = 'BY_CUSTOMER' | 'BY_ITEM' | 'BY_SALESPERSON';

interface AnalyticsParams {
  mode: Mode;
  fromDate: string;
  toDate: string;
}

const firstOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQty = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// ─── Initiator ──────────────────────────────────────────────────────────────

const Initiator: React.FC<{
  onSubmit: (p: AnalyticsParams) => void;
  initialParams?: AnalyticsParams | null;
}> = ({ onSubmit, initialParams }) => {
    const { t } = useTranslation('common');
  const [mode, setMode]         = useState<Mode>(initialParams?.mode || 'BY_CUSTOMER');
  const [fromDate, setFromDate] = useState(initialParams?.fromDate || firstOfYear());
  const [toDate, setToDate]     = useState(initialParams?.toDate || today());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ mode, fromDate, toDate });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            Group By
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50 hover:bg-white hover:border-violet-300 focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all"
          >
            <option value="BY_CUSTOMER">{t(`By Customer`)}</option>
            <option value="BY_ITEM">{t(`By Item`)}</option>
            <option value="BY_SALESPERSON">{t(`By Salesperson`)}</option>
          </select>
        </div>

        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            From Date
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full" />
        </div>

        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            To Date
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full" />
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

// ─── ReportContent ──────────────────────────────────────────────────────────

const ReportContent: React.FC<{
  params: AnalyticsParams;
  setTotalItems?: (total: number) => void;
  density?: 'compact' | 'comfortable';
}> = ({ params, setTotalItems, density }) => {
    const { t } = useTranslation('common');
  const [byCustomer, setByCustomer] = useState<SalesByCustomerReportDTO | null>(null);
  const [byItem, setByItem] = useState<SalesByItemReportDTO | null>(null);
  const [bySalesperson, setBySalesperson] = useState<SalesBySalespersonReportDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setByCustomer(null); setByItem(null); setBySalesperson(null);

    const dateRange = { fromDate: params.fromDate, toDate: params.toDate };
    const promise =
      params.mode === 'BY_CUSTOMER' ? salesReportingApi.getSalesByCustomer(dateRange).then((d) => { if (!cancelled) setByCustomer(d); })
      : params.mode === 'BY_ITEM' ? salesReportingApi.getSalesByItem(dateRange).then((d) => { if (!cancelled) setByItem(d); })
      : salesReportingApi.getSalesBySalesperson(dateRange).then((d) => { if (!cancelled) setBySalesperson(d); });

    promise
      .catch((err) => { if (!cancelled) setError(err?.message || 'Failed to load report'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.mode, params.fromDate, params.toDate]);

  const rows = byCustomer?.rows.length ?? byItem?.rows.length ?? bySalesperson?.rows.length ?? 0;
  useEffect(() => { setTotalItems?.(rows); }, [rows, setTotalItems]);

  const cellPad = density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-4';
  const modeLabel = params.mode === 'BY_CUSTOMER' ? 'By Customer' : params.mode === 'BY_ITEM' ? 'By Item' : 'By Salesperson';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-violet-200 bg-violet-50 text-xs font-semibold text-slate-800">
            <BarChart2 className="w-3 h-3 text-violet-600" />
            {modeLabel}
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-xs font-semibold text-slate-800">
            <CalendarDays className="w-3 h-3 text-blue-600" />
            {params.fromDate} → {params.toDate}
          </span>
          <span className="text-xs font-bold text-slate-500 ml-auto">{rows} {t(`row`)}{rows === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          {loading && (
            <div className="py-20 text-center text-sm text-slate-400 animate-pulse">{t(`Loading report...`)}</div>
          )}

          {!loading && byCustomer && (
            <Card className="p-0 overflow-hidden">
              <div className="bg-slate-50/50 px-6 py-4 border-b">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t(`Sales by Customer`)}</p>
              </div>
              {byCustomer.rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">{t(`No data for this period.`)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        {['Customer', 'Invoices', 'Revenue', 'Tax', 'Gross'].map((h, i) => (
                          <th key={h} className={clsx(cellPad, 'text-[10px] font-black text-slate-400 uppercase tracking-widest', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {byCustomer.rows.map(row => (
                        <tr key={row.customerId} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className={`${cellPad} text-xs font-medium text-slate-800`}>{row.customerName}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right text-slate-600`}>{row.invoiceCount}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right text-slate-700`}>{fmt(row.totalRevenueBase)}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right text-slate-500`}>{fmt(row.totalTaxBase)}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-900`}>{fmt(row.totalGrossBase)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-200">
                        <td className={`${cellPad} text-xs font-black text-slate-700 uppercase tracking-widest`}>{t(`Totals`)}</td>
                        <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-700`}>{byCustomer.totals.invoiceCount}</td>
                        <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-700`}>{fmt(byCustomer.totals.totalRevenueBase)}</td>
                        <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-500`}>{fmt(byCustomer.totals.totalTaxBase)}</td>
                        <td className={`${cellPad} text-xs tabular-nums text-right font-black text-slate-900`}>{fmt(byCustomer.totals.totalGrossBase)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          )}

          {!loading && byItem && (
            <Card className="p-0 overflow-hidden">
              <div className="bg-slate-50/50 px-6 py-4 border-b">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t(`Sales by Item`)}</p>
              </div>
              {byItem.rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">{t(`No data for this period.`)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        {['Code', 'Item', 'Lines', 'Qty Sold', 'Revenue'].map((h, i) => (
                          <th key={h} className={clsx(cellPad, 'text-[10px] font-black text-slate-400 uppercase tracking-widest', i < 2 ? 'text-left' : 'text-right')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {byItem.rows.map(row => (
                        <tr key={row.itemId} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className={`${cellPad} text-xs font-mono text-slate-500`}>{row.itemCode}</td>
                          <td className={`${cellPad} text-xs font-medium text-slate-800`}>{row.itemName}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right text-slate-600`}>{row.lineCount}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right text-slate-700`}>{fmtQty(row.totalQty)}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-900`}>{fmt(row.totalRevenueBase)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-200">
                        <td colSpan={2} className={`${cellPad} text-xs font-black text-slate-700 uppercase tracking-widest`}>{t(`Totals`)}</td>
                        <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-700`}>{byItem.totals.lineCount}</td>
                        <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-700`}>{fmtQty(byItem.totals.totalQty)}</td>
                        <td className={`${cellPad} text-xs tabular-nums text-right font-black text-slate-900`}>{fmt(byItem.totals.totalRevenueBase)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          )}

          {!loading && bySalesperson && (
            <Card className="p-0 overflow-hidden">
              <div className="bg-slate-50/50 px-6 py-4 border-b">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t(`Sales by Salesperson`)}</p>
              </div>
              {bySalesperson.rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">{t(`No data for this period.`)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        {['Salesperson', 'Invoices', 'Revenue', 'Gross'].map((h, i) => (
                          <th key={h} className={clsx(cellPad, 'text-[10px] font-black text-slate-400 uppercase tracking-widest', i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bySalesperson.rows.map(row => (
                        <tr key={row.salespersonId} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className={`${cellPad} text-xs font-medium text-slate-800`}>{row.salespersonName}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right text-slate-600`}>{row.invoiceCount}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right text-slate-700`}>{fmt(row.totalRevenueBase)}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-900`}>{fmt(row.totalGrossBase)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-200">
                        <td className={`${cellPad} text-xs font-black text-slate-700 uppercase tracking-widest`}>{t(`Totals`)}</td>
                        <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-700`}>{bySalesperson.totals.invoiceCount}</td>
                        <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-700`}>{fmt(bySalesperson.totals.totalRevenueBase)}</td>
                        <td className={`${cellPad} text-xs tabular-nums text-right font-black text-slate-900`}>{fmt(bySalesperson.totals.totalGrossBase)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Page ───────────────────────────────────────────────────────────────────

const SalesAnalyticsPage: React.FC = () => (
  <ReportContainer<AnalyticsParams>
    title="Sales Analytics"
    subtitle="Sales performance by customer, item, or salesperson"
    initiator={Initiator}
    ReportContent={ReportContent}
    config={{ paginated: false }}
  />
);

export default SalesAnalyticsPage;
