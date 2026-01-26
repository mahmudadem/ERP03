/**
 * DynamicVoucherRenderer.tsx
 * Renders a full voucher document (Header Form + Line Items Table).
 */
import React, { useState, useEffect } from 'react';
import { VoucherTypeDefinition, TableColumn } from '../types/VoucherTypeDefinition';
import { FieldDefinition } from '../types/FieldDefinition';
import { DynamicSectionRenderer } from './DynamicSectionRenderer';
import { DynamicTableRenderer } from './DynamicTableRenderer';
import { evaluateVisibility } from '../utils/evaluateRules';
import { validateForm } from '../utils/validateForm';
import { Button } from '../../components/ui/Button';
import { errorHandler } from '../../services/errorHandler';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { Loader2, Save, CheckCircle, Send } from 'lucide-react';

interface Props {
  definition: VoucherTypeDefinition;
  initialValues?: any;
  onSubmit: (data: any, status?: string) => void;
  customComponents?: Record<string, React.ComponentType<any>>;
  readOnly?: boolean;
}

export const DynamicVoucherRenderer: React.FC<Props> = ({ definition, initialValues, onSubmit, customComponents, readOnly }) => {
  const { settings, isLoading: settingsLoading } = useCompanySettings();

  // Header State
  const [headerValues, setHeaderValues] = useState<any>(initialValues?.header || {});
  const [lines, setLines] = useState<any[]>(initialValues?.lines || []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hiddenFieldIds, setHiddenFieldIds] = useState<Set<string>>(new Set());

  // Sync with initialValues (useful if settings load late)
  useEffect(() => {
    if (initialValues?.header) setHeaderValues(initialValues.header);
    if (initialValues?.lines) setLines(initialValues.lines);
  }, [initialValues]);

  // Evaluate Rules (Header only for now)
  useEffect(() => {
    // TODO: Re-implement rules evaluation for flat headerFields if needed
    // if (definition?.header?.rules) {
    //    const hidden = evaluateVisibility(definition.header.rules, headerValues);
    //    setHiddenFieldIds(hidden);
    // }
  }, [headerValues, definition]);

  const handleHeaderChange = (field: string, val: any) => {
    setHeaderValues((prev: any) => ({ ...prev, [field]: val }));
  };

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (status?: string) => {
    // Prepare Payload
    const payload = {
      ...headerValues,
      items: lines
    };
    
    if (status === 'submitted') setIsSubmitting(true);
    else setIsSaving(true);

    try {
      await onSubmit(payload, status);
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  // Calculate Totals (Mock simple summation logic for now)
  const totalAmount = lines.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);

  if (!definition) return <div>Loading definition...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
           <div className="flex items-center gap-3">
             <h2 className="font-bold text-lg text-gray-800">{definition.name}</h2>
             
             {/* Status Indicator Dot */}
             <div className="group relative">
                <div 
                  className={`w-2 h-2 rounded-full transition-all cursor-help ${
                    settingsLoading ? 'bg-gray-400 animate-pulse' : 
                    (settings?.strictApprovalMode ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]')
                  }`} 
                />
                <div className="absolute left-0 top-4 hidden group-hover:block bg-gray-800 text-white text-[10px] p-2 rounded-md shadow-xl whitespace-nowrap z-50 border border-gray-700 font-normal">
                  <div className="font-bold mb-1 border-b border-gray-600 pb-1">System Mode</div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                    <span className="text-gray-400">Policy:</span>
                    <span className={settings?.strictApprovalMode ? "text-indigo-300" : "text-emerald-300"}>
                      {settings?.strictApprovalMode ? 'Strict (Approval Required)' : 'Flexible (Auto-Post)'}
                    </span>
                  </div>
                </div>
              </div>
           </div>
           <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">{definition.code}</span>
        </div>
        
        <div className="p-6">
          {/* Render Header Fields in a default section */}
          {definition.headerFields && definition.headerFields.length > 0 ? (
            <DynamicSectionRenderer
                  section={{
                      id: 'main-header',
                      title: 'Header Information',
                      fieldIds: definition.headerFields.map(f => f.id)
                  }}
                  allFields={definition.headerFields}
                  values={headerValues}
                  errors={errors}
                  onChange={handleHeaderChange}
                  hiddenFieldIds={hiddenFieldIds}
                  customComponents={customComponents}
                  readOnly={readOnly}
            />
          ) : (
            <div className="text-gray-400 italic">No header fields defined.</div>
          )}
        </div>
      </div>

      {/* 2. Line Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="font-bold text-gray-700 mb-2">Line Items</h3>
        {definition.tableColumns && definition.tableColumns.length > 0 && (
            <DynamicTableRenderer
            definition={{ 
              id: 'lines-table', 
              name: 'items', 
              columns: resolveTableFields(definition)
            }} 
            rows={lines}
            onChange={setLines}
            customComponents={customComponents}
            tableStyle={definition.tableStyle}
            readOnly={readOnly}
            />
        )}
        
        {/* Footer Totals */}
        <div className="flex justify-end mt-4 pt-4 border-t">
          <div className="w-64 space-y-2">
             <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-medium text-gray-900">{totalAmount.toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax (0%):</span>
                <span className="font-medium text-gray-900">0.00</span>
             </div>
             <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>${totalAmount.toFixed(2)}</span>
             </div>
          </div>
        </div>
      </div>

      {/* 3. Actions */}
      <div className="flex justify-end gap-3 sticky bottom-4 z-10 bg-white/80 p-4 backdrop-blur-sm rounded-lg border shadow-lg transition-colors">
         <Button variant="secondary" onClick={() => window.history.back()}>Discard</Button>
         
         <button
            onClick={() => handleSave()}
            className={`flex items-center gap-2 px-6 py-2 text-sm font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 border ${
              settingsLoading 
                ? 'bg-white border-gray-200 text-gray-500' 
                : settings?.strictApprovalMode === true
                  // Strict Mode: 'Save as Draft' is Secondary action
                  ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  // Flexible Mode: 'Save & Post' is Primary action
                  : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-md shadow-emerald-500/20'
            }`}
            disabled={isSaving || settingsLoading || readOnly}
          >
            {isSaving || settingsLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {settingsLoading ? 'Loading...' : (settings?.strictApprovalMode === true ? 'Saving...' : 'Posting...')}
              </>
            ) : (
              <>
                {settings?.strictApprovalMode === true ? <Save className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                {settings?.strictApprovalMode === true ? 'Save as Draft' : 'Save & Post'}
              </>
            )}
          </button>

          {/* Submit button only shown when strict mode is explicitly true */}
          {!settingsLoading && settings?.strictApprovalMode === true && (!headerValues.status || headerValues.status?.toLowerCase() === 'draft' || headerValues.status?.toLowerCase() === 'rejected') && (
            <button
              onClick={() => handleSave('submitted')} 
              className="flex items-center gap-2 px-8 py-2 text-sm font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md shadow-primary-500/20 disabled:opacity-50 transition-all active:scale-[0.98]"
              disabled={isSubmitting || readOnly}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Approval
                </>
              )}
            </button>
          )}
      </div>
    </div>
  );
};

