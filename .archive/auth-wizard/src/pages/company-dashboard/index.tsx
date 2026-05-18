import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Package, 
  ShoppingCart, 
  FileText, 
  Bell, 
  Menu,
  Plus
} from 'lucide-react';
import { cn } from '../../../utils';

interface CompanyDashboardProps {
  companyId: string;
  companyName: string;
  onBack: () => void;
}

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ companyId, companyName, onBack }) => {
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
           <span className="font-bold text-white text-lg tracking-tight">ERP03</span>
        </div>
        
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-white font-bold">
               {companyName.charAt(0)}
             </div>
             <div className="overflow-hidden">
               <h3 className="text-sm font-medium text-white truncate">{companyName}</h3>
               <p className="text-xs text-slate-500">Business Plan</p>
             </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
           <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white bg-slate-800 rounded-md">
             <LayoutDashboard className="h-5 w-5" />
             Dashboard
           </a>
           <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
             <Package className="h-5 w-5" />
             Inventory
           </a>
           <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
             <ShoppingCart className="h-5 w-5" />
             Sales
           </a>
           <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
             <FileText className="h-5 w-5" />
             Invoices
           </a>
           <a href="#" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
             <Users className="h-5 w-5" />
             HR & Staff
           </a>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
             onClick={onBack}
             className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md w-full transition-colors"
          >
             <Settings className="h-5 w-5" />
             All Companies
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
         <header className="h-16 bg-white border-b px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <button className="lg:hidden text-slate-500">
                  <Menu className="h-6 w-6" />
               </button>
               <h1 className="text-xl font-semibold text-slate-800">Overview</h1>
            </div>
            <div className="flex items-center gap-4">
               <button className="p-2 text-slate-400 hover:text-slate-600 relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500"></span>
               </button>
               <div className="h-8 w-8 rounded-full bg-slate-200"></div>
            </div>
         </header>

         <main className="flex-1 p-6 overflow-y-auto">
            {/* Empty Dashboard State for New Companies */}
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center max-w-2xl mx-auto mt-10">
               <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <LayoutDashboard className="h-8 w-8 text-primary" />
               </div>
               <h2 className="text-xl font-bold text-slate-900 mb-2">Welcome to {companyName}</h2>
               <p className="text-slate-500 mb-8">
                  Your company workspace is ready. You have installed the selected bundles, 
                  but you need to activate specific modules to start using them.
               </p>
               
               <div className="grid gap-4 md:grid-cols-2 text-left max-w-lg mx-auto mb-8">
                  <div className="p-4 rounded-lg border bg-slate-50 hover:border-primary/50 transition-colors cursor-pointer">
                     <h3 className="font-semibold text-slate-900">Configure Accounting</h3>
                     <p className="text-xs text-slate-500 mt-1">Set up chart of accounts and currencies.</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-slate-50 hover:border-primary/50 transition-colors cursor-pointer">
                     <h3 className="font-semibold text-slate-900">Import Data</h3>
                     <p className="text-xs text-slate-500 mt-1">Customers, vendors, and opening balances.</p>
                  </div>
               </div>

               <button className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-white shadow hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" />
                  Activate Modules
               </button>
            </div>
         </main>
      </div>
    </div>
  );
};

export default CompanyDashboard;