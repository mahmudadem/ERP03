import React, { useState } from 'react';
import { VoucherTypeConfig, SectionLayout, FieldLayout, JournalRow, UIMode } from '../types';
import { Plus, Trash2, Calendar, ChevronDown, Download, Image as ImageIcon, Loader2, Printer, Mail, Save } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface GenericVoucherRendererProps {
  config: VoucherTypeConfig;
  mode?: UIMode; // Allow passing 'classic' or 'windows'
}

const INITIAL_ROWS: JournalRow[] = Array.from({ length: 5 }).map((_, i) => ({
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

export const GenericVoucherRenderer: React.FC<GenericVoucherRendererProps> = React.memo(({ config, mode = 'windows' }) => {
  const { t, isRTL } = useLanguage();
  const [rows, setRows] = useState<JournalRow[]>(INITIAL_ROWS);
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  // Dynamically select the layout based on the mode prop
  const layoutMode = mode; 
  const sectionsData = config.uiModeOverrides[layoutMode]?.sections || {};

  // Sort sections by order
  const sortedSections = Object.entries(sectionsData)
    .sort(([, a], [, b]) => (a as SectionLayout).order - (b as SectionLayout).order);

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleRowChange = (id: number, field: keyof JournalRow, value: any) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const addRow = () => {
    setRows(prev => [...prev, {
      id: prev.length + 1,
      account: '', notes: '', debit: 0, credit: 0, currency: 'USD', parity: 1, equivalent: 0, category: ''
    }]);
  };

  // --- Field Renderers ---

  const renderField = (fieldLayout: FieldLayout) => {
    const { fieldId, labelOverride } = fieldLayout;
    
    // 1. System Fields (Read Only)
    if (['voucherNo', 'status', 'createdBy', 'createdAt'].includes(fieldId)) {
       return (
         <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{labelOverride || t(fieldId) || fieldId}</label>
            <input 
              type="text" 
              readOnly 
              value={fieldId === 'voucherNo' ? `${config.prefix}...` : fieldId === 'status' ? 'Draft' : 'System'}
              className="w-full p-1.5 border border-gray-200 rounded bg-gray-50 text-gray-500 text-xs shadow-sm" 
            />
         </div>
       );
    }

    // 2. Line Items Table
    if (fieldId === 'lineItems') {
        // Default columns if not configured
        const columns = config.tableColumns && config.tableColumns.length > 0 
            ? config.tableColumns 
            : ['account', 'debit', 'credit', 'notes'];

        return (
            <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-sm min-h-[200px] bg-white">
                <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="p-2 text-start w-10 text-xs">#</th>
                            {columns.map(col => (
                                <th key={col} className="p-2 text-start text-xs capitalize">{t(col)}</th>
                            ))}
                            <th className="p-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rows.map((row, index) => (
                            <tr key={row.id} className="group hover:bg-slate-50 transition-colors">
                                <td className="p-1.5 text-center text-gray-400 text-[10px]">{index + 1}</td>
                                {columns.map(col => (
                                    <td key={col} className="p-1.5">
                                        <input 
                                            // @ts-ignore
                                            value={row[col] || ''}
                                            // @ts-ignore
                                            onChange={(e) => handleRowChange(row.id, col, e.target.value)}
                                            className={`w-full p-1 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${['debit', 'credit'].includes(col) ? 'text-end' : ''}`}
                                            placeholder={['debit', 'credit'].includes(col) ? '---' : ''}
                                            type={['debit', 'credit'].includes(col) ? 'number' : 'text'}
                                        />
                                    </td>
                                ))}
                                <td className="p-1.5 text-center">
                                    <button className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={addRow} className="w-full py-1.5 text-center text-xs font-medium text-indigo-600 bg-indigo-50 border-t border-indigo-100 hover:bg-indigo-100">
                    + {t('addLine')}
                </button>
            </div>
        );
    }

    // 3. Action Buttons
    if (fieldId.startsWith('action_')) {
        const actionType = fieldId.replace('action_', '');
        const actionConfig = config.actions.find(a => a.type === actionType);
        if (!actionConfig?.enabled) return null;
        
        // Style specific buttons
        const isPrimary = actionType === 'submit' || fieldId.includes('submit'); 
        
        return (
            <button className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium shadow-sm transition-colors
                ${isPrimary ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}
            `}>
                {actionType === 'print' && <Printer size={14} />}
                {actionType === 'email' && <Mail size={14} />}
                {actionType === 'download_pdf' && <Download size={14} />}
                {labelOverride || actionConfig.label}
            </button>
        );
    }

    // 4. Standard Inputs
    return (
        <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{labelOverride || t(fieldId) || fieldId}</label>
            {fieldId === 'currency' || fieldId === 'paymentMethod' ? (
                 <div className="relative">
                    <select className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm appearance-none pr-6">
                        <option>Option 1</option>
                        <option>Option 2</option>
                    </select>
                    <ChevronDown className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} text-gray-400 pointer-events-none`} size={14} />
                 </div>
            ) : fieldId === 'date' ? (
                 <div className="relative">
                    <input type="date" className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm" />
                 </div>
            ) : fieldId === 'notes' ? (
                 <textarea className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm min-h-[60px]" />
            ) : (
                <input 
                    type={fieldId === 'exchangeRate' ? 'number' : 'text'}
                    className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                />
            )}
        </div>
    );
  };

  const renderSection = (name: string, layout: SectionLayout) => {
    // Determine grid rows
    const maxRow = layout.fields.reduce((max, f) => Math.max(max, f.row), 0) + 1;

    return (
      <div key={name} className={`mb-4 ${name === 'ACTIONS' ? 'bg-gray-50 border-t p-2' : 'bg-white px-4 py-3'}`}>
         {name !== 'ACTIONS' && name !== 'HEADER' && <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">{name}</h3>}
         
         <div 
           className="grid grid-cols-12 gap-x-4 gap-y-2"
           style={{ gridTemplateRows: `repeat(${maxRow}, min-content)` }}
         >
            {layout.fields.map(field => (
                <div 
                    key={field.fieldId}
                    style={{
                        gridColumnStart: field.col + 1,
                        gridColumnEnd: `span ${field.colSpan}`,
                        gridRowStart: field.row + 1,
                    }}
                >
                    {renderField(field)}
                </div>
            ))}
         </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-800 overflow-y-auto">
        {sortedSections.map(([name, layout]) => renderSection(name, layout as SectionLayout))}
    </div>
  );
});