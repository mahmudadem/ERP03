import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, ExternalLink, FileText, ReceiptText } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { purchasesApi, VendorStatementDTO, VendorStatementLineDTO } from '../../../api/purchasesApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { DatePicker } from '../../accounting/components/shared/DatePicker';

type Mode = 'STATEMENT' | 'LEDGER';

interface StatementParams {
  mode: Mode;
  vendorId: string;
  vendorLabel: string;
  fromDate: string;
  toDate: string;
  includeOpenCommitments: boolean;
}

const firstOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sourcePath = (line: VendorStatementLineDTO): string | null => {
  if (!line.sourceId || line.sourceModule !== 'purchases') return null;
  switch (line.sourceType) {
    case 'PURCHASE_INVOICE':
      return `/purchases/invoices/${line.sourceId}`;
    case 'PURCHASE_RETURN':
      return `/purchases/returns/${line.sourceId}`;
    case 'PURCHASE_ORDER':
      return `/purchases/orders/${line.sourceId}`;
    case 'GOODS_RECEIPT':
      return `/purchases/goods-receipts/${line.sourceId}`;
    default:
      return null;
  }
};

const voucherPath = (line: VendorStatementLineDTO): string | null =>
  line.voucherId ? `/accounting/vouchers/${line.voucherId}/view` : null;

const lineTone = (type: VendorStatementLineDTO['type']) => {
  if (type === 'BILL') return 'bg-blue-50 text-blue-600';
  if (type === 'PAYMENT') return 'bg-emerald-50 text-emerald-600';
  if (type === 'DEBIT_NOTE' || type === 'REFUND') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
};

