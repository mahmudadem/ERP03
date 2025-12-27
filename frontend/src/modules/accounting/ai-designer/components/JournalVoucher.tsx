import React, { useState, useRef } from 'react';
import { JournalRow, Currency } from '../types';
import { Button } from './ui/Button';
import { 
  Plus, Trash2, X, Eye, Calculator, 
  ChevronDown, Calendar, Wand2,
  Copy, Image as ImageIcon, Loader2, Download
} from 'lucide-react';
import { generateJournalSuggestion, analyzeImageForJournal } from '../services/geminiService';
import { useLanguage } from '../LanguageContext';
import { errorHandler } from '../../../../services/errorHandler';
import { useCompanySettings } from '../../../../hooks/useCompanySettings';
import { formatCompanyDate, formatCompanyTime, getCompanyToday } from '../../../../utils/dateUtils';
import { DatePicker } from '../../components/shared/DatePicker';

// Preserving logic: keeping enough initial rows to fill the view, but not too many to force scroll immediately
const INITIAL_ROWS: JournalRow[] = Array.from({ length: 8 }).map((_, i) => ({
  id: i + 1,
  account: '',
  notes: '',
  debit: 0,
  credit: 0,
  currency: 'USD',
  parity: 1.0,
  equivalent: 0,
  category: ''
}));

interface JournalVoucherProps {
  title?: string;
}

