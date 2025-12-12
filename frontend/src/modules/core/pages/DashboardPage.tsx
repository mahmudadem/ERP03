import React from 'react';
import { Card } from '../../../components/ui/Card';
import { ModuleSetupCard } from '../../../components/dashboard/ModuleSetupCard';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Briefcase, 
  FileText, 
  ShoppingCart, 
  Plus, 
  ArrowRight,
  Activity,
  CreditCard,
  Package,
  Settings
} from 'lucide-react';

const DashboardPage: React.FC = () => {
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-2">
      {/* Module Setup Card - Only shows if modules need configuration */}
      <ModuleSetupCard />
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-100 pb-6">
        <div>
           <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-1">
             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
             {currentDate}
           </div>
           <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Overview</h1>
        </div>
        <div className="flex gap-3">
           <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
              <Settings className="w-4 h-4" />
              Customize
           </button>
           <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 hover:shadow-md transition-all shadow-sm">
              <Plus className="w-4 h-4" />
              New Transaction
           </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <StatsCard 
            label="Total Revenue" 
            value="$124,500" 
            metric="+12.5%" 
            trend="up" 
            icon={<DollarSign className="w-5 h-5 text-emerald-600" />} 
            color="emerald"
         />
         <StatsCard 
            label="Expenses" 
            value="$82,100" 
            metric="-2.4%" 
            trend="down" 
            icon={<CreditCard className="w-5 h-5 text-rose-600" />}
            color="rose"
         />
         <StatsCard 
            label="Net Profit" 
            value="$42,400" 
            metric="+8.1%" 
            trend="up" 
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            color="blue"
         />
         <StatsCard 
            label="Active Projects" 
            value="12" 
            metric="On Track" 
            trend="neutral" 
            icon={<Briefcase className="w-5 h-5 text-indigo-600" />}
            color="indigo"
         />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Actions & Feed (2/3) */}
        <div className="lg:col-span-2 space-y-8">
           
           {/* Quick Actions */}
           <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                 <Activity className="w-5 h-5 text-gray-400" /> Quick Actions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <ActionBtn label="New Invoice" icon={<FileText className="w-5 h-5" />} color="text-violet-600 bg-violet-50 hover:bg-violet-100" />
                 <ActionBtn label="Add Vendor" icon={<Users className="w-5 h-5" />} color="text-pink-600 bg-pink-50 hover:bg-pink-100" />
                 <ActionBtn label="Record Expense" icon={<DollarSign className="w-5 h-5" />} color="text-amber-600 bg-amber-50 hover:bg-amber-100" />
                 <ActionBtn label="Add Product" icon={<Package className="w-5 h-5" />} color="text-cyan-600 bg-cyan-50 hover:bg-cyan-100" />
              </div>
           </section>

           {/* Recent Transactions */}
           <Card className="p-0 overflow-hidden border border-gray-200 shadow-sm">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
                 <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    View All <ArrowRight className="w-4 h-4" />
                 </button>
              </div>
              <div className="divide-y divide-gray-100">
                 <TransactionRow title="Payment from Acme Corp" subtitle="Invoice #INV-2023-001" amount="+$1,200.00" date="Today, 10:23 AM" type="income" />
                 <TransactionRow title="Office Supplies" subtitle="Staples Inc." amount="-$350.00" date="Yesterday" type="expense" />
                 <TransactionRow title="Subscription Renewal" subtitle="Adobe Creative Cloud" amount="-$54.99" date="Oct 24, 2023" type="expense" />
                 <TransactionRow title="Consulting Fees" subtitle="Tech Solutions Ltd" amount="+$2,500.00" date="Oct 22, 2023" type="income" />
                 <TransactionRow title="Server Costs" subtitle="AWS Web Services" amount="-$120.50" date="Oct 21, 2023" type="expense" />
              </div>
           </Card>
        </div>

        {/* Right Column: Widgets (1/3) */}
        <div className="space-y-8">
           
           {/* System Health Widget */}
           <Card className="p-6 border border-gray-200 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-5">System Usage</h3>
              <div className="space-y-6">
                 <ProgressBar label="Storage" value={75} total="200GB" color="bg-blue-600" />
                 <ProgressBar label="API Calls" value={42} total="10k/mo" color="bg-emerald-500" />
                 <ProgressBar label="Users" value={12} total="20 Seats" color="bg-violet-500" />
              </div>
           </Card>

           {/* Promo / Upgrade Card */}
           <div className="relative overflow-hidden rounded-xl bg-slate-900 p-6 text-white shadow-lg">
              <div className="relative z-10">
                 <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-4 backdrop-blur-sm">
                    <TrendingUp className="w-6 h-6 text-yellow-400" />
                 </div>
                 <h3 className="text-lg font-bold mb-2">Upgrade to Pro</h3>
                 <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                    Unlock advanced analytics, custom reports, and unlimited user seats.
                 </p>
                 <button className="w-full py-2.5 bg-white text-slate-900 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors shadow-md active:transform active:scale-95">
                    View Plans
                 </button>
              </div>
              {/* Decorative Circle */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl"></div>
           </div>

        </div>
      </div>
    </div>
  );
};

// --- Sub Components ---

const StatsCard = ({ label, value, metric, trend, icon, color }: any) => (
   <Card className="p-5 border border-gray-100 bg-white hover:border-gray-200 hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
         <div className={`p-2 rounded-lg bg-${color}-50`}>
            {icon}
         </div>
         {trend !== 'neutral' && (
            <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-full ${
               trend === 'up' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
               {metric}
               {trend === 'up' ? <TrendingUp className="w-3 h-3 ml-1" /> : <TrendingDown className="w-3 h-3 ml-1" />}
            </span>
         )}
      </div>
      <div>
         <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{value}</h3>
         <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>
   </Card>
);

const ActionBtn = ({ label, icon, color }: any) => (
   <button className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-md transition-all group">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${color}`}>
         {icon}
      </div>
      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
   </button>
);

const TransactionRow = ({ title, subtitle, amount, date, type }: any) => (
   <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
      <div className="flex items-center gap-4">
         <div className={`w-10 h-10 rounded-full flex items-center justify-center ${type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {type === 'income' ? <TrendingUp className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
         </div>
         <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">{subtitle}</p>
         </div>
      </div>
      <div className="text-right">
         <p className={`text-sm font-bold ${type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>{amount}</p>
         <p className="text-xs text-gray-400">{date}</p>
      </div>
   </div>
);

const ProgressBar = ({ label, value, total, color }: any) => (
   <div>
      <div className="flex justify-between text-xs font-medium mb-1.5">
         <span className="text-gray-600">{label}</span>
         <span className="text-gray-900">{value}% <span className="text-gray-400 font-normal">({total})</span></span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
         <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${value}%` }}></div>
      </div>
   </div>
);

export default DashboardPage;
