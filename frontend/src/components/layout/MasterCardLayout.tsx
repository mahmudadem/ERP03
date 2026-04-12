
import React from 'react';
import { clsx } from 'clsx';
import { 
  X, 
  Save, 
  History, 
  LucideIcon 
} from 'lucide-react';

export interface MasterCardTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface MasterCardLayoutProps {
  title: string;
  subtitle?: string;
  identifier?: string; // e.g. "SKU: 1001" or "ID: CUST-01"
  icon: LucideIcon;
  tabs: MasterCardTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  isWindow?: boolean;
  isNew?: boolean;
  saving?: boolean;
  canEdit?: boolean;
  onSave: () => void;
  onClose?: () => void;
  updatedAt?: string;
  error?: string | null;
  children: React.ReactNode;
}

export const MasterCardLayout: React.FC<MasterCardLayoutProps> = ({
  title,
  subtitle,
  identifier,
  icon: Icon,
  tabs,
  activeTab,
  onTabChange,
  isWindow = false,
  isNew = false,
  saving = false,
  canEdit = true,
  onSave,
  onClose,
  updatedAt,
  error,
  children
}) => {
  return (
    <div className={clsx(
        "flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden",
        isWindow ? "h-full w-full" : "h-full w-full relative"
    )}>
      {/* 1. HEADER (Only for Web Page Mode) */}
      {!isWindow && (
        <div className="flex-none flex items-center justify-between border-b bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm z-20">
          <div className="flex items-center gap-4">
             <div className="rounded-lg bg-indigo-600 p-2.5 text-white shadow-lg shadow-indigo-100 dark:shadow-none">
                <Icon size={24} />
             </div>
             <div>
                <div className="flex items-center gap-2 mb-0.5">
                   <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                     {isNew ? `New ${title}` : title}
                   </h1>
                   {identifier && (
                     <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-500 rounded border dark:border-slate-700 uppercase tracking-tighter">
                        {identifier}
                     </span>
                   )}
                </div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.1em]">
                  {subtitle || (isNew ? 'Drafting New Record' : 'Master Record Details')}
                </p>
             </div>
          </div>
          {onClose && (
            <button 
                onClick={onClose} 
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors uppercase tracking-widest border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              CLOSE
            </button>
          )}
        </div>
      )}

      {/* 2. MAIN BODY (Sidebar + Content) */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden relative">
        {/* Sidebar Navigation / Mobile Tab Bar */}
        <div className={clsx(
            "flex-none bg-white dark:bg-slate-900/50 border-r md:border-r border-b md:border-b-0 dark:border-slate-800 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto z-10 custom-scroll shadow-sm md:shadow-none",
            isWindow ? "md:w-56" : "md:w-60"
        )}>
          <nav className="flex flex-row md:flex-col p-1.5 md:p-2 space-x-1 md:space-x-0 md:space-y-0.5 min-w-full md:min-w-0">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={clsx(
                    "flex-none md:w-full flex items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 text-[10px] md:text-[11px] font-bold transition-all rounded-lg whitespace-nowrap",
                    activeTab === tab.id 
                        ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none" 
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
            >
                <span className={clsx("transition-all", activeTab === tab.id ? "text-white" : "text-slate-400")}>
                    <tab.icon size={16} />
                </span>
                <span className="md:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Form Content Wrapper */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900/20 relative overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scroll">
            <div className="mx-auto max-w-4xl pb-24">
              {error && (
                <div className="mb-6 rounded-xl bg-red-50 dark:bg-red-950/20 p-4 border border-red-100 dark:border-red-900/40 text-red-700 dark:text-red-400 flex items-center gap-3 text-xs shadow-sm animate-in fade-in slide-in-from-top-2">
                  <X size={18} className="text-red-400" />
                  <span className="font-medium">{error}</span>
                </div>
              )}
              {children}
            </div>
          </main>

          {/* 3. STICKY FOOTER (Always Visible) */}
          <div className="flex-none border-t bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 md:px-8 py-3 dark:border-slate-800 z-30 flex flex-row justify-between items-center shadow-[0_-4px_12_rgba(0,0,0,0.05)]">
             <div className="hidden sm:flex items-center gap-3 text-[10px] text-slate-400 font-mono font-medium uppercase tracking-tighter">
                <History size={12} /> {isNew ? 'Master Entry' : `Sync: ${updatedAt ? new Date(updatedAt).toLocaleDateString() : 'Active'}`}
             </div>
             <div className="flex items-center gap-2 w-full sm:w-auto">
                {onClose && (
                    <button 
                        onClick={onClose} 
                        className="flex-1 sm:flex-none px-4 py-2 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 uppercase tracking-tight transition-colors"
                    >
                        BACK
                    </button>
                )}
                <button 
                    disabled={saving || !canEdit}
                    onClick={onSave}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg text-[11px] font-bold shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition-all uppercase tracking-normal"
                >
                    {saving ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-b-white" /> : <Save size={14} />}
                    {isNew ? 'SAVE NEW RECORD' : 'UPDATE MASTER RECORD'}
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Reusable Form Sub-Components ---

export const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-3">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b dark:border-slate-800 pb-1.5">{title}</h3>
        <div className="px-1">{children}</div>
    </div>
);

export const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
    <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {children}
    </div>
);
