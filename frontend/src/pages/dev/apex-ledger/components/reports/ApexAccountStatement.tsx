import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { accountingApi, AccountStatementData, AccountStatementEntry } from '../../../../../api/accountingApi';
import { AccountSelector } from '../../../../../modules/accounting/components/shared/AccountSelector';
import { AccountsProvider } from '../../../../../context/AccountsContext';
import { ArrowUpRight, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { useTranslation } from "react-i18next";

const fmt = (v: number) =>
  v !== 0 ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const sortEntries = (entries: AccountStatementEntry[]) =>
  [...entries].sort((a, b) => {
    const d = String(a.date || '').localeCompare(String(b.date || ''));
    if (d !== 0) return d;
    return String(a.voucherNo || '').localeCompare(String(b.voucherNo || ''), undefined, { numeric: true });
  });

function AccountStatementInner() {
    const { t } = useTranslation('common');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlAccountId = searchParams.get('accountId') || '';
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [accountId, setAccountId] = useState(urlAccountId);
  const [accountName, setAccountName] = useState('');
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);
  const [includeUnposted, setIncludeUnposted] = useState(false);
  const [data, setData] = useState<AccountStatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const generate = useCallback(async (aid?: string) => {
    const id = aid ?? accountId;
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const result = await accountingApi.getAccountStatement(id, fromDate, toDate, includeUnposted);
      setData(result);
      setGenerated(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to load account statement');
      setData(null);
    } finally { setLoading(false); }
  }, [accountId, fromDate, toDate, includeUnposted]);

  // Auto-generate if accountId comes from URL
  useEffect(() => {
    if (urlAccountId) { setAccountId(urlAccountId); generate(urlAccountId); }
  }, [urlAccountId]); // eslint-disable-line

  const entries = data ? sortEntries(data.entries || []) : [];
  const baseCcy = data?.baseCurrency || '';
  const acctCcy = data?.accountCurrency || '';
  const showBase = Boolean(baseCcy && acctCcy && baseCcy !== acctCcy);

  return (
    <div className="space-y-4 font-sans">
      {/* Filter bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">{t(`Account *`)}</label>
            <AccountSelector
              value={accountId}
              scope="all"
              onChange={(acct) => {
                setAccountId(acct?.id || '');
                setAccountName(acct?.name || '');
              }}
              placeholder="Select account..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">{t(`From Date`)}</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">{t(`To Date`)}</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded px-3 py-1.5 text-xs font-semibold outline-none focus:border-blue-400" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
            <input type="checkbox" checked={includeUnposted} onChange={e => setIncludeUnposted(e.target.checked)}
              className="rounded border-slate-300 text-blue-600" />
            Include Unposted
          </label>
          <button onClick={() => generate()} disabled={!accountId || loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            {loading ? 'Loading...' : 'Generate Statement'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {generated && data && !loading && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
          {/* Report header */}
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3">
            <div className="flex flex-wrap gap-6 text-xs">
              <div>
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">{t(`Account`)}</span>
                <span className="font-bold text-slate-800">{data.accountCode} — {data.accountName}
                  {acctCcy && <span className="ml-1 text-slate-500 font-normal">({acctCcy})</span>}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">{t(`Period`)}</span>
                <span className="font-bold text-slate-800">{data.fromDate} → {data.toDate}</span>
              </div>
              <div>
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">{t(`Opening Balance`)}</span>
                <span className={`font-mono font-bold ${data.openingBalance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {fmt(data.openingBalance)} {acctCcy || baseCcy}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">{t(`Closing Balance`)}</span>
                <span className={`font-mono font-bold ${data.closingBalance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {fmt(data.closingBalance)} {acctCcy || baseCcy}
                </span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-8">#</th>
                  <th className="px-3 py-2.5 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-24">{t(`Date`)}</th>
                  <th className="px-3 py-2.5 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-28">{t(`Voucher`)}</th>
                  <th className="px-3 py-2.5 text-left text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">{t(`Description`)}</th>
                  <th className="px-3 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-32">{t(`Debit`)} {acctCcy || baseCcy}</th>
                  <th className="px-3 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-32">{t(`Credit`)} {acctCcy || baseCcy}</th>
                  {showBase && <th className="px-3 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-24">{t(`FX Rate`)}</th>}
                  <th className="px-3 py-2.5 text-right text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest w-36">{t(`Balance`)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {/* Opening balance row */}
                <tr className="bg-slate-50">
                  <td className="px-3 py-2 text-[10px] font-mono text-slate-400"></td>
                  <td className="px-3 py-2 text-[10px] font-mono text-slate-500">—</td>
                  <td className="px-3 py-2 text-[10px] font-bold text-slate-500">{t(`OPENING`)}</td>
                  <td className="px-3 py-2 text-[10px] font-semibold text-slate-500">{t(`Opening Balance`)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[10px] text-slate-400">—</td>
                  <td className="px-3 py-2 text-right font-mono text-[10px] text-slate-400">—</td>
                  {showBase && <td className="px-3 py-2 text-right font-mono text-[10px] text-slate-400">—</td>}
                  <td className={`px-3 py-2 text-right font-mono text-xs font-bold ${data.openingBalance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {fmt(data.openingBalance)}
                  </td>
                </tr>

                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={showBase ? 8 : 7} className="py-12 text-center text-xs text-slate-400">{t(`No entries in this period`)}</td>
                  </tr>
                ) : (
                  entries.map((entry, idx) => (
                    <tr key={entry.id} className={`hover:bg-slate-50/60 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFB]'}`}>
                      <td className="px-3 py-2 text-[10px] font-mono text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2 text-[10px] font-mono text-slate-600 whitespace-nowrap">{entry.date}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => navigate(`/dev/apex-ledger/vouchers?id=${entry.voucherId}`)}
                          className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5">
                          {entry.voucherNo || entry.voucherId}
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </button>
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-700 max-w-xs truncate">{entry.description || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-[10px] text-slate-700">
                        {entry.debit ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[10px] text-slate-700">
                        {entry.credit ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                      </td>
                      {showBase && (
                        <td className="px-3 py-2 text-right font-mono text-[10px] text-slate-500">
                          {entry.exchangeRate ? entry.exchangeRate.toFixed(4) : '—'}
                        </td>
                      )}
                      <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${entry.balance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {entry.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-[#F8FAFC] border-t-2 border-[#E2E8F0]">
                <tr>
                  <td colSpan={3} className="px-3 py-2.5 text-right text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">{t(`Totals`)}</td>
                  <td className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-blue-700">
                    {fmt(data.totalDebit)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-blue-700">
                    {fmt(data.totalCredit)}
                  </td>
                  {showBase && <td />}
                  <td />
                </tr>
                <tr>
                  <td colSpan={showBase ? 7 : 6} className="px-3 py-2.5 text-right text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    Closing Balance
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono text-sm font-bold ${data.closingBalance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {fmt(data.closingBalance)} {acctCcy || baseCcy}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!generated && !loading && (
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center">
          <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-mono">{t(`Select an account and click Generate Statement`)}</p>
        </div>
      )}
    </div>
  );
}

export default function ApexAccountStatement() {
  return (
    <AccountsProvider>
      <AccountStatementInner />
    </AccountsProvider>
  );
}
