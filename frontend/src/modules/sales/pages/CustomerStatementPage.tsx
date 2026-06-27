import i18n from 'i18next';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CalendarDays, FileText, ExternalLink, ReceiptText } from 'lucide-react';
import {
  salesReportingApi,
  CustomerStatementDTO,
  LedgerEventDTO,
} from '../../../api/salesReportingApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { clsx } from 'clsx';
import { useTranslation } from "react-i18next";

type Mode = 'STATEMENT' | 'LEDGER';

interface StatementParams {
  mode: Mode;
  customerId: string;
  customerLabel: string;
  fromDate: string;
  toDate: string;
  includeOpenCommitments: boolean;
}

const firstOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statementSourcePath = (line: LedgerEventDTO): string | null => {
  if (!line.sourceId || line.sourceModule !== 'sales') return null;
  switch (line.sourceType) {
    case 'SALES_INVOICE':
      return `/sales/invoices/${line.sourceId}`;
    case 'SALES_RETURN':
      return `/sales/returns/${line.sourceId}`;
    case 'SALES_ORDER':
      return `/sales/orders/${line.sourceId}`;
    case 'DELIVERY_NOTE':
      return `/sales/delivery-notes/${line.sourceId}`;
    default:
      return null;
  }
};

const voucherPath = (line: LedgerEventDTO): string | null =>
  line.voucherId ? `/accounting/vouchers/${line.voucherId}/view` : null;

const lineTone = (type: LedgerEventDTO['type']) => {
  if (type === 'INVOICE') return 'bg-blue-50 text-blue-600';
  if (type === 'PAYMENT') return 'bg-emerald-50 text-emerald-600';
  if (type === 'CREDIT_NOTE' || type === 'REFUND') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
};

// ─── Unified ledger table (opening/closing folded into thead/tfoot) ─────────

