import React from 'react';
import { PendingApprovalsWidget } from './components/PendingApprovalsWidget';
import { LayoutDashboard, FileText, ArrowRightLeft, TrendingUp, Wallet } from 'lucide-react';

const AccountingDashboard: React.FC = () => {
  return (
    <div className="p-8 bg-[#F8FAFC] min-h-screen">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <LayoutDashboard size={32} className="text-primary-600" />
              Accounting Dashboard
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Real-time overview of your financial operations and required actions.</p>
          </div>
        </div>

        {/* Top Grid: Critical Actions & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          
          {/* CRITICAL: Approvals Widget */}
          <div className="lg:col-span-2">
            <PendingApprovalsWidget />
          </div>

          {/* Quick Access Card 1 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                <FileText size={20} />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Total Vouchers</h3>
              <p className="text-2xl font-black text-slate-900">1,248</p>
              <p className="text-xs text-green-600 font-bold mt-1">+12% this month</p>
            </div>
          </div>

          {/* Quick Access Card 2 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                <TrendingUp size={20} />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Cash On Hand</h3>
              <p className="text-2xl font-black text-slate-900">$459.2k</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Across 4 main accounts</p>
            </div>
          </div>
        </div>

        {/* Main Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Recent Activity (Placeholder for now) */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft size={20} className="text-slate-400" />
                Recent Journal Entries
              </h2>
              <button className="text-sm font-bold text-primary-600 hover:underline">View Journal</button>
            </div>
            <div className="flex flex-col items-center justify-center h-[300px] text-slate-400">
               <div className="bg-slate-50 p-4 rounded-full mb-4">
                 <FileText size={48} className="opacity-20" />
               </div>
               <p className="text-sm font-medium">Detailed activity feed coming soon.</p>
            </div>
          </div>

          {/* Quick Reports / Shortcut Card */}
          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-200 flex flex-col justify-between">
            <div>
              <div className="bg-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                 <Wallet size={24} className="text-primary-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Financial Reports</h2>
              <p className="text-slate-400 text-sm mb-8">Access Profit & Loss, Balance Sheets, and Trial Balances with one click.</p>
              
              <ul className="space-y-4">
                {['Trial Balance', 'Profit & Loss', 'Ledger Analytics'].map(report => (
                  <li key={report} className="flex items-center justify-between group cursor-pointer hover:text-primary-400 transition-colors">
                    <span className="font-semibold text-slate-200 group-hover:text-white">{report}</span>
                    <TrendingUp size={16} className="text-slate-600 group-hover:text-primary-400" />
                  </li>
                ))}
              </ul>
            </div>
            
            <button className="w-full bg-primary-600 hover:bg-primary-700 py-4 rounded-2xl font-bold mt-10 transition-colors shadow-lg shadow-primary-900/20">
              Generate Report Package
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default AccountingDashboard;
