import React, { useEffect, useMemo, useState } from 'react';
import { PendingApprovalsWidget } from './components/PendingApprovalsWidget';
import { LayoutDashboard, FileText, ArrowRightLeft, TrendingUp, Wallet, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { accountingApi } from '../../api/accountingApi';
import { useNavigate } from 'react-router-dom';

const SkeletonCard: React.FC = () => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-pulse">
    <div className="h-4 w-20 bg-slate-200 rounded mb-3" />
    <div className="h-8 w-24 bg-slate-200 rounded mb-2" />
    <div className="h-3 w-16 bg-slate-100 rounded" />
  </div>
);

const AccountingDashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await accountingApi.getDashboardSummary();
      setSummary(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const pctChange = useMemo(() => {
    if (!summary) return 0;
    const { vouchers } = summary;
    if (!vouchers.lastMonthTotal) return 0;
    return ((vouchers.total - vouchers.lastMonthTotal) / Math.max(1, vouchers.lastMonthTotal)) * 100;
  }, [summary]);

  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <LayoutDashboard size={32} className="text-primary-600" />
              Accounting Dashboard
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Real-time overview of your financial operations and required actions.</p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="lg:col-span-2">
            <PendingApprovalsWidget />
          </div>

          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                    <FileText size={20} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Total Vouchers</h3>
                  <p className="text-2xl font-black text-slate-900">{summary?.vouchers?.total ?? 0}</p>
                  <p className={`text-xs font-bold mt-1 ${pctChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pctChange >= 0 ? '+' : ''}
                    {pctChange.toFixed(1)}% vs last month
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                    <TrendingUp size={20} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Cash On Hand</h3>
                  <p className="text-2xl font-black text-slate-900">
                    {summary?.cashPosition?.toLocaleString(undefined, { minimumFractionDigits: 2 })} {summary?.baseCurrency || ''}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Across cash/bank accounts</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft size={20} className="text-slate-400" />
                Recent Journal Entries
              </h2>
              <button className="text-sm font-bold text-primary-600 hover:underline" onClick={() => navigate('/accounting/reports/ledger')}>
                View Ledger
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : summary?.recentVouchers?.length ? (
              <div className="divide-y">
                {summary.recentVouchers.map((v: any) => (
                  <div key={v.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{v.voucherNo || v.id}</div>
                      <div className="text-xs text-slate-500">{v.date} · {v.type}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-slate-800">
                        {v.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className={`text-[11px] uppercase font-bold ${v.posted ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {v.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No vouchers yet.</div>
            )}
          </div>

          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-200 flex flex-col justify-between">
            <div>
              <div className="bg-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                 <Wallet size={24} className="text-primary-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Financial Reports</h2>
              <p className="text-slate-400 text-sm mb-8">Access P&L, Balance Sheet, Trial Balance.</p>
              
              <ul className="space-y-4">
                {[
                  { label: 'Trial Balance', path: '/accounting/reports/trial-balance' },
                  { label: 'Balance Sheet', path: '/accounting/reports/balance-sheet' },
                  { label: 'Profit & Loss', path: '/accounting/reports/profit-loss' },
                  { label: 'Trading Account', path: '/accounting/reports/trading-account' },
                  { label: 'Account Statement', path: '/accounting/reports/account-statement' },
                  { label: 'Aging Report', path: '/accounting/reports/aging' },
                ].map(report => (
                  <li key={report.label} className="flex items-center justify-between group cursor-pointer hover:text-primary-400 transition-colors" onClick={() => navigate(report.path)}>
                    <span className="font-semibold text-slate-200 group-hover:text-white">{report.label}</span>
                    <TrendingUp size={16} className="text-slate-600 group-hover:text-primary-400" />
                  </li>
                ))}
              </ul>
            </div>
            
            <button className="w-full bg-primary-600 hover:bg-primary-700 py-4 rounded-2xl font-bold mt-10 transition-colors shadow-lg shadow-primary-900/20" onClick={() => navigate('/accounting/vouchers')}>
              New Voucher
            </button>
          </div>
        </div>

        {!loading && summary?.unbalancedDrafts > 0 && (
          <div className="mt-8 p-4 border border-red-200 bg-red-50 rounded-xl flex items-center gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            {summary.unbalancedDrafts} unbalanced draft voucher(s) need attention.
          </div>
        )}
        {!loading && summary?.fiscalPeriodStatus && (
          <div className="mt-4 p-3 border border-slate-200 bg-white rounded-lg inline-flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Current period status: {summary.fiscalPeriodStatus}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountingDashboard;