export const JournalVoucher: React.FC<JournalVoucherProps> = React.memo(({ title }) => {
  const [rows, setRows] = useState<JournalRow[]>(INITIAL_ROWS);
  const [loadingAI, setLoadingAI] = useState(false);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, isRTL } = useLanguage();
  const { settings } = useCompanySettings();
  
  const displayTitle = t(title || 'journalVoucher');
  const currentTime = `${formatCompanyDate(new Date(), settings)} ${formatCompanyTime(new Date(), settings)}`;

  // Calculate totals
  const totalDebit = rows.reduce((sum, row) => sum + (row.debit || 0), 0);
  const totalCredit = rows.reduce((sum, row) => sum + (row.credit || 0), 0);

  const handleInputChange = (id: number, field: keyof JournalRow, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        id: prev.length + 1,
        account: '',
        notes: '',
        debit: 0,
        credit: 0,
        currency: 'USD',
        parity: 1.0,
        equivalent: 0,
        category: ''
      }
    ]);
  };

  const applyAIData = (data: any[]) => {
    if (Array.isArray(data)) {
      const newRows = [...rows];
      // Expand rows if AI returns more data than current rows
      while (newRows.length < data.length) {
         newRows.push({
            id: newRows.length + 1,
            account: '', notes: '', debit: 0, credit: 0, currency: 'USD', parity: 1, equivalent: 0, category: ''
         });
      }

      data.forEach((item, index) => {
        if (newRows[index]) {
          newRows[index].account = item.account || newRows[index].account;
          newRows[index].notes = item.notes || newRows[index].notes;
          newRows[index].debit = item.debit || 0;
          newRows[index].credit = item.credit || 0;
          newRows[index].category = item.category || '';
        }
      });
      setRows(newRows);
    }
  };

  const handleAIAutoFill = async () => {
    const promptText = description || "Purchase of office supplies";
    
    setLoadingAI(true);
    try {
      const suggestion = await generateJournalSuggestion(promptText);
      const cleanJson = suggestion.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      applyAIData(parsed);
    } catch (e: any) {
      errorHandler.showError(e);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleImageImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingAI(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const result = await analyzeImageForJournal(base64);
        const cleanJson = result.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        applyAIData(parsed);
      } catch (err: any) {
        errorHandler.showError(err);
      } finally {
        setLoadingAI(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = () => {
    const header = "Account,Debit,Credit,Notes\n";
    const body = rows
      .filter(r => r.account || r.debit || r.credit) 
      .map(r => `"${r.account}",${r.debit},${r.credit},"${r.notes}"`)
      .join("\n");
    
    navigator.clipboard.writeText(header + body)
      .then(() => errorHandler.showSuccess("Table data copied to clipboard as CSV!"))
      .catch(err => errorHandler.showError(err));
  };

  return (
    <div className="flex flex-col h-full bg-white select-none text-slate-800 font-sans">
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleImageImport}
        className="hidden"
        accept="image/*"
      />

      {/* Header Bar - Fully Compacted Single Line */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/30">
        <div className="flex items-center gap-3">
           <h1 className="text-base font-bold text-slate-700 leading-none">
             {displayTitle}
           </h1>
           {loadingAI && (
            <span className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded animate-pulse border border-blue-100">
              <Loader2 size={10} className="animate-spin" />
              AI Processing...
            </span>
           )}
           {!loadingAI && (
             <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase rounded border border-gray-200 tracking-wide">
               {t('pending')}
             </span>
           )}
           <span className="text-[10px] text-gray-400 font-medium border-l border-gray-300 pl-3 ml-1 hidden md:inline-block">
             {t('created')}: {currentTime}
           </span>
        </div>
        
        <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-gray-100 shadow-sm">
             <button onClick={() => fileInputRef.current?.click()} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title={t('importImage')}>
               <ImageIcon size={14} />
             </button>
             <div className="w-px h-3 bg-gray-200"></div>
             <button onClick={copyToClipboard} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title={t('exportCSV')}>
               <Download size={14} />
             </button>
        </div>
      </div>

      {/* Form Grid - Compacted to 4 columns */}
      <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-4 gap-4 bg-white">
        
        {/* Row 1: All 4 main inputs in one line */}
        <div className="space-y-0.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('exchangeRate')}</label>
          <input type="number" defaultValue="1" className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm" />
        </div>
        
        <div className="space-y-0.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('transactionCurrency')}</label>
          <div className="relative">
            <select className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm appearance-none pr-6">
                <option>US Dollar (USD)</option>
                <option>Turkish Lira (TRY)</option>
            </select>
            <ChevronDown className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} text-gray-400 pointer-events-none`} size={14} />
          </div>
          <p className="text-[9px] text-gray-400 text-end leading-none mt-0.5">USD = 1 USD</p>
        </div>

        <div className="space-y-0.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('referenceDocument')}</label>
          <div className="relative">
            <DatePicker 
              value={getCompanyToday(settings)}
              onChange={(val: string) => {
                // In this component, the date value isn't strictly tracked in state for the header yet
                // but we can add logic if needed. For now, we satisfy the UI requirement.
              }}
            />
          </div>
        </div>
        
        <div className="space-y-0.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('documentNumber')}</label>
          <input type="text" readOnly value={`...${t('pending')}`} className="w-full p-1.5 border border-gray-200 rounded bg-gray-50 text-gray-500 text-xs shadow-sm" />
        </div>

        {/* Row 2: Description (3 cols) + Payment Method (1 col) */}
        <div className="md:col-span-3 space-y-0.5">
           <div className="flex justify-between items-center">
             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('description')}</label>
             <button 
                  onClick={handleAIAutoFill}
                  disabled={loadingAI}
                  className="flex items-center gap-1 text-[9px] text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
             >
                <Wand2 size={10} /> Auto-Fill
             </button>
           </div>
           <input 
             type="text"
             value={description}
             onChange={(e) => setDescription(e.target.value)}
             className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
             placeholder="Enter transaction details..."
           />
        </div>

        <div className="space-y-0.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('paymentMethod')}</label>
          <div className="relative">
            <select className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm appearance-none pr-6">
                <option>N/A</option>
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>Check</option>
            </select>
             <ChevronDown className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} text-gray-400 pointer-events-none`} size={14} />
          </div>
        </div>

      </div>

      <div className="flex-1 px-4 py-2 overflow-auto">
        <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                        <th className="p-2 text-start w-10 text-xs">#</th>
                        <th className="p-2 text-start text-xs">{t('account')}</th>
                        <th className="p-2 text-start w-28 text-xs">{t('debit')}</th>
                        <th className="p-2 text-start w-28 text-xs">{t('credit')}</th>
                        {/* Notes moved to end, Currency/Category hidden as per Legacy Design */}
                        <th className="p-2 text-start text-xs">{t('notes')}</th>
                        <th className="p-2 w-8"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rows.map((row, index) => (
                        <tr key={row.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="p-1.5 text-center text-gray-400 text-[10px]">{index + 1}</td>
                            <td className="p-1.5">
                                <input 
                                    value={row.account}
                                    onChange={(e) => handleInputChange(row.id, 'account', e.target.value)}
                                    className="w-full p-1 border border-gray-200 rounded bg-white text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                    placeholder={t('account')}
                                />
                            </td>
                             <td className="p-1.5">
                                <input 
                                    type="number"
                                    value={row.debit || ''}
                                    onChange={(e) => handleInputChange(row.id, 'debit', parseFloat(e.target.value))}
                                    placeholder="---"
                                    className="w-full p-1 border border-gray-200 rounded bg-white text-xs text-end focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </td>
                             <td className="p-1.5">
                                <input 
                                    type="number"
                                    value={row.credit || ''}
                                    onChange={(e) => handleInputChange(row.id, 'credit', parseFloat(e.target.value))}
                                    placeholder="---"
                                    className="w-full p-1 border border-gray-200 rounded bg-white text-xs text-end focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </td>
                             <td className="p-1.5">
                                <input 
                                    value={row.notes}
                                    onChange={(e) => handleInputChange(row.id, 'notes', e.target.value)}
                                    className="w-full p-1 border border-gray-200 rounded bg-white text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </td>
                            <td className="p-1.5 text-center">
                                <button className="text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={12} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button 
                onClick={addRow}
                className="w-full py-1.5 text-center text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors border-t border-indigo-100"
            >
                + {t('addLine')}
            </button>
        </div>
      </div>

      {/* Footer Section - Compacted */}
      <div className="bg-white border-t border-gray-200 p-2">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            
            {/* Totals - Compacted */}
            <div className={`flex gap-6 items-center ${isRTL ? 'md:order-last' : ''}`}>
                 <div className="flex items-baseline gap-2">
                     <span className="text-[10px] font-bold text-gray-500 uppercase">{t('totalDebit')}</span>
                     <span className="text-base font-bold text-slate-800">{totalDebit.toFixed(2)}</span>
                 </div>
                 <div className="h-4 w-px bg-gray-300"></div>
                 <div className="flex items-baseline gap-2">
                     <span className="text-[10px] font-bold text-gray-500 uppercase">{t('totalCredit')}</span>
                     <span className="text-base font-bold text-slate-800">{totalCredit.toFixed(2)}</span>
                 </div>
            </div>

            {/* Action Buttons - Compacted */}
            <div className="flex items-center gap-2 w-full md:w-auto">
                 <button className="px-3 py-1 rounded bg-white border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors shadow-sm">
                    {t('cancel')}
                 </button>
                 <button className="px-3 py-1 rounded bg-white border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors shadow-sm">
                    {t('saveAsDraft')}
                 </button>
                 <button className="px-4 py-1 rounded bg-indigo-600 border border-indigo-700 text-white text-xs font-medium hover:bg-indigo-700 transition-colors shadow-sm flex-1 md:flex-none whitespace-nowrap">
                    {t('submitForApproval')}
                 </button>
            </div>
         </div>
      </div>
    </div>
  );
});