/**
 * Standard Accounting Fields for Table Columns
 */
const STANDARD_TABLE_FIELDS: Record<string, Partial<FieldDefinition>> = {
  account: {
    label: 'Account',
    type: 'account-selector',
    required: true
  },
  debit: {
    label: 'Debit',
    type: 'NUMBER',
    required: false
  },
  credit: {
    label: 'Credit',
    type: 'NUMBER',
    required: false
  },
  description: {
    label: 'Description',
    type: 'TEXT',
    required: false
  },
  notes: {
    label: 'Notes',
    type: 'TEXTAREA',
    required: false
  },
  amount: {
    label: 'Amount',
    type: 'NUMBER',
    required: true
  },
  currency: {
    label: 'Currency',
    type: 'SELECT',
    options: [
      { label: 'USD', value: 'USD' },
      { label: 'EUR', value: 'EUR' },
      { label: 'TRY', value: 'TRY' }
    ]
  },
  exchangeRate: {
    label: 'Rate',
    type: 'NUMBER'
  }
};

/**
 * Resolves TableColumn IDs into full FieldDefinition objects
 */
function resolveTableFields(definition: VoucherTypeDefinition): FieldDefinition[] {
  return (definition.tableColumns || []).map(col => {
    // Robustly identify the ID (handle strings or objects)
    const colId = typeof col === 'string' ? col : (col.fieldId || (col as any).id);
    
    if (!colId) {
       return {
         id: 'unknown-' + Math.random().toString(36).slice(2, 5),
         name: 'unknown',
         label: 'Column',
         type: 'TEXT',
         isPosting: true,
         schemaVersion: 2
       } as FieldDefinition;
    }

    // 1. Try to find in headerFields (sometimes definitions are shared)
    const existing = (definition.headerFields || []).find(f => f.id === colId);
    
    // 2. Check standard registry
    const standard = STANDARD_TABLE_FIELDS[colId];
    
    // Determine base properties
    const baseField = existing || standard || { 
      label: colId.charAt(0).toUpperCase() + colId.slice(1),
      type: 'TEXT'
    };

    // Extract object-specific properties if col is an object
    const colObj = typeof col === 'object' ? col : {};

    return {
      id: colId,
      name: colId,
      isPosting: true,
      postingRole: null,
      schemaVersion: 2,
      ...baseField,
      // Override with user customizations from the wizard
      label: (colObj as any).labelOverride || (colObj as any).label || baseField.label || colId,
      width: (colObj as any).width || baseField.width,
    } as FieldDefinition;
  });
}