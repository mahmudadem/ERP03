import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accountingApi } from '../../../api/accountingApi';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useNavigate } from 'react-router-dom';
import { exportToExcel } from '../../../utils/exportUtils';
import { DatePicker } from '../components/shared/DatePicker';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { CalendarDays } from 'lucide-react';
import { useCompanyCurrencies } from '../hooks/useCompanyCurrencies';

/* ── Types ────────────────────────────────────────────── */

interface JournalParams {
  fromDate: string;
  toDate: string;
  voucherType?: string;
  formName?: string;
  currency?: string;
  status?: string;
}

interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  currency?: string;
  exchangeRate?: number;
}

interface JournalVoucher {
  voucherId: string;
  voucherNo: string;
  date: string;
  type: string;
  description: string;
  status: string;
  currency: string;
  formId?: string;
  formName?: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
}

/* ── Initiator (Filters Form) ─────────────────────────── */

const VOUCHER_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'journal_entry', label: 'Journal Entry' },
  { value: 'payment', label: 'Payment Voucher' },
  { value: 'receipt', label: 'Receipt Voucher' },
  { value: 'opening_balance', label: 'Opening Balance' },
  { value: 'reversal', label: 'Reversal' },
  { value: 'fx_revaluation', label: 'FX Revaluation' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const JournalInitiator: React.FC<{
  onSubmit: (params: JournalParams) => void;
  initialParams?: JournalParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('accounting');
  const today = new Date().toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(initialParams?.fromDate || today);
  const [toDate, setToDate] = useState(initialParams?.toDate || today);
  const [voucherType, setVoucherType] = useState(initialParams?.voucherType || '');
  const [formName, setFormName] = useState(initialParams?.formName || '');
  const [currency, setCurrency] = useState(initialParams?.currency || '');
  const [status, setStatus] = useState(initialParams?.status || '');
  const [forms, setForms] = useState<Array<{ id: string; name: string }>>([]);
  const { data: companyCurrencies = [] } = useCompanyCurrencies();

  useEffect(() => {
    (async () => {
      try {
        const { voucherFormApi } = await import('../../../api/voucherFormApi');
        const allForms = await voucherFormApi.list();
        setForms((allForms || []).filter((f: any) => f.enabled !== false).map((f: any) => ({ id: f.id, name: f.name })));
      } catch { /* silent */ }
    })();
  }, []);

  const selectClass = 'w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          fromDate, toDate,
          ...(voucherType && { voucherType }),
          ...(formName && { formName }),
          ...(currency && { currency }),
          ...(status && { status }),
        });
      }}
      className="space-y-6"
    >
      {/* Row 1: Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('accountStatement.from', { defaultValue: 'From' })}
          </label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-full text-base" />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            {t('accountStatement.to', { defaultValue: 'To' })}
          </label>
          <DatePicker value={toDate} onChange={setToDate} className="w-full text-base" />
        </div>
      </div>

      {/* Row 2: Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            Voucher Type
          </label>
          <select value={voucherType} onChange={e => setVoucherType(e.target.value)} className={selectClass}>
            {VOUCHER_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            Voucher Form
          </label>
          <select value={formName} onChange={e => setFormName(e.target.value)} className={selectClass}>
            <option value="">All Forms</option>
            {forms.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            Currency
          </label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className={selectClass}>
            <option value="">All Currencies</option>
            {companyCurrencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            Status
          </label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
            {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {/* Submit */}
      <div>
        <Button type="submit" className="bg-slate-900 hover:bg-black text-white px-8 py-2.5 rounded text-xs font-bold uppercase tracking-widest">
          Generate Report
        </Button>
      </div>
    </form>
  );
};

/* ── Report Content ───────────────────────────────────── */

const numberFmt = (n: number) =>
  n ? n.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '';

