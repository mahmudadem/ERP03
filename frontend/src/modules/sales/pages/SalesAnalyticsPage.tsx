import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import {
  salesReportingApi,
  SalesByCustomerReportDTO,
  SalesByItemReportDTO,
  SalesBySalespersonReportDTO,
} from '../../../api/salesReportingApi';
import { BarChart2 } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const firstOfYear = (): string => `${new Date().getFullYear()}-01-01`;
const today = (): string => new Date().toISOString().slice(0, 10);

const fmt = (n: number): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQty = (n: number): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// ─── Tab types ────────────────────────────────────────────────────────────────

type TabId = 'customer' | 'item' | 'salesperson';

const TABS: { id: TabId; label: string }[] = [
  { id: 'customer', label: 'By Customer' },
  { id: 'item', label: 'By Item' },
  { id: 'salesperson', label: 'By Salesperson' },
];

// ─── By Customer table ────────────────────────────────────────────────────────

const ByCustomerTable: React.FC<{ report: SalesByCustomerReportDTO }> = ({ report }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
          {['Customer', 'Invoices', 'Revenue', 'Tax', 'Gross'].map((h, i) => (
            <th key={h} className={clsx('py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest', i === 0 ? 'text-left' : 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {report.rows.map(row => (
          <tr key={row.customerId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
            <td className="py-2.5 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">{row.customerName}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right text-slate-600 dark:text-slate-400">{row.invoiceCount}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">{fmt(row.totalRevenueBase)}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right text-slate-500">{fmt(row.totalTaxBase)}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right font-bold text-slate-900 dark:text-slate-100">{fmt(row.totalGrossBase)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-slate-100 dark:bg-slate-800/60 border-t-2 border-slate-200 dark:border-slate-700">
          <td className="py-3 px-4 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Totals</td>
          <td className="py-3 px-4 text-xs tabular-nums text-right font-bold text-slate-700 dark:text-slate-200">{report.totals.invoiceCount}</td>
          <td className="py-3 px-4 text-xs tabular-nums text-right font-bold text-slate-700 dark:text-slate-200">{fmt(report.totals.totalRevenueBase)}</td>
          <td className="py-3 px-4 text-xs tabular-nums text-right font-bold text-slate-500">{fmt(report.totals.totalTaxBase)}</td>
          <td className="py-3 px-4 text-xs tabular-nums text-right font-black text-slate-900 dark:text-slate-100">{fmt(report.totals.totalGrossBase)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

// ─── By Item table ────────────────────────────────────────────────────────────

const ByItemTable: React.FC<{ report: SalesByItemReportDTO }> = ({ report }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
          {['Code', 'Item', 'Lines', 'Qty Sold', 'Revenue'].map((h, i) => (
            <th key={h} className={clsx('py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest', i < 2 ? 'text-left' : 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {report.rows.map(row => (
          <tr key={row.itemId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
            <td className="py-2.5 px-4 text-xs font-mono text-slate-500 dark:text-slate-400">{row.itemCode}</td>
            <td className="py-2.5 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">{row.itemName}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right text-slate-600 dark:text-slate-400">{row.lineCount}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">{fmtQty(row.totalQty)}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right font-bold text-slate-900 dark:text-slate-100">{fmt(row.totalRevenueBase)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-slate-100 dark:bg-slate-800/60 border-t-2 border-slate-200 dark:border-slate-700">
          <td colSpan={2} className="py-3 px-4 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Totals</td>
          <td className="py-3 px-4 text-xs tabular-nums text-right font-bold text-slate-700 dark:text-slate-200">{report.totals.lineCount}</td>
          <td className="py-3 px-4 text-xs tabular-nums text-right font-bold text-slate-700 dark:text-slate-200">{fmtQty(report.totals.totalQty)}</td>
          <td className="py-3 px-4 text-xs tabular-nums text-right font-black text-slate-900 dark:text-slate-100">{fmt(report.totals.totalRevenueBase)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

// ─── By Salesperson table ─────────────────────────────────────────────────────

const BySalespersonTable: React.FC<{ report: SalesBySalespersonReportDTO }> = ({ report }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
          {['Salesperson', 'Invoices', 'Revenue', 'Gross'].map((h, i) => (
            <th key={h} className={clsx('py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest', i === 0 ? 'text-left' : 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {report.rows.map(row => (
          <tr key={row.salespersonId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
            <td className="py-2.5 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">{row.salespersonName}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right text-slate-600 dark:text-slate-400">{row.invoiceCount}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">{fmt(row.totalRevenueBase)}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right font-bold text-slate-900 dark:text-slate-100">{fmt(row.totalGrossBase)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-slate-100 dark:bg-slate-800/60 border-t-2 border-slate-200 dark:border-slate-700">
          <td className="py-3 px-4 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Totals</td>
          <td className="py-3 px-4 text-xs tabular-nums text-right font-bold text-slate-700 dark:text-slate-200">{report.totals.invoiceCount}</td>
          <td className="py-3 px-4 text-xs tabular-nums text-right font-bold text-slate-700 dark:text-slate-200">{fmt(report.totals.totalRevenueBase)}</td>
          <td className="py-3 px-4 text-xs tabular-nums text-right font-black text-slate-900 dark:text-slate-100">{fmt(report.totals.totalGrossBase)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const SalesAnalyticsPage: React.FC = () => {
  const [fromDate, setFromDate] = useState<string>(firstOfYear());
  const [toDate, setToDate] = useState<string>(today());
  const [activeTab, setActiveTab] = useState<TabId>('customer');

  const [byCustomer, setByCustomer] = useState<SalesByCustomerReportDTO | null>(null);
  const [byItem, setByItem] = useState<SalesByItemReportDTO | null>(null);
  const [bySalesperson, setBySalesperson] = useState<SalesBySalespersonReportDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runReport = async () => {
    setLoading(true);
    setError(null);
    setByCustomer(null);
    setByItem(null);
    setBySalesperson(null);
    const params = { fromDate, toDate };
    try {
      if (activeTab === 'customer') {
        const data = await salesReportingApi.getSalesByCustomer(params);
        setByCustomer(data);
      } else if (activeTab === 'item') {
        const data = await salesReportingApi.getSalesByItem(params);
        setByItem(data);
      } else {
        const data = await salesReportingApi.getSalesBySalesperson(params);
        setBySalesperson(data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: TabId) => {
    setActiveTab(tab);
    setByCustomer(null);
    setByItem(null);
    setBySalesperson(null);
    setError(null);
  };

  const currentReport = byCustomer ?? byItem ?? bySalesperson;
  const rowCount = byCustomer?.rows.length ?? byItem?.rows.length ?? bySalesperson?.rows.length ?? 0;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-violet-600 rounded-xl text-white shadow-lg shadow-violet-100 dark:shadow-none">
            <BarChart2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Sales Analytics</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">Sales Performance Reports</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-none bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-6">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={clsx(
                'px-5 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-violet-600 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex-none px-6 py-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">From Date</label>
            <input
              type="date"
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">To Date</label>
            <input
              type="date"
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
          <button
            onClick={runReport}
            disabled={loading}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
          >
            {loading ? 'Running...' : 'Run Report'}
          </button>
          {currentReport && (
            <span className="text-xs text-slate-400">
              {rowCount} {rowCount === 1 ? 'row' : 'rows'}
              {currentReport.fromDate && ` · ${currentReport.fromDate} – ${currentReport.toDate}`}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {loading && (
            <div className="py-20 text-center text-sm text-slate-400 animate-pulse">Loading report...</div>
          )}

          {!loading && !currentReport && !error && (
            <div className="py-20 text-center space-y-4">
              <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                <BarChart2 size={48} />
              </div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Select a date range and click Run Report.</p>
            </div>
          )}

          {byCustomer && (
            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sales by Customer</p>
              </div>
              {byCustomer.rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">No data for this period.</div>
              ) : (
                <ByCustomerTable report={byCustomer} />
              )}
            </Card>
          )}

          {byItem && (
            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sales by Item</p>
              </div>
              {byItem.rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">No data for this period.</div>
              ) : (
                <ByItemTable report={byItem} />
              )}
            </Card>
          )}

          {bySalesperson && (
            <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sales by Salesperson</p>
              </div>
              {bySalesperson.rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">No data for this period.</div>
              ) : (
                <BySalespersonTable report={bySalesperson} />
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesAnalyticsPage;