const VendorLedgerTable: React.FC<{
  title: string;
  openingBalance: number;
  closingBalance: number;
  lines: VendorStatementLineDTO[];
  cellPad: string;
  onOpenSource: (line: VendorStatementLineDTO) => void;
  onOpenVoucher: (line: VendorStatementLineDTO) => void;
}> = ({ title, openingBalance, closingBalance, lines, cellPad, onOpenSource, onOpenVoucher }) => (
  <div className="overflow-auto rounded-xl border bg-white shadow-sm">
    <div className="border-b bg-slate-50/50 px-6 py-3">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</p>
    </div>
    <table className="min-w-full text-sm">
      <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <tr>
          {['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance Owed', 'Actions'].map((h, i) => (
            <th key={h} className={clsx(cellPad, i < 3 || i === 6 ? 'text-left' : 'text-right')}>{h}</th>
          ))}
        </tr>
        <tr className="border-b border-slate-100 bg-slate-50/40">
          <td className={`${cellPad} text-[11px] font-bold uppercase tracking-widest text-slate-700`} colSpan={6}>Opening Balance</td>
          <td className={`${cellPad} text-right text-xs font-bold tabular-nums text-slate-700`}>{fmt(openingBalance)}</td>
        </tr>
      </thead>
      <tbody>
        {lines.length === 0 ? (
          <tr>
            <td colSpan={7} className="py-10 text-center text-sm text-slate-400">No posted vendor activity in this period.</td>
          </tr>
        ) : (
          lines.map((line, idx) => {
            const canOpenSource = !!sourcePath(line);
            const canOpenVoucher = !!voucherPath(line);
            return (
              <tr key={line.ledgerEntryId || idx} className="border-t border-slate-100 hover:bg-blue-50/40">
                <td className={`${cellPad} text-xs text-slate-600`}>{line.date}</td>
                <td className={`${cellPad} text-xs`}>
                  <span className={clsx('rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', lineTone(line.type))}>
                    {line.type}
                  </span>
                </td>
                <td className={`${cellPad} text-xs`}>
                  <button
                    type="button"
                    onClick={() => (canOpenSource ? onOpenSource(line) : onOpenVoucher(line))}
                    disabled={!canOpenSource && !canOpenVoucher}
                    className="font-mono text-slate-700 hover:text-indigo-700 disabled:cursor-default disabled:hover:text-slate-700"
                  >
                    {line.reference}
                  </button>
                  {line.description && <div className="mt-1 max-w-sm truncate text-[11px] text-slate-400">{line.description}</div>}
                </td>
                <td className={`${cellPad} text-right text-xs tabular-nums text-emerald-600`}>{line.debit > 0 ? fmt(line.debit) : '-'}</td>
                <td className={`${cellPad} text-right text-xs tabular-nums text-slate-700`}>{line.credit > 0 ? fmt(line.credit) : '-'}</td>
                <td className={`${cellPad} text-right text-xs font-semibold tabular-nums text-slate-800`}>{fmt(line.runningBalance)}</td>
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
            );
          })
        )}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-200 bg-slate-100">
          <td className={`${cellPad} text-xs font-black uppercase tracking-widest text-slate-700`} colSpan={6}>Closing Balance</td>
          <td className={`${cellPad} text-right text-xs font-black tabular-nums text-slate-900`}>{fmt(closingBalance)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

const Initiator: React.FC<{
  onSubmit: (p: StatementParams) => void;
  initialParams?: StatementParams | null;
}> = ({ onSubmit, initialParams }) => {
  const [mode, setMode] = useState<Mode>(initialParams?.mode || 'STATEMENT');
  const [vendorId, setVendorId] = useState(initialParams?.vendorId || '');
  const [vendorLabel, setVendorLabel] = useState(initialParams?.vendorLabel || '');
  const [fromDate, setFromDate] = useState(initialParams?.fromDate || firstOfYear());
  const [toDate, setToDate] = useState(initialParams?.toDate || today());
  const [includeOpenCommitments, setIncludeOpenCommitments] = useState(initialParams?.includeOpenCommitments || false);

  const canSubmit = !!vendorId && !!fromDate && !!toDate;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({ mode, vendorId, vendorLabel, fromDate, toDate, includeOpenCommitments });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 items-end gap-5 md:grid-cols-12">
        <div className="space-y-2 md:col-span-4">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            View
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold outline-none transition-all hover:border-indigo-300 hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
          >
            <option value="STATEMENT">Statement (period summary)</option>
            <option value="LEDGER">Full Ledger (all posted events)</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-8">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Vendor <span className="text-rose-500">*</span>
          </label>
          <PartySelector
            value={vendorId}
            role="VENDOR"
            onChange={(party) => {
              if (!party) {
                setVendorId('');
                setVendorLabel('');
                return;
              }
              setVendorId(party.id);
              setVendorLabel(party.displayName || party.legalName || party.id);
            }}
            placeholder="Select a vendor..."
          />
        </div>

        <div className="space-y-2 md:col-span-6">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            From Date
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full" />
        </div>

        <div className="space-y-2 md:col-span-6">
          <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            To Date
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full" />
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700 md:col-span-12">
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
              Shows open purchase orders separately for procurement follow-up. These amounts do not affect the vendor statement balance.
            </span>
          </span>
        </label>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-slate-900 px-10 py-3 text-white shadow-lg shadow-slate-900/10 transition-all hover:bg-black hover:shadow-xl disabled:opacity-50"
        >
          <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            Generate Report
            <ChevronRight className="h-4 w-4" />
          </span>
        </Button>
      </div>
    </form>
  );
};

const ReportContent: React.FC<{
  params: StatementParams;
  setTotalItems?: (total: number) => void;
  density?: 'compact' | 'comfortable';
}> = ({ params, setTotalItems, density }) => {
  const navigate = useNavigate();
  const [statement, setStatement] = useState<VendorStatementDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSource = (line: VendorStatementLineDTO) => {
    const path = sourcePath(line);
    if (path) navigate(path);
  };

  const openVoucher = (line: VendorStatementLineDTO) => {
    const path = voucherPath(line);
    if (path) navigate(path);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setStatement(null);

    purchasesApi.getVendorStatement({
      vendorId: params.vendorId,
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
  }, [params.vendorId, params.fromDate, params.toDate, params.includeOpenCommitments]);

  useEffect(() => {
    setTotalItems?.(statement?.lines.length ?? 0);
  }, [statement?.lines.length, setTotalItems]);

  const cellPad = density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2.5';
  const vendorName = statement?.vendorName ?? params.vendorLabel;

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-slate-800">
            {params.mode === 'STATEMENT' ? 'Statement' : 'Full Ledger'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-slate-800">
            {vendorName}
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-slate-800">
            <CalendarDays className="h-3 w-3 text-blue-600" />
            {params.fromDate} to {params.toDate}
          </span>
          {statement && (
            <span className="ml-auto text-xs font-bold text-slate-500">
              Billed: <span className="font-black text-blue-700">{fmt(statement.totalBilled)}</span> ·
              Paid: <span className="font-black text-emerald-700">{fmt(statement.totalPaid)}</span> ·
              Debit notes: <span className="font-black text-amber-700">{fmt(statement.totalDebited)}</span> ·
              Closing owed: <span className="font-black text-slate-900">{fmt(statement.closingBalance)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}
          {loading && <div className="py-20 text-center text-sm text-slate-400 animate-pulse">Loading report...</div>}

          {!loading && statement && (
            <>
              <VendorLedgerTable
                title={params.mode === 'STATEMENT' ? 'Vendor Activity' : `Full Ledger - ${vendorName}`}
                openingBalance={statement.openingBalance}
                closingBalance={statement.closingBalance}
                lines={statement.lines}
                cellPad={cellPad}
                onOpenSource={openSource}
                onOpenVoucher={openVoucher}
              />

              {statement.openBills.length > 0 && (
                <div className="overflow-auto rounded-xl border bg-white shadow-sm">
                  <div className="border-b bg-slate-50/50 px-6 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Open Bills ({statement.openBills.length})
                    </p>
                  </div>
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <tr>
                        {['Bill #', 'Vendor Ref', 'Bill Date', 'Due Date', 'Bill Total', 'Outstanding'].map((h, i) => (
                          <th key={h} className={clsx(cellPad, i < 4 ? 'text-left' : 'text-right')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statement.openBills.map((bill) => (
                        <tr key={bill.invoiceId} className="border-t border-slate-100 hover:bg-blue-50/40">
                          <td className={`${cellPad} font-mono text-xs text-slate-700`}>{bill.invoiceNumber}</td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{bill.vendorInvoiceNumber ?? '-'}</td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{bill.invoiceDate}</td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{bill.dueDate ?? '-'}</td>
                          <td className={`${cellPad} text-right text-xs tabular-nums text-slate-700`}>{fmt(bill.grandTotalBase)}</td>
                          <td className={`${cellPad} text-right text-xs font-bold tabular-nums text-rose-600`}>{fmt(bill.outstandingAmountBase)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {statement.openCommitments && statement.openCommitments.length > 0 && (
                <div className="overflow-auto rounded-xl border bg-white shadow-sm">
                  <div className="border-b bg-slate-50/50 px-6 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      Open Commitments ({statement.openCommitments.length}) · Not included in balance
                    </p>
                  </div>
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <tr>
                        {['Purchase Order', 'Date', 'Expected', 'Status', 'Total', 'Open'].map((h, i) => (
                          <th key={h} className={clsx(cellPad, i < 4 ? 'text-left' : 'text-right')}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statement.openCommitments.map((commitment) => (
                        <tr key={commitment.sourceId} className="border-t border-slate-100 hover:bg-blue-50/40">
                          <td className={`${cellPad} font-mono text-xs text-slate-700`}>
                            <button
                              type="button"
                              onClick={() => navigate(`/purchases/orders/${commitment.sourceId}`)}
                              className="hover:text-indigo-700"
                            >
                              {commitment.documentNumber}
                            </button>
                          </td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{commitment.date}</td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{commitment.expectedDate ?? '-'}</td>
                          <td className={`${cellPad} text-xs text-slate-600`}>{commitment.status}</td>
                          <td className={`${cellPad} text-right text-xs tabular-nums text-slate-700`}>{fmt(commitment.amountBase)}</td>
                          <td className={`${cellPad} text-right text-xs font-bold tabular-nums text-amber-700`}>{fmt(commitment.openAmountBase)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!loading && !statement && !error && (
            <div className="space-y-3 py-20 text-center">
              <div className="inline-flex rounded-full bg-slate-50 p-6 text-slate-300">
                <FileText size={48} />
              </div>
              <p className="text-sm font-bold text-slate-600">No data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const VendorStatementPage: React.FC = () => (
  <ReportContainer<StatementParams>
    title="Vendor Statement"
    subtitle="Posted AP statement and ledger for a vendor"
    initiator={Initiator}
    ReportContent={ReportContent}
    config={{ paginated: false }}
  />
);

export default VendorStatementPage;
