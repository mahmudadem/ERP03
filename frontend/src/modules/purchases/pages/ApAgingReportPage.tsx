import React, { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, CalendarDays } from 'lucide-react';
import {
  purchasesApi,
  ApAgingReportDTO,
  ApAgingVendorRowDTO,
} from '../../../api/purchasesApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { Spinner } from '../../../components/ui/Spinner';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { clsx } from 'clsx';
import { useTranslation } from "react-i18next";

interface ApAgingParams {
  asOfDate: string;
  vendorId?: string;
  vendorLabel?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const fmt = (n: number): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Initiator ──────────────────────────────────────────────────────────────

const Initiator: React.FC<{
  onSubmit: (p: ApAgingParams) => void;
  initialParams?: ApAgingParams | null;
}> = ({ onSubmit, initialParams }) => {
  const [asOfDate, setAsOfDate]     = useState(initialParams?.asOfDate || today());
  const [vendorId, setVendorId]     = useState(initialParams?.vendorId || '');
  const [vendorLabel, setVendorLabel] = useState(initialParams?.vendorLabel || '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          asOfDate,
          vendorId: vendorId || undefined,
          vendorLabel: vendorLabel || undefined,
        });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            As Of Date
          </label>
          <DatePicker value={asOfDate} onChange={setAsOfDate} className="w-full" />
        </div>

        <div className="md:col-span-8 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Vendor (optional)
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
            placeholder="All vendors"
          />
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

// ─── Expandable vendor row ─────────────────────────────────────────────────

const VendorRow: React.FC<{ row: ApAgingVendorRowDTO; cellPad: string }> = ({ row, cellPad }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="border-t border-slate-100 hover:bg-blue-50/40 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className={cellPad}>
          <div className="flex items-center gap-2">
            {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            <span className="font-semibold text-slate-800">{row.vendorName}</span>
          </div>
        </td>
        <td className={`${cellPad} text-right tabular-nums text-slate-700`}>{fmt(row.current)}</td>
        <td className={`${cellPad} text-right tabular-nums text-amber-600`}>{fmt(row.days1_30)}</td>
        <td className={`${cellPad} text-right tabular-nums text-orange-600`}>{fmt(row.days31_60)}</td>
        <td className={`${cellPad} text-right tabular-nums text-red-500`}>{fmt(row.days61_90)}</td>
        <td className={`${cellPad} text-right tabular-nums text-red-700 font-semibold`}>{fmt(row.days90Plus)}</td>
        <td className={`${cellPad} text-right tabular-nums font-bold text-slate-900`}>{fmt(row.total)}</td>
      </tr>
      {open && row.invoices.length > 0 && (
        <tr className="bg-slate-50/80">
          <td colSpan={7} className="px-8 py-3">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Invoice #', 'Vendor Inv #', 'Invoice Date', 'Due Date', 'Days Overdue', 'Bucket', 'Outstanding'].map(h => (
                    <th key={h} className={clsx('pb-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest pr-3', h === 'Outstanding' ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row.invoices.map(inv => (
                  <tr key={inv.invoiceId} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 text-[11px] font-mono text-slate-700">{inv.invoiceNumber}</td>
                    <td className="py-1.5 pr-3 text-[11px] text-slate-600">{inv.vendorInvoiceNumber ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-[11px] text-slate-600">{inv.invoiceDate}</td>
                    <td className="py-1.5 pr-3 text-[11px] text-slate-600">{inv.dueDate ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-[11px] tabular-nums text-slate-600">{inv.daysOverdue}</td>
                    <td className="py-1.5 pr-3 text-[11px] text-slate-600">{inv.bucket}</td>
                    <td className="py-1.5 pr-3 text-[11px] tabular-nums text-right font-medium text-slate-800">{fmt(inv.outstandingAmountBase)}</td>
                  </tr>
                ))}
                {row.unallocated != null && Math.abs(row.unallocated) > 0.005 && (
                  <tr className="border-t border-dashed border-slate-300">
                    <td colSpan={6} className="py-1.5 pr-3 text-[11px] italic text-slate-500">
                      {row.unallocated < 0 ? 'Debit notes / JV adjustments' : 'Unallocated balance'}
                    </td>
                    <td className={clsx('py-1.5 pr-3 text-[11px] tabular-nums text-right font-medium italic', row.unallocated < 0 ? 'text-green-600' : 'text-amber-600')}>
                      {fmt(row.unallocated)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── ReportContent ──────────────────────────────────────────────────────────

const ReportContent: React.FC<{
  params: ApAgingParams;
  setTotalItems?: (total: number) => void;
  density?: 'compact' | 'comfortable';
}> = ({ params, setTotalItems, density }) => {
    const { t } = useTranslation('common');
  const [report, setReport] = useState<ApAgingReportDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    purchasesApi.getApAging({ asOfDate: params.asOfDate, vendorId: params.vendorId })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Failed to load report'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.asOfDate, params.vendorId]);

  useEffect(() => {
    setTotalItems?.(report?.rows.length ?? 0);
  }, [report?.rows.length, setTotalItems]);

  const cellPad = density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-4';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-xs font-semibold text-slate-800">
            <CalendarDays className="w-3 h-3 text-blue-600" />
            {t(`As of`)} {report?.asOfDate ?? params.asOfDate}
          </span>
          {params.vendorLabel && (
            <span className="text-xs font-semibold text-slate-700 border border-amber-200 bg-amber-50 rounded-full px-2 py-1">
              {params.vendorLabel}
            </span>
          )}
          <span className="text-xs font-bold text-slate-500 ml-auto">
            {report?.rows.length ?? 0} {t(`vendor`)}{(report?.rows.length ?? 0) === 1 ? '' : 's'} ·
            Total AP: <span className="font-black text-slate-700">{fmt(report?.totals.total ?? 0)}</span>
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
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{t(`Loading aging...`)}</p>
            </div>
          </div>
        ) : !report || report.rows.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 text-center">
            <p className="text-sm font-bold text-slate-600">{t(`No outstanding payables as of`)} {report?.asOfDate ?? params.asOfDate}</p>
          </div>
        ) : (
          <div className="bg-white border rounded-xl shadow-sm overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                <tr>
                  {['Vendor', 'Current', '1–30 Days', '31–60 Days', '61–90 Days', '90+ Days', 'Total'].map((h, i) => (
                    <th key={h} className={clsx(cellPad, i === 0 ? 'text-left' : 'text-right')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <VendorRow key={r.vendorId} row={r} cellPad={cellPad} />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <td className={cellPad}>{t(`Totals`)}</td>
                  <td className={`${cellPad} text-right tabular-nums`}>{fmt(report.totals.current)}</td>
                  <td className={`${cellPad} text-right tabular-nums text-amber-700`}>{fmt(report.totals.days1_30)}</td>
                  <td className={`${cellPad} text-right tabular-nums text-orange-700`}>{fmt(report.totals.days31_60)}</td>
                  <td className={`${cellPad} text-right tabular-nums text-red-600`}>{fmt(report.totals.days61_90)}</td>
                  <td className={`${cellPad} text-right tabular-nums text-red-800`}>{fmt(report.totals.days90Plus)}</td>
                  <td className={`${cellPad} text-right tabular-nums`}>{fmt(report.totals.total)}</td>
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

const ApAgingReportPage: React.FC = () => (
  <ReportContainer<ApAgingParams>
    title="AP Aging"
    subtitle="Accounts payable by aging bucket"
    initiator={Initiator}
    ReportContent={ReportContent}
    config={{ paginated: false }}
  />
);

export default ApAgingReportPage;
