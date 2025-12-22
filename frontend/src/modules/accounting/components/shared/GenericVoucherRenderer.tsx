import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { JournalRow } from '../../ai-designer/types';
import { Plus, Trash2, Calendar, ChevronDown, Download, Image as ImageIcon, Loader2, Printer, Mail, Save } from 'lucide-react';
import { CurrencyExchangeWidget } from './CurrencyExchangeWidget';
import { AccountSelector } from './AccountSelector';
import { Account } from '../../../../context/AccountsContext';

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
    const today = new Date().toISOString().split('T')[0];
    
    // System field defaults - show proper fallbacks for unsaved vouchers
    const systemDefaults = {
      voucherNo: 'Auto-generated',
      status: 'Draft',
      createdBy: 'Current User',
      createdAt: 'On Save',
      updatedAt: 'On Save',
      updatedBy: 'Current User'
    };
    
    // User input field defaults
    const inputDefaults = {
      date: today,
      currency: 'USD',
      exchangeRate: 1,
      paymentMethod: 'Bank Transfer',
      reference: '',
      description: '',
      notes: ''
    };
    
    const defaults = { ...systemDefaults, ...inputDefaults };
    
    // Convert dates from ISO to yyyy-MM-dd format for HTML date inputs
    const processedInitialData = initialData ? {
      ...initialData,
      date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : undefined,
      // Keep system values if they exist in initialData
      voucherNo: initialData.voucherNo || initialData.id || systemDefaults.voucherNo,
      status: initialData.status || systemDefaults.status,
      createdBy: initialData.createdBy || systemDefaults.createdBy,
      createdAt: initialData.createdAt ? new Date(initialData.createdAt).toLocaleDateString() : systemDefaults.createdAt
    } : {};
    
    // Merge: initialData takes precedence over defaults
    const mergedData = { ...defaults, ...processedInitialData };
    setFormData(mergedData);
    
    // If initialData has lines, populate rows
    if (initialData?.lines && Array.isArray(initialData.lines)) {
      const loadedRows = initialData.lines.map((line: any, index: number) => ({
        id: index + 1,
        account: line.accountId || line.account || '',
        notes: line.description || line.notes || '',
        debit: line.debitFx || line.debit || 0,
        credit: line.creditFx || line.credit || 0,
        currency: line.lineCurrency || line.currency || 'USD',
        parity: line.exchangeRate || line.parity || 1.0,
        equivalent: line.baseAmount || line.equivalent || 0,
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
        'JOURNAL_ENTRY': 'journal_entry',
        'PAYMENT': 'payment',
        'RECEIPT': 'receipt',
        'OPENING_BALANCE': 'opening_balance',
        'OPENING': 'opening_balance'
      };
      
      // Try to resolve backend type from multiple sources
      const defAny = definition as any;
      let backendType = 'journal_entry'; // Default fallback
      
      // 0. Check explicit baseType (stored when form is cloned/created)
      if (defAny.baseType && typeMap[defAny.baseType.toUpperCase()]) {
        backendType = typeMap[defAny.baseType.toUpperCase()];
      }
      // 1. Check explicit _typeId (from custom forms)
      else if (defAny._typeId && typeMap[defAny._typeId.toUpperCase()]) {
        backendType = typeMap[defAny._typeId.toUpperCase()];
      }
      // 2. Check code directly
      else if (definition.code && typeMap[definition.code.toUpperCase()]) {
        backendType = typeMap[definition.code.toUpperCase()];
      }
      // 3. Try to infer from name (for cloned forms like "Journal Entry - Copy")
      else if (definition.name) {
        const nameLower = definition.name.toLowerCase();
        if (nameLower.includes('journal')) backendType = 'journal_entry';
        else if (nameLower.includes('payment')) backendType = 'payment';
        else if (nameLower.includes('receipt')) backendType = 'receipt';
        else if (nameLower.includes('opening')) backendType = 'opening_balance';
      }
      // 4. Check if code contains a base type pattern
      else if (definition.code) {
        const codeLower = definition.code.toLowerCase();
        if (codeLower.includes('journal')) backendType = 'journal_entry';
        else if (codeLower.includes('payment')) backendType = 'payment';
        else if (codeLower.includes('receipt')) backendType = 'receipt';
        else if (codeLower.includes('opening')) backendType = 'opening_balance';
      }
      
      // Map rows to backend VoucherLine format
      const backendLines = rows
        .filter(row => row.account && (row.debit > 0 || row.credit > 0))
        .map(row => ({
          accountId: row.account,  // Map account → accountId
          description: row.notes || '',  // Map notes → description
          debitFx: row.debit || 0,
          creditFx: row.credit || 0,
          debitBase: row.debit || 0,  // For now, assume same as Fx
          creditBase: row.credit || 0,
          lineCurrency: row.currency || 'USD',
          exchangeRate: row.parity || 1
        }));
      
      const resultFormId = definition.id;
      const resultPrefix = (definition as any).prefix || definition.code?.slice(0, 3).toUpperCase() || 'V';
      
      return {
        ...formData,
        lines: backendLines,
        type: backendType,  // Backend type for strategy (payment, receipt, journal_entry, opening_balance)
        formId: resultFormId, // Which form was used for rendering
        prefix: resultPrefix // Voucher number prefix
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
      // tableColumns can be array of objects {fieldId} or {id} or array of strings
      return definition.tableColumns.map((col: any) => 
        typeof col === 'string' ? col : (col.fieldId || col.id || col)
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
              value={formData[fieldId] || 'Pending'}
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
                                        {col === 'account' ? (
                                            <AccountSelector
                                                value={row.account}
                                                onChange={(acc: Account | null) => handleRowChange(row.id, 'account', acc?.code || '')}
                                                placeholder="Select account"
                                                className="w-full"
                                            />
                                        ) : (
                                            <input 
                                                // @ts-ignore
                                                value={row[col] || ''}
                                                // @ts-ignore
                                                onChange={(e) => handleRowChange(row.id, col, e.target.value)}
                                                className={`w-full p-1 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${['debit', 'credit'].includes(col) ? 'text-end' : ''}`}
                                                placeholder={['debit', 'credit'].includes(col) ? '---' : ''}
                                                type={['debit', 'credit'].includes(col) ? 'number' : 'text'}
                                            />
                                        )}
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
    
    // System fields list - these are read-only display fields
    const systemFields = ['voucherNo', 'status', 'createdBy', 'createdAt', 'updatedAt', 'updatedBy'];
    const isSystemField = systemFields.includes(fieldId);

    return (
        <div className="space-y-0.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{labelOverride || t(fieldId) || fieldId}</label>
            {/* System fields - display as read-only */}
            {isSystemField ? (
                <div className="w-full p-1.5 border border-gray-100 rounded bg-gray-50 text-xs text-gray-600 italic">
                    {formData[fieldId] || 'Pending'}
                </div>
            ) : fieldId === 'currency' || fieldId === 'paymentMethod' ? (
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

  // Render any section from uiModeOverrides (BODY, EXTRA, etc.)
  const renderSection = (sectionKey: string, title?: string) => {
    const configDef = definition as any;
    
    if (!configDef.uiModeOverrides || !configDef.uiModeOverrides[mode]) {
      return null;
    }
    
    const sections = configDef.uiModeOverrides[mode].sections;
    const section = sections?.[sectionKey];
    
    if (!section || !section.fields || section.fields.length === 0) {
      return null;
    }
    
    // Sort fields by row and col
    const sortedFields = [...section.fields].sort((a: any, b: any) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
    
    return (
      <div className="bg-white px-4 py-3 mb-4">
        {title && <h3 className="text-xs font-bold text-gray-400 mb-2 uppercase">{title}</h3>}
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
  };

  // Check if BODY section has lineItems to avoid rendering twice
  const bodyHasLineItems = () => {
    const configDef = definition as any;
    if (!configDef.uiModeOverrides || !configDef.uiModeOverrides[mode]) return false;
    const bodySection = configDef.uiModeOverrides[mode]?.sections?.BODY;
    return bodySection?.fields?.some((f: any) => f.fieldId === 'lineItems');
  };

  // Render action buttons from config
  const renderActions = () => {
    const configDef = definition as any;
    const actions = configDef.actions || [];
    
    // If no custom actions defined, render default buttons
    if (!actions.length) {
      return (
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
      );
    }
    
    // Render custom actions from config
    return (
      <div className="bg-gray-50 border-t p-2 grid grid-cols-2 gap-2">
        {actions.filter((a: any) => a.enabled !== false).map((action: any, index: number) => (
          <button 
            key={action.id || index}
            className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium shadow-sm transition-colors ${
              action.primary 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {action.label || action.id}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-800 overflow-y-auto">
        {/* Header Fields from Canonical */}
        {renderHeaderFields()}
        
        {/* Body Section (if defined) - may include lineItems */}
        {renderSection('BODY')}
        
        {/* Line Items Table (if multi-line and not already in BODY) */}
        {!bodyHasLineItems() && renderLineItems()}
        
        {/* Extra Section (if defined) */}
        {renderSection('EXTRA', 'Additional Information')}

        {/* Action Buttons - from config or default */}
        {renderActions()}
    </div>
  );
}));

GenericVoucherRenderer.displayName = 'GenericVoucherRenderer';