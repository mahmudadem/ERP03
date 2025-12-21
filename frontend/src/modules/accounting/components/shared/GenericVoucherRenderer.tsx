import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { JournalRow } from '../../ai-designer/types';
import { Plus, Trash2, Calendar, ChevronDown, Download, Image as ImageIcon, Loader2, Printer, Mail, Save } from 'lucide-react';
import { CurrencyExchangeWidget } from './CurrencyExchangeWidget';

interface GenericVoucherRendererProps {
  definition: VoucherTypeDefinition;
  mode?: 'classic' | 'windows';
  initialData?: any;
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

export interface GenericVoucherRendererRef {
  getData: () => any;
}

export const GenericVoucherRenderer = React.memo(forwardRef<GenericVoucherRendererRef, GenericVoucherRendererProps>(({ definition, mode = 'windows', initialData }, ref) => {
  // GUARD: Validate canonical (only if schemaVersion is present)
  if (definition.schemaVersion && definition.schemaVersion !== 2) {
    throw new Error('Cleanup violation: legacy view type detected. Only Schema V2 allowed.');
  }

  // Language support with fallback (works without LanguageProvider)
  const t = (key: string) => key; // Simple fallback - just return key
  const isRTL = false; // Default LTR
  
  const [rows, setRows] = useState<JournalRow[]>(INITIAL_ROWS);
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  // Initialize form data: merge initialData with defaults
  useEffect(() => {
    const defaults = {
      date: new Date().toISOString().split('T')[0],
      currency: 'USD',
      exchangeRate: 1,
      paymentMethod: 'Bank Transfer'
    };
    
    // Merge: initialData takes precedence over defaults
    setFormData({ ...defaults, ...initialData });
    
    // If initialData has lines, populate rows
    if (initialData?.lines && Array.isArray(initialData.lines)) {
      const loadedRows = initialData.lines.map((line: any, index: number) => ({
        id: index + 1,
        account: line.account || '',
        notes: line.notes || '',
        debit: line.debit || 0,
        credit: line.credit || 0,
        currency: line.currency || 'USD',
        parity: line.parity || 1.0,
        equivalent: line.equivalent || 0,
        category: line.category || ''
      }));
      setRows(loadedRows);
    }
  }, [initialData]);
  
  // Expose getData method to parent via ref
  useImperativeHandle(ref, () => ({
    getData: () => {
      // Map designer codes to backend types
      const typeMap: Record<string, string> = {
        'JOURNAL': 'journal_entry',
        'PAYMENT': 'payment',
        'RECEIPT': 'receipt',
        'OPENING_BALANCE': 'opening_balance'
      };
      
      const backendType = typeMap[definition.code?.toUpperCase()] || definition.code?.toLowerCase() || 'journal_entry';
      
      return {
        ...formData,
        lines: rows.filter(row => row.account && (row.debit > 0 || row.credit > 0)),
        type: backendType
      };
    }
  }));
  
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

  // Helper: Get display prefix from definition
  const getVoucherPrefix = (): string => {
    return definition.code?.substring(0, 3) || 'VOC';
  };

  // Helper: Detect format and get table columns
  const getTableColumns = (): string[] => {
    // VoucherTypeDefinition format (system)
    if (definition.tableColumns && Array.isArray(definition.tableColumns)) {
      if (definition.tableColumns.length === 0) {
        return ['account', 'debit', 'credit', 'notes'];
      }
      // tableColumns can be array of objects {fieldId} or array of strings
      return definition.tableColumns.map((col: any) => 
        typeof col === 'string' ? col : col.fieldId
      );
    }
    // VoucherTypeConfig format (designer) - check uiModeOverrides
    const configDef = definition as any;
    if (configDef.isMultiLine && configDef.tableColumns) {
      return Array.isArray(configDef.tableColumns) ? configDef.tableColumns : ['account', 'debit', 'credit', 'notes'];
    }
    return ['account', 'debit', 'credit', 'notes'];
  };

  // --- Field Renderers ---

  const renderField = (fieldId: string, labelOverride?: string) => {
    // 0. Special Components (Currency Exchange Widget)
    if (fieldId === 'currencyExchange' || (fieldId === 'currency' && definition.headerFields?.some(f => f.id === 'exchangeRate'))) {
      return (
        <CurrencyExchangeWidget
          value={{
            currency: formData.currency || 'USD',
            exchangeRate: formData.exchangeRate || 1
          }}
          baseCurrency="USD"
          onChange={(data) => {
            handleInputChange('currency', data.currency);
            handleInputChange('exchangeRate', data.exchangeRate);
          }}
        />
      );
    }
    
    // 1. System Fields (Read Only)
    if (['voucherNo', 'status', 'createdBy', 'createdAt'].includes(fieldId)) {
       return (
         <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{labelOverride || t(fieldId) || fieldId}</label>
            <input 
              type="text" 
              readOnly 
              value={fieldId === 'voucherNo' ? `${getVoucherPrefix()}-...` : fieldId === 'status' ? 'Draft' : 'System'}
              className="w-full p-1.5 border border-gray-200 rounded bg-gray-50 text-gray-500 text-xs shadow-sm" 
            />
         </div>
       );
    }

    // 2. Line Items Table
    if (fieldId === 'lineItems') {
        const columns = getTableColumns();

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

    // 3. Standard Inputs (from canonical headerFields)
    return (
        <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{labelOverride || t(fieldId) || fieldId}</label>
            {fieldId === 'currency' || fieldId === 'paymentMethod' ? (
                 <div className="relative">
                    <select 
                      value={formData[fieldId] || ''}
                      onChange={(e) => handleInputChange(fieldId, e.target.value)}
                      className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm appearance-none pr-6"
                    >
                        {fieldId === 'currency' ? (
                          <>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="TRY">TRY</option>
                          </>
                        ) : (
                          <>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cash">Cash</option>
                            <option value="Check">Check</option>
                          </>
                        )}
                    </select>
                    <ChevronDown className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} text-gray-400 pointer-events-none`} size={14} />
                 </div>
            ) : fieldId === 'date' ? (
                 <div className="relative">
                    <input 
                      type="date" 
                      value={formData[fieldId] || ''}
                      onChange={(e) => handleInputChange(fieldId, e.target.value)}
                      className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm" 
                    />
                 </div>
            ) : fieldId === 'notes' || fieldId === 'description' ? (
                 <textarea 
                   value={formData[fieldId] || ''}
                   onChange={(e) => handleInputChange(fieldId, e.target.value)}
                   className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm min-h-[60px]" 
                 />
            ) : (
                <input 
                    type={fieldId === 'exchangeRate' || fieldId === 'amount' ? 'number' : 'text'}
                    value={formData[fieldId] || ''}
                    onChange={(e) => handleInputChange(fieldId, e.target.value)}
                    className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                />
            )}
        </div>
    );
  };

  // Render header fields - supports both formats
  const renderHeaderFields = () => {
    const configDef = definition as any;
    
    // Format 1: VoucherTypeDefinition (system) - uses headerFields
    if (definition.headerFields && definition.headerFields.length > 0) {
      return (
        <div className="bg-white px-4 py-3 mb-4">
          <div className="grid grid-cols-12 gap-x-4 gap-y-2">
            {definition.headerFields.map((field: any) => (
              <div key={field.id} className="col-span-6 md:col-span-4">
                {renderField(field.id, field.label)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // Format 2: VoucherTypeConfig (designer) - uses uiModeOverrides.sections
    if (configDef.uiModeOverrides && configDef.uiModeOverrides[mode]) {
      const sections = configDef.uiModeOverrides[mode].sections;
      const headerSection = sections.HEADER;
      
      if (!headerSection || !headerSection.fields || headerSection.fields.length === 0) {
        return null;
      }
      
      // Sort fields by row and col
      const sortedFields = [...headerSection.fields].sort((a: any, b: any) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
      
      return (
        <div className="bg-white px-4 py-3 mb-4">
          <div className="grid grid-cols-12 gap-x-4 gap-y-2">
            {sortedFields.map((field: any) => (
              <div 
                key={field.fieldId}
                className={`col-span-${Math.min(12, field.colSpan || 4)}`}
                style={{ gridColumn: `span ${Math.min(12, field.colSpan || 4)}` }}
              >
                {renderField(field.fieldId, field.labelOverride)}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Render table if multi-line - supports both formats
  const renderLineItems = () => {
    const configDef = definition as any;
    
    // Check VoucherTypeDefinition format
    const hasTableColumns = definition.tableColumns && definition.tableColumns.length > 0;
    // Check VoucherTypeConfig format
    const isMultiLine = configDef.isMultiLine || configDef.tableColumns;
    
    if (!hasTableColumns && !isMultiLine) {
      return null;
    }

    return (
      <div className="bg-white px-4 py-3 mb-4">
        <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">Line Items</h3>
        {renderField('lineItems')}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-800 overflow-y-auto">
        {/* Header Fields from Canonical */}
        {renderHeaderFields()}
        
        {/* Line Items Table (if multi-line) */}
        {renderLineItems()}

        {/* Action Buttons */}
        <div className="bg-gray-50 border-t p-2 grid grid-cols-2 gap-2">
          <button className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium shadow-sm transition-colors bg-indigo-600 text-white hover:bg-indigo-700">
            <Save size={14} />
            Save
          </button>
          <button className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium shadow-sm transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
            <Printer size={14} />
            Print
          </button>
        </div>
    </div>
  );
}));

GenericVoucherRenderer.displayName = 'GenericVoucherRenderer';