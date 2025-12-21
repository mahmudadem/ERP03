/**
 * Generic Voucher Renderer
 * 
 * ⚠️ PURE UI PREVIEW COMPONENT
 * 
 * This component renders a PREVIEW of what a voucher will look like
 * based on the wizard's configuration. It's used for the "Test Run" feature.
 * 
 * This is NOT a real voucher form - just a preview/mockup.
 * No data is saved, no accounting logic, just visual preview.
 */

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { VoucherTypeConfig, SectionLayout, FieldLayout, UIMode } from '../types';
import { Plus, Trash2, ChevronDown, Download, Printer, Mail } from 'lucide-react';

// Mock journal row for preview
interface JournalRow {
  id: number;
  account: string;
  notes: string;
  debit: number;
  credit: number;
  currency: string;
  parity: number;
  equivalent: number;
  category: string;
}

interface GenericVoucherRendererProps {
  config: VoucherTypeConfig;
  mode?: UIMode;
  initialData?: any;
  onDataChange?: (data: any) => void;
}

const INITIAL_ROWS: JournalRow[] = Array.from({ length: 2 }).map((_, i) => ({
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

export interface GenericVoucherRendererRef {
  getData: () => any;
}

export const GenericVoucherRenderer = React.memo(forwardRef<GenericVoucherRendererRef, GenericVoucherRendererProps>(({ 
  config, 
  mode = 'windows',
  initialData,
  onDataChange
}) => {
  // Helper to format date for HTML date input (YYYY-MM-DD)
  const formatDateForInput = (dateValue: any) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  // Helper to map backend voucher lines to UI rows
  const mapLinesToRows = (lines: any[]): JournalRow[] => {
    return lines.map((line, idx) => ({
      id: line.id || idx + 1,
      account: line.account || line.accountId || '',
      notes: line.notes || line.description || '',
      debit: line.debit || line.debitFx || 0,
      credit: line.credit || line.creditFx || 0,
      currency: line.currency || line.lineCurrency || 'USD',
      parity: line.parity || line.exchangeRate || 1.0,
      equivalent: line.equivalent || line.baseAmount || 0,
      category: line.category || ''
    }));
  };

  const [rows, setRows] = useState<JournalRow[]>(
    initialData?.lines ? mapLinesToRows(initialData.lines) : 
    (initialData?.rows ? mapLinesToRows(initialData.rows) : INITIAL_ROWS)
  );
  const [formData, setFormData] = useState<Record<string, any>>({
    ...initialData,
    // Add alias for voucherNo/voucherNumber mismatch
    voucherNumber: initialData?.voucherNo || initialData?.voucherNumber || '',
    voucherNo: initialData?.voucherNo || initialData?.voucherNumber || ''
  });
  
  // Sync state when initialData changes
  React.useEffect(() => {
    if (initialData) {
      console.log('📦 [GenericVoucherRenderer] Syncing with initialData:', initialData);
      setFormData({
        ...initialData,
        voucherNumber: initialData.voucherNo || initialData.voucherNumber || '',
        voucherNo: initialData.voucherNo || initialData.voucherNumber || ''
      });
      if (initialData.lines || initialData.rows) {
        setRows(mapLinesToRows(initialData.lines || initialData.rows));
      }
    }
  }, [initialData]);

  const layoutMode = mode; 
  const sectionsData = config.uiModeOverrides?.[layoutMode]?.sections || {};

  // Notify parent on any change
  const notifyChange = (newFormData: any, newRows: any[]) => {
    if (onDataChange) {
      onDataChange({
        ...newFormData,
        lines: newRows
      });
    }
  };

  const handleInputChange = (fieldId: string, value: any) => {
    const updatedForm = { ...formData, [fieldId]: value };
    setFormData(updatedForm);
    notifyChange(updatedForm, rows);
  };

  const handleRowChange = (id: number, field: keyof JournalRow, value: any) => {
    const updatedRows = rows.map(row => row.id === id ? { ...row, [field]: value } : row);
    setRows(updatedRows);
    notifyChange(formData, updatedRows);
  };

  const addRow = () => {
    const newRows = [...rows, {
      id: rows.length + 1,
      account: '', notes: '', debit: 0, credit: 0, currency: 'USD', parity: 1, equivalent: 0, category: ''
    }];
    setRows(newRows);
    notifyChange(formData, newRows);
  };

  const removeRow = (id: number) => {
    const newRows = rows.filter(r => r.id !== id);
    setRows(newRows);
    notifyChange(formData, newRows);
  };

  // --- Field Renderers ---

  const renderField = (fieldLayout: FieldLayout) => {
    const { fieldId, labelOverride } = fieldLayout;
    
    // 1. System Fields (Read Only)
    if (['voucherNo', 'status', 'createdBy', 'createdAt'].includes(fieldId)) {
       return (
         <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{labelOverride || fieldId}</label>
            <input 
              type="text" 
              readOnly 
              value={formData[fieldId] || (fieldId === 'voucherNo' ? 'Pending...' : fieldId === 'status' ? 'Draft' : 'System')}
              className="w-full p-1.5 border border-gray-200 rounded bg-gray-50 text-gray-500 text-xs shadow-sm" 
            />
         </div>
       );
    }

    // 2. Line Items Table
    if (fieldId === 'lineItems') {
        const columns = config.tableColumns && config.tableColumns.length > 0 
            ? config.tableColumns 
            : ['account', 'debit', 'credit', 'notes'];

        return (
            <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-sm min-h-[200px] bg-white">
                <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                        <tr>
                            <th className="p-2 text-start w-10 text-xs border-r border-gray-200">#</th>
                            {columns.map(col => (
                                <th key={col} className="p-2 text-start text-xs capitalize border-r border-gray-200 last:border-0">{col}</th>
                            ))}
                            <th className="p-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rows.map((row, index) => (
                            <tr key={row.id} className="group hover:bg-slate-50 transition-colors">
                                <td className="p-1.5 text-center text-gray-400 text-[10px] border-r border-gray-200">{index + 1}</td>
                                {columns.map(col => (
                                    <td key={col} className="p-0 border-r border-gray-200 last:border-0">
                                        <input 
                                            // @ts-ignore
                                            value={row[col] === 0 && (col === 'debit' || col === 'credit') ? '' : row[col] || ''}
                                            // @ts-ignore
                                            onChange={(e) => handleRowChange(row.id, col, col === 'debit' || col === 'credit' ? Number(e.target.value) : e.target.value)}
                                            className={`w-full p-2 bg-transparent text-xs hover:bg-white focus:bg-white focus:ring-1 focus:ring-blue-400 outline-none border-0 ${['debit', 'credit'].includes(col) ? 'text-end' : ''}`}
                                            placeholder={['debit', 'credit'].includes(col) ? '0.00' : ''}
                                            type={['debit', 'credit'].includes(col) ? 'number' : 'text'}
                                        />
                                    </td>
                                ))}
                                <td className="p-1.5 text-center">
                                    <button 
                                        onClick={() => removeRow(row.id)}
                                        className="text-gray-300 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={addRow} className="w-full py-1.5 text-center text-xs font-medium text-blue-600 bg-blue-50/50 border-t border-blue-100 hover:bg-blue-100/50 transition-colors">
                    + Add Line
                </button>
            </div>
        );
    }

    // 3. Action Buttons - These are handled by the Window container now
    if (fieldId.startsWith('action_')) {
        return null;
    }

    // 4. Standard Inputs
    return (
        <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{labelOverride || fieldId}</label>
            {fieldId === 'currency' || fieldId === 'paymentMethod' ? (
                 <div className="relative">
                    <select 
                        value={formData[fieldId] || ''}
                        onChange={(e) => handleInputChange(fieldId, e.target.value)}
                        className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-blue-500 outline-none shadow-sm appearance-none pr-6 hover:border-gray-300 transition-colors"
                    >
                        <option value="">Select...</option>
                        {fieldId === 'currency' ? (
                            <>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="EGP">EGP</option>
                            </>
                        ) : (
                            <>
                                <option value="cash">Cash</option>
                                <option value="bank">Bank Transfer</option>
                                <option value="check">Check</option>
                            </>
                        )}
                    </select>
                    <ChevronDown className="absolute top-2 right-2 text-gray-400 pointer-events-none" size={14} />
                 </div>
            ) : fieldId === 'date' ? (
                 <div className="relative">
                    <input 
                        type="date" 
                        value={formatDateForInput(formData[fieldId])}
                        onChange={(e) => handleInputChange(fieldId, e.target.value)}
                        className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-blue-500 outline-none shadow-sm hover:border-gray-300 transition-colors" 
                    />
                 </div>
            ) : fieldId === 'notes' || fieldId === 'description' ? (
                 <textarea 
                    value={formData[fieldId] || ''}
                    onChange={(e) => handleInputChange(fieldId, e.target.value)}
                    className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-blue-500 outline-none shadow-sm min-h-[60px] hover:border-gray-300 transition-colors" 
                 />
            ) : (
                <input 
                    type={fieldId === 'exchangeRate' ? 'number' : 'text'}
                    value={formData[fieldId] || ''}
                    onChange={(e) => handleInputChange(fieldId, fieldId === 'exchangeRate' ? Number(e.target.value) : e.target.value)}
                    className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-blue-500 outline-none shadow-sm hover:border-gray-300 transition-colors"
                />
            )}
        </div>
    );
  };

  const renderSection = (name: string, layout: SectionLayout) => {
    // If it's the actions section, we skip it since we use the window footer for actions
    if (name === 'ACTIONS') return null;

    const maxRow = layout.fields.reduce((max, f) => Math.max(max, f.row), 0) + 1;

    return (
      <div key={name} className={`mb-4 ${name === 'HEADER' ? 'bg-white px-4 py-3' : 'bg-white px-4 py-3'}`}>
         {name !== 'HEADER' && <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">{name}</h3>}
         
         <div 
           className="grid grid-cols-12 gap-x-4 gap-y-3"
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

  // Sort sections by order
  const sortedSections = Object.entries(sectionsData)
    .sort(([, a], [, b]) => (a as SectionLayout).order - (b as SectionLayout).order);

  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-800">
        {sortedSections.map(([name, layout]) => renderSection(name, layout as SectionLayout))}
    </div>
  );
}));

GenericVoucherRenderer.displayName = 'GenericVoucherRenderer';