const LedgerTable: React.FC<{
  title: string;
  openingBalance: number;
  closingBalance: number;
  lines: LedgerEventDTO[];
  cellPad: string;
  onOpenSource: (line: LedgerEventDTO) => void;
  onOpenVoucher: (line: LedgerEventDTO) => void;
}> = ({ title, openingBalance, closingBalance, lines, cellPad, onOpenSource, onOpenVoucher }) => (
  <div className="bg-white border rounded-xl shadow-sm overflow-auto">
    <div className="bg-slate-50/50 px-6 py-3 border-b">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
    </div>
    <table className="min-w-full text-sm">
      <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
        <tr>
          {['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance', 'Actions'].map((h, i) => (
            <th key={h} className={clsx(cellPad, i < 3 || i === 6 ? 'text-left' : 'text-right')}>{h}</th>
          ))}
        </tr>
        <tr className="bg-slate-50/40 border-b border-slate-100">
          <td className={`${cellPad} text-[11px] font-bold text-slate-700 uppercase tracking-widest`} colSpan={6}>{i18n.t(`Opening Balance`)}</td>
          <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-slate-700`}>{fmt(openingBalance)}</td>
        </tr>
      </thead>
      <tbody>
        {lines.length === 0 ? (
          <tr>
            <td colSpan={7} className="py-10 text-center text-sm text-slate-400">{i18n.t(`No transactions in this period.`)}</td>
          </tr>
        ) : (
          lines.map((line, idx) => {
            const canOpenSource = !!statementSourcePath(line);
            const canOpenVoucher = !!voucherPath(line);
            return (
            <tr key={line.ledgerEntryId || idx} className="border-t border-slate-100 hover:bg-blue-50/40">
              <td className={`${cellPad} text-xs text-slate-600`}>{line.date}</td>
              <td className={`${cellPad} text-xs`}>
                <span className={clsx('px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest', lineTone(line.type))}>
                  {line.type}
                </span>
              </td>
              <td className={`${cellPad} text-xs`}>
                <button
                  type="button"
                  onClick={() => (canOpenSource ? onOpenSource(line) : onOpenVoucher(line))}
                  disabled={!canOpenSource && !canOpenVoucher}
                  className="font-mono text-slate-700 hover:text-indigo-700 disabled:hover:text-slate-700 disabled:cursor-default"
                  title={canOpenSource ? 'Open source document' : canOpenVoucher ? 'Open accounting voucher' : undefined}
                >
                  {line.reference}
                </button>
                {line.description && <div className="mt-1 max-w-sm truncate text-[11px] text-slate-400">{line.description}</div>}
              </td>
              <td className={`${cellPad} text-xs tabular-nums text-right text-slate-700`}>{line.debit > 0 ? fmt(line.debit) : '—'}</td>
              <td className={`${cellPad} text-xs tabular-nums text-right text-emerald-600`}>{line.credit > 0 ? fmt(line.credit) : '—'}</td>
              <td className={`${cellPad} text-xs tabular-nums text-right font-semibold text-slate-800`}>{fmt(line.runningBalance)}</td>
              <td className={`${cellPad} text-xs`}>
                <div className="flex flex-wrap gap-2">
                  {canOpenSource && (
                    <button
                      type="button"
                      onClick={() => onOpenSource(line)}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700 hover:bg-indigo-100"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Source
                    </button>
                  )}
                  {canOpenVoucher && (
                    <button
                      type="button"
                      onClick={() => onOpenVoucher(line)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                    >
                      <ReceiptText className="h-3 w-3" />
                      Voucher
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );})
        )}
      </tbody>
      <tfoot>
        <tr className="bg-slate-100 border-t-2 border-slate-200">
          <td className={`${cellPad} text-xs font-black text-slate-700 uppercase tracking-widest`} colSpan={6}>{i18n.t(`Closing Balance`)}</td>
          <td className={`${cellPad} text-xs tabular-nums text-right font-black text-slate-900`}>{fmt(closingBalance)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

// ─── Initiator ──────────────────────────────────────────────────────────────

const Initiator: React.FC<{
  onSubmit: (p: StatementParams) => void;
  initialParams?: StatementParams | null;
}> = ({ onSubmit, initialParams }) => {
    const { t } = useTranslation('common');
  const [mode, setMode]                   = useState<Mode>(initialParams?.mode || 'STATEMENT');
  const [customerId, setCustomerId]       = useState(initialParams?.customerId || '');
  const [customerLabel, setCustomerLabel] = useState(initialParams?.customerLabel || '');
  const [fromDate, setFromDate]           = useState(initialParams?.fromDate || firstOfYear());
  const [toDate, setToDate]               = useState(initialParams?.toDate || today());
  const [includeOpenCommitments, setIncludeOpenCommitments] = useState(initialParams?.includeOpenCommitments || false);

  const canSubmit = !!customerId && !!fromDate && !!toDate;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({ mode, customerId, customerLabel, fromDate, toDate, includeOpenCommitments });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            View
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-slate-50/50 hover:bg-white hover:border-indigo-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
          >
            <option value="STATEMENT">{i18n.t(`Statement (period summary)`)}</option>
            <option value="LEDGER">{i18n.t(`Full Ledger (all events)`)}</option>
          </select>
        </div>

        <div className="md:col-span-8 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {i18n.t(`Customer`)} <span className="text-rose-500">*</span>
          </label>
          <PartySelector
            value={customerId}
            role="CUSTOMER"
            onChange={(party) => {
              if (!party) { setCustomerId(''); setCustomerLabel(''); return; }
              setCustomerId(party.id);
              setCustomerLabel(party.displayName || party.legalName || party.id);
            }}
            placeholder="Select a customer..."
          />
        </div>

        <div className="md:col-span-6 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            From Date
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full" />
        </div>

        <div className="md:col-span-6 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            To Date
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full" />
        </div>

        <label className="md:col-span-12 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeOpenCommitments}
            onChange={(e) => setIncludeOpenCommitments(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Include open commitments
            </span>
            <span className="text-xs text-slate-500">
              Shows open sales orders separately for commercial follow-up. These amounts do not affect the statement balance.
            </span>
          </span>
        </label>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button
          type="submit"
          disabled={!canSubmit}
          className="bg-slate-900 hover:bg-black disabled:opacity-50 text-white px-10 py-3 rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-xl transition-all"
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
  params: StatementParams;
  setTotalItems?: (total: number) => void;
  density?: 'compact' | 'comfortable';
}> = ({ params, setTotalItems, density }) => {
    const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [statement, setStatement] = useState<CustomerStatementDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSource = (line: LedgerEventDTO) => {
    const path = statementSourcePath(line);
    if (path) navigate(path);
  };

  const openVoucher = (line: LedgerEventDTO) => {
    const path = voucherPath(line);
    if (path) navigate(path);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setStatement(null);

    salesReportingApi.getCustomerStatement({
      customerId: params.customerId,
      fromDate: params.fromDate,
      toDate: params.toDate,
      includeOpenCommitments: params.includeOpenCommitments,
    })
      .then((data) => { if (!cancelled) setStatement(data); })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error?.message || err?.message || 'Failed to load report');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [params.customerId, params.fromDate, params.toDate, params.includeOpenCommitments]);

  useEffect(() => {
    setTotalItems?.(statement?.lines.length ?? 0);
  }, [statement?.lines.length, setTotalItems]);

  const cellPad = density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-4';
  const customerName = statement?.customerName ?? params.customerLabel;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-xs font-semibold text-slate-800">
            {params.mode === 'STATEMENT' ? 'Statement' : 'Full Ledger'}
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-200 bg-amber-50 text-xs font-semibold text-slate-800">
            {customerName}
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-xs font-semibold text-slate-800">
            <CalendarDays className="w-3 h-3 text-blue-600" />
            {params.fromDate} → {params.toDate}
          </span>
          {statement && (
            <>
              <span className="text-xs font-bold text-slate-500 ml-auto">
                {i18n.t(`Invoiced:`)} <span className="font-black text-blue-700">{fmt(statement.totalInvoiced)}</span> ·
                Paid: <span className="font-black text-emerald-700">{fmt(statement.totalPaid)}</span> ·
                Credits: <span className="font-black text-amber-700">{fmt(statement.totalCredited ?? 0)}</span> ·
                Closing: <span className="font-black text-slate-900">{fmt(statement.closingBalance)}</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
          )}

          {loading && (
            <div className="py-20 text-center text-sm text-slate-400 animate-pulse">{i18n.t(`Loading report...`)}</div>
          )}

          {!loading && statement && (
            <>
              <LedgerTable
                title={params.mode === 'STATEMENT' ? 'Transactions' : `Full Ledger — ${customerName}`}
                openingBalance={statement.openingBalance}
                closingBalance={statement.closingBalance}
                lines={statement.lines}
                cellPad={cellPad}
                onOpenSource={openSource}
                onOpenVoucher={openVoucher}
              />

              {statement.openInvoices.length > 0 && (
                <div className="bg-white border rounded-xl shadow-sm overflow-auto">
                  <div className="bg-slate-50/50 px-6 py-3 border-b">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      {i18n.t(`Open Invoices (`)}{statement.openInvoices.length})
                    </p>
                  </div>
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                      <tr>
                        {['Invoice #', 'Invoice Date', 'Due Date', 'Invoice Total', 'Outstanding'].map((h, i) => (
                          <th key={h} className={clsx(cellPad, i < 3 ? 'text-left' : 'text-right')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statement.openInvoices.map(inv => (
                        <tr key={inv.invoiceId} className="border-t border-slate-100 hover:bg-blue-50/40">
                          <td className={`${cellPad} text-xs font-mono text-slate-700`}>{inv.invoiceNumber}</td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{inv.invoiceDate}</td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{inv.dueDate ?? '—'}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right text-slate-700`}>{fmt(inv.grandTotalBase)}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-rose-600`}>{fmt(inv.outstandingAmountBase)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {statement.openCommitments && statement.openCommitments.length > 0 && (
                <div className="bg-white border rounded-xl shadow-sm overflow-auto">
                  <div className="bg-slate-50/50 px-6 py-3 border-b">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      {i18n.t(`Open Commitments (`)}{statement.openCommitments.length}) · Not included in balance
                    </p>
                  </div>
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                      <tr>
                        {['Sales Order', 'Date', 'Expected', 'Status', 'Total', 'Open'].map((h, i) => (
                          <th key={h} className={clsx(cellPad, i < 4 ? 'text-left' : 'text-right')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statement.openCommitments.map((commitment) => (
                        <tr key={commitment.sourceId} className="border-t border-slate-100 hover:bg-blue-50/40">
                          <td className={`${cellPad} text-xs font-mono text-slate-700`}>
                            <button
                              type="button"
                              onClick={() => navigate(`/sales/orders/${commitment.sourceId}`)}
                              className="hover:text-indigo-700"
                            >
                              {commitment.documentNumber}
                            </button>
                          </td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{commitment.date}</td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{commitment.expectedDate ?? '—'}</td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{commitment.status}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right text-slate-700`}>{fmt(commitment.amountBase)}</td>
                          <td className={`${cellPad} text-xs tabular-nums text-right font-bold text-amber-700`}>{fmt(commitment.openAmountBase)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!loading && !statement && !error && (
            <div className="py-20 text-center space-y-3">
              <div className="inline-flex p-6 bg-slate-50 rounded-full text-slate-300">
                <FileText size={48} />
              </div>
              <p className="text-sm font-bold text-slate-600">{i18n.t(`No data.`)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Page ───────────────────────────────────────────────────────────────────

const CustomerStatementPage: React.FC = () => (
  <ReportContainer<StatementParams>
    title="Customer Statement"
    subtitle="Period statement or full ledger for a customer"
    initiator={Initiator}
    ReportContent={ReportContent}
    config={{ paginated: false }}
  />
);

export default CustomerStatementPage;