const JournalReportContent: React.FC<{ params: JournalParams }> = ({ params }) => {
  const { settings } = useCompanySettings();
  const { t } = useTranslation('accounting');
  const navigate = useNavigate();
  const [data, setData] = useState<JournalVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiParams: any = { fromDate: params.fromDate, toDate: params.toDate };
        if (params.voucherType) apiParams.voucherType = params.voucherType;
        if (params.currency) apiParams.currency = params.currency;
        if (params.status) apiParams.status = params.status;
        if (params.formName) apiParams.formName = params.formName;
        const result = await accountingApi.getJournal(apiParams);
        setData(result || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load journal data');
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.fromDate, params.toDate, params.voucherType, params.currency, params.status, params.formName]);

  const totals = useMemo(() => {
    return data.reduce((acc, v) => {
      acc.debit += v.totalDebit || 0;
      acc.credit += v.totalCredit || 0;
      return acc;
    }, { debit: 0, credit: 0 });
  }, [data]);

  const periodText = `${formatCompanyDate(params.fromDate, settings)} — ${formatCompanyDate(params.toDate, settings)}`;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Context Bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Period</span>
            <span className="text-sm font-semibold text-slate-800">{periodText}</span>
          </div>
          {params.voucherType && (
            <span className="text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 rounded-full px-2 py-1">
              Type: {VOUCHER_TYPES.find(v => v.value === params.voucherType)?.label || params.voucherType}
            </span>
          )}
          {params.formName && (
            <span className="text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 rounded-full px-2 py-1">
              Form: {params.formName}
            </span>
          )}
          {params.currency && (
            <span className="text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 rounded-full px-2 py-1">
              Currency: {params.currency}
            </span>
          )}
          {params.status && (
            <span className="text-xs font-semibold text-slate-600 border border-slate-200 bg-slate-50 rounded-full px-2 py-1">
              Status: {params.status}
            </span>
          )}
          <span className="text-xs font-bold text-slate-500">
            {data.length} voucher{data.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4" id="journal-report">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
        )}

        {loading ? (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-center min-h-[180px]">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Processing...</p>
              </div>
            </div>
          </div>
        ) : data.length === 0 && !error ? (
          <div className="bg-white border rounded-xl p-8 shadow-sm text-center">
            <p className="text-slate-400 text-sm">No journal entries found for the selected criteria.</p>
          </div>
        ) : (
          <>
            {data.map((v) => (
              <div key={v.voucherId} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {/* Voucher Header */}
                <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-slate-800">
                      {formatCompanyDate(v.date, settings)}
                    </div>
                    <div className="h-4 w-px bg-slate-300" />
                    <button
                      className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                      onClick={() => navigate(`/accounting/vouchers/${v.voucherId}`)}
                    >
                      {v.voucherNo}
                    </button>
                    <div className="h-4 w-px bg-slate-300" />
                    <span className="text-xs font-semibold text-slate-500 uppercase">{v.type}</span>
                    {v.formName && (
                      <>
                        <div className="h-4 w-px bg-slate-300" />
                        <span className="text-xs text-slate-400">{v.formName}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {v.currency && (
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{v.currency}</span>
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      v.status === 'approved' ? 'bg-green-100 text-green-700' :
                      v.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      v.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                      v.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {v.status}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {v.description && (
                  <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-50">
                    {v.description}
                  </div>
                )}

                {/* Lines Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="text-left px-4 py-2">Account</th>
                      <th className="text-left px-4 py-2">Description</th>
                      <th className="text-right px-4 py-2">Debit</th>
                      <th className="text-right px-4 py-2">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.lines.map((l, idx) => (
                      <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-4 py-2">
                          <div className="font-semibold text-slate-800">{l.accountCode}</div>
                          <div className="text-xs text-slate-400">{l.accountName}</div>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{l.description || '—'}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">{numberFmt(l.debit)}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">{numberFmt(l.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Voucher Totals */}
                <div className="flex justify-end gap-8 px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-sm font-bold">
                  <span className="text-slate-600">Debit: <span className="font-mono text-slate-900">{numberFmt(v.totalDebit)}</span></span>
                  <span className="text-slate-600">Credit: <span className="font-mono text-slate-900">{numberFmt(v.totalCredit)}</span></span>
                </div>
              </div>
            ))}

            {/* Grand Totals */}
            {data.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Grand Total</span>
                  <div className="flex gap-8 text-sm font-bold">
                    <span className="text-slate-600">Debit: <span className="font-mono text-slate-900">{numberFmt(totals.debit)}</span></span>
                    <span className="text-slate-600">Credit: <span className="font-mono text-slate-900">{numberFmt(totals.credit)}</span></span>
                    {Math.abs(totals.debit - totals.credit) < 0.01 && (
                      <span className="text-green-600 text-xs font-bold">✓ Balanced</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ── Excel Export ──────────────────────────────────────── */

const exportJournalToExcel = async (params: JournalParams) => {
  const apiParams: any = { fromDate: params.fromDate, toDate: params.toDate };
  if (params.voucherType) apiParams.voucherType = params.voucherType;
  if (params.currency) apiParams.currency = params.currency;
  if (params.status) apiParams.status = params.status;
  if (params.formName) apiParams.formName = params.formName;

  const result: JournalVoucher[] = await accountingApi.getJournal(apiParams);
  const rows: any[] = [];
  (result || []).forEach((v) =>
    v.lines.forEach((l) =>
      rows.push({
        date: v.date,
        voucherNo: v.voucherNo,
        type: v.type,
        status: v.status,
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description,
        debit: l.debit,
        credit: l.credit,
      })
    )
  );

  exportToExcel(
    rows,
    [
      { header: 'Date', key: 'date' },
      { header: 'Voucher No', key: 'voucherNo' },
      { header: 'Type', key: 'type' },
      { header: 'Status', key: 'status' },
      { header: 'Account Code', key: 'accountCode' },
      { header: 'Account Name', key: 'accountName' },
      { header: 'Description', key: 'description' },
      { header: 'Debit', key: 'debit', isNumber: true },
      { header: 'Credit', key: 'credit', isNumber: true },
    ],
    `Journal-${params.fromDate}-to-${params.toDate}`,
    'Journal / Day Book'
  );
};

/* ── Page Component ───────────────────────────────────── */

const JournalPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  return (
    <ReportContainer<JournalParams>
      title={t('journal.title', { defaultValue: 'Journal / Day Book' })}
      subtitle={t('journal.subtitle', { defaultValue: 'Chronological record of all voucher entries' })}
      initiator={JournalInitiator}
      ReportContent={JournalReportContent}
      onExportExcel={exportJournalToExcel}
      config={{ paginated: false }}
    />
  );
};

export default JournalPage;
