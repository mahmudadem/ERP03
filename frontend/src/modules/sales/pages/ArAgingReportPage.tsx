import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { salesReportingApi, ArAgingReportDTO, ArAgingCustomerRowDTO } from '../../../api/salesReportingApi';
import { ClipboardList, ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = (): string => new Date().toISOString().slice(0, 10);

const fmt = (n: number): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Expandable customer row ─────────────────────────────────────────────────

const CustomerRow: React.FC<{ row: ArAgingCustomerRowDTO }> = ({ row }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="py-2.5 px-4 text-xs">
          <div className="flex items-center gap-1.5">
            {open ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
            <span className="font-medium text-slate-800 dark:text-slate-200">{row.customerName}</span>
          </div>
        </td>
        <td className="py-2.5 px-4 text-xs text-right tabular-nums text-slate-700 dark:text-slate-300">{fmt(row.current)}</td>
        <td className="py-2.5 px-4 text-xs text-right tabular-nums text-amber-600">{fmt(row.days1_30)}</td>
        <td className="py-2.5 px-4 text-xs text-right tabular-nums text-orange-600">{fmt(row.days31_60)}</td>
        <td className="py-2.5 px-4 text-xs text-right tabular-nums text-red-500">{fmt(row.days61_90)}</td>
        <td className="py-2.5 px-4 text-xs text-right tabular-nums text-red-700 font-semibold">{fmt(row.days90Plus)}</td>
        <td className="py-2.5 px-4 text-xs text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">{fmt(row.total)}</td>
      </tr>
      {open && row.invoices.length > 0 && (
        <tr className="bg-slate-50/80 dark:bg-slate-900/60">
          <td colSpan={7} className="px-8 py-3">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  {['Invoice #', 'Invoice Date', 'Due Date', 'Days Overdue', 'Bucket', 'Outstanding'].map(h => (
                    <th key={h} className="pb-1.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row.invoices.map(inv => (
                  <tr key={inv.invoiceId} className="border-b border-slate-100 dark:border-slate-800/50">
                    <td className="py-1.5 pr-3 text-[11px] font-mono text-slate-700 dark:text-slate-300">{inv.invoiceNumber}</td>
                    <td className="py-1.5 pr-3 text-[11px] text-slate-600 dark:text-slate-400">{inv.invoiceDate}</td>
                    <td className="py-1.5 pr-3 text-[11px] text-slate-600 dark:text-slate-400">{inv.dueDate ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-[11px] tabular-nums text-slate-600 dark:text-slate-400">{inv.daysOverdue}</td>
                    <td className="py-1.5 pr-3 text-[11px] text-slate-600 dark:text-slate-400">{inv.bucket}</td>
                    <td className="py-1.5 pr-3 text-[11px] tabular-nums text-right font-medium text-slate-800 dark:text-slate-200">{fmt(inv.outstandingAmountBase)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const ArAgingReportPage: React.FC = () => {
  const [asOfDate, setAsOfDate] = useState<string>(today());
  const [report, setReport] = useState<ArAgingReportDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await salesReportingApi.getArAging({ asOfDate });
      setReport(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-600 rounded-xl text-white shadow-lg shadow-rose-100 dark:shadow-none">
              <ClipboardList size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">AR Aging</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">Accounts Receivable Aging Report</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex-none px-6 py-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">As of Date</label>
            <input
              type="date"
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              value={asOfDate}
              onChange={e => setAsOfDate(e.target.value)}
            />
          </div>
          <button
            onClick={runReport}
            disabled={loading}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
          >
            {loading ? 'Running...' : 'Run Report'}
          </button>
          {report && (
            <span className="text-xs text-slate-400">As of {report.asOfDate}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {loading && !report && (
            <div className="py-20 text-center text-sm text-slate-400 animate-pulse">Loading report...</div>
          )}

          {report && (
            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {report.rows.length} {report.rows.length === 1 ? 'Customer' : 'Customers'} with Outstanding Balances
                </p>
              </div>

              {report.rows.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                    <ClipboardList size={48} />
                  </div>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No outstanding receivables as of {report.asOfDate}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
                        {['Customer', 'Current', '1–30 Days', '31–60 Days', '61–90 Days', '90+ Days', 'Total'].map((h, i) => (
                          <th
                            key={h}
                            className={clsx(
                              'py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest',
                              i === 0 ? 'text-left' : 'text-right'
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map(row => (
                        <CustomerRow key={row.customerId} row={row} />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-800/60 border-t-2 border-slate-200 dark:border-slate-700">
                        <td className="py-3 px-4 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Totals</td>
                        <td className="py-3 px-4 text-xs text-right tabular-nums font-bold text-slate-700 dark:text-slate-200">{fmt(report.totals.current)}</td>
                        <td className="py-3 px-4 text-xs text-right tabular-nums font-bold text-amber-600">{fmt(report.totals.days1_30)}</td>
                        <td className="py-3 px-4 text-xs text-right tabular-nums font-bold text-orange-600">{fmt(report.totals.days31_60)}</td>
                        <td className="py-3 px-4 text-xs text-right tabular-nums font-bold text-red-500">{fmt(report.totals.days61_90)}</td>
                        <td className="py-3 px-4 text-xs text-right tabular-nums font-bold text-red-700">{fmt(report.totals.days90Plus)}</td>
                        <td className="py-3 px-4 text-xs text-right tabular-nums font-black text-slate-900 dark:text-slate-100">{fmt(report.totals.total)}</td>
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

export default ArAgingReportPage;
