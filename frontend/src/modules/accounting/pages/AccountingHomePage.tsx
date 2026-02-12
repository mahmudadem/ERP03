import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { PendingApprovalsWidget } from '../components/PendingApprovalsWidget';
import { Plus, FileText, BarChart2, Settings, ArrowRight, PieChart, Scale } from 'lucide-react';

const AccountingHomePage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const navigate = useNavigate();

  return (
    <div className="p-8 space-y-8 bg-[var(--color-bg-secondary)] min-h-screen">
       {/* Welcome Header */}
       <div className="flex justify-between items-center">
         <div>
           <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">{t('home.title')}</h1>
           <p className="text-[var(--color-text-muted)] mt-1">{t('home.subtitle')}</p>
         </div>
         <Button 
           variant="primary" 
           size="lg" 
           className="shadow-lg shadow-primary-500/20 gap-2"
           onClick={() => navigate('/accounting/vouchers/new')}
         >
           <Plus size={20} />
           {t('home.newVoucher')}
         </Button>
       </div>

       {/* Critical Actions Row */}
       <div className="max-w-4xl">
         <PendingApprovalsWidget />
       </div>

       {/* Module Hub Grid */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         
         {/* Vouchers / Transactions */}
         <Card 
           className="p-6 group hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer border-t-4 border-t-blue-500" 
           onClick={() => navigate('/accounting/vouchers')}
         >
            <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <FileText size={20} />
            </div>
            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{t('home.journalTag')}</h3>
            <p className="text-xl font-black text-gray-900">{t('home.journalTitle')}</p>
            <div className="flex items-center gap-1 text-sm text-blue-600 font-bold mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
               {t('home.goToList')} <ArrowRight size={14} />
            </div>
         </Card>

         {/* Chart of Accounts */}
         <Card 
           className="p-6 group hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer border-t-4 border-t-indigo-500" 
           onClick={() => navigate('/accounting/accounts')}
         >
            <div className="bg-indigo-50 text-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <Settings size={20} />
            </div>
            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{t('home.structureTag')}</h3>
            <p className="text-xl font-black text-gray-900">{t('home.chartOfAccounts')}</p>
            <div className="flex items-center gap-1 text-sm text-indigo-600 font-bold mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
               {t('home.manageStructure')} <ArrowRight size={14} />
            </div>
         </Card>

         {/* Reports */}
         <Card 
           className="p-6 group hover:shadow-xl hover:border-purple-200 transition-all cursor-pointer border-t-4 border-t-purple-500" 
           onClick={() => navigate('/accounting/reports/trial-balance')}
         >
            <div className="bg-purple-50 text-purple-600 w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
               <BarChart2 size={20} />
            </div>
            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{t('home.analysisTag')}</h3>
            <p className="text-xl font-black text-gray-900">{t('home.trialBalance')}</p>
            <div className="flex items-center gap-1 text-sm text-purple-600 font-bold mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
               {t('home.viewAnalytics')} <ArrowRight size={14} />
            </div>
         </Card>

         {/* More coming soon... */}
         <div className="p-6 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-center opacity-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('home.moreModules')}</p>
            <p className="text-sm font-medium text-gray-400 mt-1">{t('home.comingSoon')}</p>
         </div>

       </div>

       {/* Financial Reports */}
       <div className="space-y-3">
         <div className="flex items-center justify-between">
           <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('home.financialReports')}</h2>
           <p className="text-sm text-[var(--color-text-muted)]">{t('home.financialReportsDesc')}</p>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <Card
             className="p-5 border border-gray-200 hover:border-emerald-200 hover:shadow-lg transition-all cursor-pointer"
             onClick={() => navigate('/accounting/reports/balance-sheet')}
           >
             <div className="flex items-center gap-3 mb-3">
               <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                 <Scale size={20} />
               </div>
               <div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{t('home.positionTag')}</p>
                 <p className="text-lg font-bold text-[var(--color-text-primary)]">{t('home.balanceSheet')}</p>
               </div>
             </div>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
               {t('home.balanceSheetDesc')}
             </p>
           </Card>

           <Card
             className="p-5 border border-gray-200 hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer"
             onClick={() => navigate('/accounting/reports/trial-balance')}
           >
             <div className="flex items-center gap-3 mb-3">
               <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                 <BarChart2 size={20} />
               </div>
               <div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">{t('home.controlTag')}</p>
                 <p className="text-lg font-bold text-[var(--color-text-primary)]">{t('home.trialBalance')}</p>
               </div>
             </div>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
               {t('home.trialBalanceDesc')}
             </p>
           </Card>

           <Card
             className="p-5 border border-gray-200 hover:border-amber-200 hover:shadow-lg transition-all cursor-pointer"
             onClick={() => navigate('/accounting/reports/profit-loss')}
           >
             <div className="flex items-center gap-3 mb-3">
               <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                 <PieChart size={20} />
               </div>
               <div>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">{t('home.performanceTag')}</p>
                 <p className="text-lg font-bold text-[var(--color-text-primary)]">{t('home.profitLoss')}</p>
               </div>
             </div>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
               {t('home.profitLossDesc')}
             </p>
           </Card>
         </div>
       </div>
    </div>
  );
};

export default AccountingHomePage;
