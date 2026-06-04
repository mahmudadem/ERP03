import React from 'react';
import { 
  COAAccount, 
  Invoice, 
  PurchaseBill 
} from '../types';
import { 
  DollarSign, 
  Layers, 
  AlertTriangle, 
  Activity, 
  CheckCircle2, 
  TrendingUp, 
  ArrowUpRight, 
  TrendingDown,
  CalendarCheck
} from 'lucide-react';
import { AUDIT_LOGS } from '../utils/dummyData';

interface DashboardHomeProps {
  accounts: COAAccount[];
  invoices: Invoice[];
  bills: PurchaseBill[];
  setActiveTab: (tab: string) => void;
}

export default function DashboardHome({ accounts, invoices, bills, setActiveTab }: DashboardHomeProps) {
  // Compute financial totals dynamically
  const cashHeadOffice = accounts.find(a => a.code === '10101')?.balance || 0;
  const cashRetail = accounts.find(a => a.code === '10102')?.balance || 0;
  const bankOperating = accounts.find(a => a.code === '10201')?.balance || 0;
  const bankLC = accounts.find(a => a.code === '10202')?.balance || 0;

  const totalCashAndLiquidity = cashHeadOffice + cashRetail + bankOperating + bankLC;
  const accountsReceivable = invoices
    .filter(inv => inv.status === 'Posted' || inv.status === 'Overdue')
    .reduce((sum, inv) => sum + (inv.totalAmount - inv.amountPaid), 0);
  
  const accountsPayable = bills
    .filter(b => b.status === 'Approved' || b.status === 'Draft')
    .reduce((sum, b) => sum + b.totalAmount, 0);

  // Overdue Invoices
  const overdueUnpaid = invoices
    .filter(inv => inv.status === 'Overdue')
    .reduce((sum, inv) => sum + (inv.totalAmount - inv.amountPaid), 0);
  
  const overdueCount = invoices.filter(inv => inv.status === 'Overdue').length;

  const fmt = (num: number) => num.toLocaleString('en-US');

  return (
    <div className="space-y-6">
      {/* Overview Head */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Enterprise Overview Dashboard</h1>
          <p className="text-xs text-slate-500">Real-time dynamic monitoring, corporate liquidity, and trade ledger summaries.</p>
        </div>
        <div className="flex items-center space-x-2.5">
          <span className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Production Ledger Online</span>
          </span>
          <span className="text-xs font-mono text-slate-400">Database Rev: 2026-05-30T22</span>
        </div>
      </div>

      {/* Corporate KPIs Bento */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Liquidity</span>
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-lg font-bold text-slate-800 font-mono tracking-tight block">
              {fmt(totalCashAndLiquidity)} <span className="text-xs text-slate-400 font-sans font-normal">SYP</span>
            </span>
            <div className="flex items-center space-x-1 mt-1 text-[11px]">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600 font-semibold font-mono">14.2%</span>
              <span className="text-slate-400">vs prior month</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Receivables (AR)</span>
            <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-lg font-bold text-slate-800 font-mono tracking-tight block">
              {fmt(accountsReceivable)} <span className="text-xs text-slate-400 font-sans font-normal">SYP</span>
            </span>
            <div className="flex items-center space-x-1 mt-1 text-[11px]">
              <span className="text-amber-600 font-semibold font-mono">{invoices.filter(i => i.status === 'Posted').length} posted</span>
              <span className="text-slate-400">waiting for settlement</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payables (AP)</span>
            <div className="w-8 h-8 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-lg font-bold text-slate-800 font-mono tracking-tight block">
              {fmt(accountsPayable)} <span className="text-xs text-slate-400 font-sans font-normal">SYP</span>
            </span>
            <div className="flex items-center space-x-1 mt-1 text-[11px]">
              <span className="text-purple-600 font-semibold font-mono">{bills.filter(b => b.status === 'Approved').length} bill(s)</span>
              <span className="text-slate-400">scheduled for trade vendors</span>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between relative overflow-hidden">
          {overdueCount > 0 && (
            <div className="absolute top-0 right-0 left-0 h-1 bg-rose-500"></div>
          )}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue Risk</span>
            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${overdueCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-lg font-bold text-slate-800 font-mono tracking-tight block">
              {overdueCount > 0 ? `${fmt(overdueUnpaid)} SYP` : 'No risk detected'}
            </span>
            <div className="flex items-center space-x-1 mt-1 text-[11px]">
              {overdueCount > 0 ? (
                <>
                  <span className="text-rose-600 font-semibold font-mono">{overdueCount} critical</span>
                  <span className="text-slate-400">payments overdue</span>
                </>
              ) : (
                <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> All customer accounts inside grace limit
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area SVG Chart */}
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-blue-600" /> Operating Cash Flow & Revenue Trend
              </h2>
              <p className="text-[11px] text-slate-500">Cumulative quarterly sales vs raw administrative expenses.</p>
            </div>
            {/* Legend */}
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-1.5 rounded-full bg-blue-600 block"></span>
                <span className="text-slate-500 font-medium">Sales Revenue</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-1.5 rounded-full bg-slate-300 block"></span>
                <span className="text-slate-500 font-medium">Expenses</span>
              </div>
            </div>
          </div>

          {/* Sincere, beautiful, precision SVG line graphs */}
          <div className="relative w-full h-64 bg-[#FAFAFB] rounded-lg border border-[#F1F3F5] flex flex-col justify-between p-3">
            {/* SVG Content */}
            <svg className="absolute inset-x-0 inset-y-0 w-full h-full p-4" viewBox="0 0 500 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                </linearGradient>
              </defs>
              {/* Horizontal Gridlines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="140" x2="500" y2="140" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />

              {/* Expense Line */}
              <path
                d="M 0 160 Q 100 150, 200 130 T 400 110 T 500 90"
                fill="none"
                stroke="#94A3B8"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Revenue Area Fill */}
              <path
                d="M 0 200 L 0 180 Q 100 140, 200 90 T 400 50 T 500 30 L 500 200 Z"
                fill="url(#colorRevenue)"
              />

              {/* Revenue Line */}
              <path
                d="M 0 180 Q 100 140, 200 90 T 400 50 T 500 30"
                fill="none"
                stroke="#2563EB"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Reference Tooltip Dot */}
              <circle cx="400" cy="50" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="400" cy="110" r="4" fill="#94A3B8" stroke="#FFFFFF" strokeWidth="1.5" />
            </svg>

            {/* Custom SVG Tooltip */}
            <div className="absolute top-6 right-16 bg-white p-2.5 rounded border border-slate-205 shadow-md text-right text-[10px] pointer-events-none">
              <span className="block font-semibold text-slate-700">الربع الثاني 2026 - تقديرات</span>
              <span className="block text-blue-600 font-mono font-bold">المبيعات: 320,000,000 ل.س</span>
              <span className="block text-slate-400 font-mono font-bold">المصاريف: 130,000,000 ل.س</span>
            </div>

            {/* Axis labels */}
            <div className="text-[10px] font-mono font-bold text-slate-400 flex justify-between pt-[175px]">
              <span>JAN 2026</span>
              <span>FEB 2026</span>
              <span>MAR 2026</span>
              <span>APR 2026</span>
              <span>MAY 2026</span>
              <span>JUN 2026</span>
            </div>
          </div>
          
          <div className="mt-4 bg-[#F8FAFC] border border-slate-100 p-3 rounded-md flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <CalendarCheck className="w-4 h-4 text-blue-600" />
              <span>إغلاق الفترة المالية المخطط له: 31 كانون الأول 2026</span>
            </span>
            <button 
              onClick={() => setActiveTab('accounting')} 
              className="text-blue-600 font-semibold hover:underline"
            >
              عرض ميزان المراجعة ←
            </button>
          </div>
        </div>

        {/* Security & System Info & Logs */}
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-600" /> Recent Security & Audit Logs
            </h2>
            <div className="space-y-4">
              {AUDIT_LOGS.map((log) => (
                <div key={log.id} className="text-xs group border-b border-dashed border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                    <span>{log.date}</span>
                    <span className="bg-slate-100 group-hover:bg-blue-50 text-slate-600 px-1.5 py-0.5 rounded font-sans text-[9px] font-semibold">{log.user}</span>
                  </div>
                  <p className="font-semibold text-slate-700 mt-1">{log.action}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{log.branch} cluster cluster_node_01</p>
                </div>
              ))}
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('dev')}
            className="w-full mt-4 text-center border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 rounded-md transition-colors"
          >
            عرض سجلات التدقيق الكاملة
          </button>
        </div>
      </div>
    </div>
  );
}
