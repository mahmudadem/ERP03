import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import {
  salesReportingApi,
  CustomerStatementDTO,
  CustomerLedgerDTO,
  LedgerEventDTO,
} from '../../../api/salesReportingApi';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { PartyDTO } from '../../../api/sharedApi';
import { FileText } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const firstOfYear = (): string => `${new Date().getFullYear()}-01-01`;
const today = (): string => new Date().toISOString().slice(0, 10);

const fmt = (n: number): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Shared transactions table ────────────────────────────────────────────────

const LedgerTable: React.FC<{ lines: LedgerEventDTO[] }> = ({ lines }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
          {['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance'].map((h, i) => (
            <th
              key={h}
              className={clsx(
                'py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest',
                i < 3 ? 'text-left' : 'text-right'
              )}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((line, idx) => (
          <tr
            key={idx}
            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
          >
            <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400">{line.date}</td>
            <td className="py-2.5 px-4 text-xs">
              <span
                className={clsx(
                  'px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest',
                  line.type === 'INVOICE'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                )}
              >
                {line.type}
              </span>
            </td>
            <td className="py-2.5 px-4 text-xs font-mono text-slate-700 dark:text-slate-300">{line.reference}</td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">
              {line.debit > 0 ? fmt(line.debit) : '—'}
            </td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right text-emerald-600">
              {line.credit > 0 ? fmt(line.credit) : '—'}
            </td>
            <td className="py-2.5 px-4 text-xs tabular-nums text-right font-semibold text-slate-800 dark:text-slate-200">
              {fmt(line.runningBalance)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Balance summary row ──────────────────────────────────────────────────────

const BalanceRow: React.FC<{ label: string; amount: number; bold?: boolean }> = ({ label, amount, bold }) => (
  <div className={clsx('flex justify-between items-center py-1.5 px-4', bold && 'bg-slate-50 dark:bg-slate-900/40 rounded')}>
    <span className={clsx('text-xs text-slate-600 dark:text-slate-400', bold && 'font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest')}>{label}</span>
    <span className={clsx('text-xs tabular-nums', bold ? 'font-black text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300')}>{fmt(amount)}</span>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = 'statement' | 'ledger';

const CustomerStatementPage: React.FC = () => {
  const [selectedParty, setSelectedParty] = useState<PartyDTO | null>(null);
  const [fromDate, setFromDate] = useState<string>(firstOfYear());
  const [toDate, setToDate] = useState<string>(today());
  const [activeTab, setActiveTab] = useState<TabId>('statement');

  const [statement, setStatement] = useState<CustomerStatementDTO | null>(null);
  const [ledger, setLedger] = useState<CustomerLedgerDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRun = !!selectedParty && !!fromDate && !!toDate;

  const runReport = async () => {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    setStatement(null);
    setLedger(null);
    try {
      if (activeTab === 'statement') {
        const data = await salesReportingApi.getCustomerStatement({
          customerId: selectedParty!.id,
          fromDate,
          toDate,
        });
        setStatement(data);
      } else {
        const data = await salesReportingApi.getCustomerLedger({
          customerId: selectedParty!.id,
          fromDate,
          toDate,
        });
        setLedger(data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: TabId) => {
    setActiveTab(tab);
    setStatement(null);
    setLedger(null);
    setError(null);
  };

  const customerName = statement?.customerName ?? ledger?.customerName ?? selectedParty?.displayName ?? '';

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100 dark:shadow-none">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Customer Statement</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">Statement & Ledger</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-none bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-6">
        <div className="flex gap-0">
          {(['statement', 'ledger'] as TabId[]).map(tab => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={clsx(
                'px-5 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {tab === 'statement' ? 'Statement' : 'Full Ledger'}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex-none px-6 py-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="min-w-64">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Customer</label>
            <PartySelector
              value={selectedParty?.id}
              onChange={party => { setSelectedParty(party); setStatement(null); setLedger(null); }}
              role="CUSTOMER"
              placeholder="Select customer..."
            />
          </div>
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
            disabled={!canRun || loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
          >
            {loading ? 'Running...' : 'Run Report'}
          </button>
        </div>
        {!selectedParty && (
          <p className="mt-2 text-xs text-slate-400">Select a customer to run the report.</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {loading && (
            <div className="py-20 text-center text-sm text-slate-400 animate-pulse">Loading report...</div>
          )}

          {/* ── Statement tab ── */}
          {activeTab === 'statement' && statement && (
            <>
              {/* Header info */}
              <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Statement Header</p>
                </div>
                <div className="p-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Customer</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{customerName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Period</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{statement.fromDate} – {statement.toDate}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Invoiced</p>
                    <p className="text-sm font-bold text-blue-600">{fmt(statement.totalInvoiced)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Paid</p>
                    <p className="text-sm font-bold text-emerald-600">{fmt(statement.totalPaid)}</p>
                  </div>
                </div>
              </Card>

              {/* Transactions */}
              <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Transactions</p>
                </div>
                <div className="px-4 py-3 border-b dark:border-slate-800">
                  <BalanceRow label="Opening Balance" amount={statement.openingBalance} />
                </div>
                {statement.lines.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">No transactions in this period.</div>
                ) : (
                  <LedgerTable lines={statement.lines} />
                )}
                <div className="px-4 py-3 border-t dark:border-slate-800">
                  <BalanceRow label="Closing Balance" amount={statement.closingBalance} bold />
                </div>
              </Card>

              {/* Open invoices */}
              {statement.openInvoices.length > 0 && (
                <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                  <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Open Invoices ({statement.openInvoices.length})</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
                          {['Invoice #', 'Invoice Date', 'Due Date', 'Invoice Total', 'Outstanding'].map((h, i) => (
                            <th key={h} className={clsx('py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest', i < 3 ? 'text-left' : 'text-right')}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {statement.openInvoices.map(inv => (
                          <tr key={inv.invoiceId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            <td className="py-2.5 px-4 text-xs font-mono text-slate-700 dark:text-slate-300">{inv.invoiceNumber}</td>
                            <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400">{inv.invoiceDate}</td>
                            <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400">{inv.dueDate ?? '—'}</td>
                            <td className="py-2.5 px-4 text-xs tabular-nums text-right text-slate-700 dark:text-slate-300">{fmt(inv.grandTotalBase)}</td>
                            <td className="py-2.5 px-4 text-xs tabular-nums text-right font-bold text-rose-600">{fmt(inv.outstandingAmountBase)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* ── Ledger tab ── */}
          {activeTab === 'ledger' && ledger && (
            <>
              <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Full Ledger — {customerName}
                    </p>
                    <span className="text-xs text-slate-400">
                      {ledger.fromDate && ledger.toDate ? `${ledger.fromDate} – ${ledger.toDate}` : 'All time'}
                    </span>
                  </div>
                </div>
                <div className="px-4 py-3 border-b dark:border-slate-800">
                  <BalanceRow label="Opening Balance" amount={ledger.openingBalance} />
                </div>
                {ledger.events.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">No ledger events found.</div>
                ) : (
                  <LedgerTable lines={ledger.events} />
                )}
                <div className="px-4 py-3 border-t dark:border-slate-800">
                  <BalanceRow label="Closing Balance" amount={ledger.closingBalance} bold />
                </div>
              </Card>
            </>
          )}

          {/* Empty prompt */}
          {!loading && !statement && !ledger && !error && (
            <div className="py-20 text-center space-y-4">
              <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                <FileText size={48} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                  {selectedParty ? 'Click Run Report to load data.' : 'Select a customer and date range, then click Run Report.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerStatementPage;
