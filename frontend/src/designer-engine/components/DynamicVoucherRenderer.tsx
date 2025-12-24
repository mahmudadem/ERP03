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

interface Props {
  definition: VoucherTypeDefinition;
  initialValues?: any;
  onSubmit: (data: any) => void;
  customComponents?: Record<string, React.ComponentType<any>>;
}

export const DynamicVoucherRenderer: React.FC<Props> = ({ definition, initialValues, onSubmit, customComponents }) => {
  // Header State
  const [headerValues, setHeaderValues] = useState<any>(initialValues?.header || {});
  const [lines, setLines] = useState<any[]>(initialValues?.lines || []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hiddenFieldIds, setHiddenFieldIds] = useState<Set<string>>(new Set());

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

  const handleSave = () => {
    // Validate Header
    // TODO: Re-implement validation for flat fields
    /*
    if (definition?.headerFields) {
        const headerErrors = validateForm(definition.header, headerValues);
        if (Object.keys(headerErrors).length > 0) {
        setErrors(headerErrors);
        errorHandler.showError({
          code: 'VAL_001',
          message: 'Please correct the errors in the header.',
          severity: 'WARNING'
        } as any);
        return;
        }
    }
    */

    // Prepare Payload
    const payload = {
      ...headerValues,
      items: lines
    };
    
    onSubmit(payload);
  };

  // Calculate Totals (Mock simple summation logic for now)
  const totalAmount = lines.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);

  if (!definition) return <div>Loading definition...</div>;

  return (
    <div className="space-y-6">
      {/* 1. Header Sections */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
           <h2 className="font-bold text-lg text-gray-800">{definition.name}</h2>
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
      <div className="flex justify-end gap-3 sticky bottom-4 z-10 bg-white/80 p-4 backdrop-blur-sm rounded-lg border shadow-lg">
         <Button variant="secondary" onClick={() => window.history.back()}>Discard</Button>
         <Button variant="primary" onClick={handleSave} className="min-w-[120px]">Save Voucher</Button>
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