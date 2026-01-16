import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { PendingApprovalsWidget } from '../components/PendingApprovalsWidget';
import { Plus, FileText, BarChart2, Settings, ArrowRight } from 'lucide-react';

const AccountingHomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-8 space-y-8 bg-[var(--color-bg-secondary)] min-h-screen">
       {/* Welcome Header */}
       <div className="flex justify-between items-center">
         <div>
           <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)] tracking-tight">Accounting Overview</h1>
           <p className="text-[var(--color-text-muted)] mt-1">Manage transactions, monitor approvals, and generate reports.</p>
         </div>
         <Button 
           variant="primary" 
           size="lg" 
           className="shadow-lg shadow-primary-500/20 gap-2"
           onClick={() => navigate('/accounting/vouchers/new')}
         >
           <Plus size={20} />
           New Voucher
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
            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Journal</h3>
            <p className="text-xl font-black text-gray-900">Voucher List</p>
            <div className="flex items-center gap-1 text-sm text-blue-600 font-bold mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
               Go to list <ArrowRight size={14} />
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
            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Structure</h3>
            <p className="text-xl font-black text-gray-900">Chart of Accounts</p>
            <div className="flex items-center gap-1 text-sm text-indigo-600 font-bold mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
               Manage structure <ArrowRight size={14} />
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
            <h3 className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Analysis</h3>
            <p className="text-xl font-black text-gray-900">Trial Balance</p>
            <div className="flex items-center gap-1 text-sm text-purple-600 font-bold mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
               View analytics <ArrowRight size={14} />
            </div>
         </Card>

         {/* More coming soon... */}
         <div className="p-6 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-center opacity-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">More modules</p>
            <p className="text-sm font-medium text-gray-400 mt-1">Coming Soon</p>
         </div>

       </div>
    </div>
  );
};

export default AccountingHomePage;
