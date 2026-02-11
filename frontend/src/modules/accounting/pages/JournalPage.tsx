import React, { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../../api/accountingApi';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { RefreshCw, Printer, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const JournalPage: React.FC = () => {
  const { settings } = useCompanySettings();
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState<string>(() => `${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [voucherType, setVoucherType] = useState<string>('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { fromDate, toDate };
      if (voucherType) params.voucherType = voucherType;
      const result = await accountingApi.getJournal(params);
      setData(result || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    return data.reduce(
      (acc, v) => {
        acc.debit += v.totalDebit || 0;
        acc.credit += v.totalCredit || 0;
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [data]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Journal / Day Book</h1>
          <p className="text-sm text-slate-600">Vouchers listed chronologically with full lines.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4 shadow-sm">
        <div>
          <label className="text-xs font-semibold text-[var(--color-text-muted)]">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-[var(--color-text-muted)]">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-[var(--color-text-muted)]">Voucher Type</label>
          <input
            type="text"
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value.toUpperCase())}
            className="border rounded px-2 py-1 text-sm"
            placeholder="JE, PV, RV..."
          />
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-md text-sm"
          disabled={loading}
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
          Apply
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-slate-500">No vouchers in this period.</div>
        ) : (
          data.map((v) => (
            <div key={v.voucherId} className="bg-white border rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="text-sm font-semibold">
                    Date: {formatCompanyDate(v.date, settings)} &nbsp; · &nbsp; Voucher:{" "}
                    <button className="text-indigo-600 font-bold" onClick={() => navigate(`/accounting/vouchers/${v.voucherId}`)}>
                      {v.voucherNo}
                    </button>
                    &nbsp; · &nbsp; Type: {v.type}
                  </div>
                  <div className="text-xs text-slate-500">Description: {v.description || '—'}</div>
                </div>
                <div className="text-xs uppercase font-bold text-slate-600">{v.status}</div>
              </div>

              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2">Account</th>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Debit</th>
                    <th className="py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {v.lines.map((l: any, idx: number) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-1">
                        <div className="font-semibold">{l.accountCode}</div>
                        <div className="text-xs text-slate-500">{l.accountName}</div>
                      </td>
                      <td className="py-1 text-slate-700">{l.description || '—'}</td>
                      <td className="py-1 text-right font-mono">{l.debit ? l.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>
                      <td className="py-1 text-right font-mono">{l.credit ? l.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end gap-6 mt-2 text-sm font-bold">
                <span>Debit: {v.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span>Credit: {v.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && data.length > 0 && (
        <div className="bg-white border rounded-xl p-4 shadow-sm flex justify-end gap-6 font-bold">
          <span>Total Debit: {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <span>Total Credit: {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      )}
    </div>
  );
};

export default JournalPage;
