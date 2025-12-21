import React, { useState } from 'react';
import { 
  ChevronDown, ChevronRight, ChevronLeft, LayoutDashboard, FileSpreadsheet, 
  Users, Settings, DollarSign, Globe, ScrollText, X, Paintbrush
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useVouchers } from '../VoucherContext';

interface SidebarProps {
  onOpenVoucher: (type: string) => void;
  isMobile?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenVoucher, isMobile, onClose }) => {
  const [vouchersOpen, setVouchersOpen] = useState(true);
  const { isRTL, language, toggleLanguage, t } = useLanguage();
  const { vouchers } = useVouchers();

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full shadow-xl">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold text-lg">
            {language === 'ar' ? 'س' : 'C'}
            </div>
            <h1 className="font-bold text-white text-lg tracking-tight">{t('appName')}</h1>
        </div>
        
        {isMobile && (
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        
        <div className="px-3">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors text-sm font-medium">
            <LayoutDashboard size={18} />
            {t('dashboard')}
          </button>
        </div>

        {/* Voucher Section */}
        <div className="px-3 pt-2">
          <button 
            onClick={() => setVouchersOpen(!vouchersOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-slate-800 transition-colors text-sm font-medium text-white group"
          >
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={18} className="text-blue-400" />
              {t('vouchers')}
            </div>
            {vouchersOpen 
              ? <ChevronDown size={14} /> 
              : (isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />)
            }
          </button>
          
          {vouchersOpen && (
            <div className={`mt-1 border-slate-700 space-y-1 ${isRTL ? 'mr-4 border-r' : 'ml-4 border-l'}`}>
               <button 
                 onClick={() => onOpenVoucher("Legacy Journal Voucher")}
                 className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors ${isRTL ? 'rounded-l-md' : 'rounded-r-md'}`}
               >
                 <ScrollText size={14} className="text-indigo-400" />
                 {t('legacyJournalVoucher')}
               </button>
               
               {/* Render Dynamic Vouchers from Context */}
               {vouchers.map(voucher => (
                   <button 
                     key={voucher.id}
                     onClick={() => onOpenVoucher(voucher.id)}
                     className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors ${isRTL ? 'rounded-l-md' : 'rounded-r-md'}`}
                   >
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                     <span className="truncate">{voucher.name}</span>
                   </button>
               ))}
            </div>
          )}
        </div>

        <div className="px-3">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors text-sm font-medium">
            <Users size={18} />
            {t('accounts')}
          </button>
        </div>
        
         <div className="px-3">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors text-sm font-medium">
            <DollarSign size={18} />
            {t('finance')}
          </button>
        </div>

        <div className="px-3 border-t border-slate-800 mt-2 pt-2">
          <button 
            onClick={() => onOpenVoucher("Voucher Designer")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors text-sm font-medium text-indigo-400"
          >
            <Paintbrush size={18} />
            Voucher Designer
          </button>
        </div>

      </div>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button 
          onClick={toggleLanguage}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-slate-800 transition-colors text-sm font-medium text-slate-400 hover:text-white bg-slate-800/30"
        >
          <div className="flex items-center gap-3">
             <Globe size={18} />
             {language === 'en' ? 'English' : 'العربية'}
          </div>
          <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded uppercase">{language}</span>
        </button>

        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-800 transition-colors text-sm font-medium text-slate-400 hover:text-white">
          <Settings size={18} />
          {t('settings')}
        </button>
      </div>
    </div>
  );
};