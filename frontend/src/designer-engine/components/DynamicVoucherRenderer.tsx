/**
 * DynamicVoucherRenderer.tsx
 * Renders a full voucher document (Header Form + Line Items Table).
 */
import { useState, useEffect } from 'react';
import { VoucherTypeDefinition } from '../types/VoucherTypeDefinition';
import { DynamicSectionRenderer } from './DynamicSectionRenderer';
import { DynamicTableRenderer } from './DynamicTableRenderer';
import { evaluateVisibility } from '../utils/evaluateRules';
import { validateForm } from '../utils/validateForm';
import { Button } from '../../components/ui/Button';

interface Props {
  definition: VoucherTypeDefinition;
  initialValues?: any;
  onSubmit: (data: any) => void;
}

export const DynamicVoucherRenderer: React.FC<Props> = ({ definition, initialValues, onSubmit }) => {
  // Header State
  const [headerValues, setHeaderValues] = useState<any>(initialValues?.header || {});
  const [lines, setLines] = useState<any[]>(initialValues?.lines || []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hiddenFieldIds, setHiddenFieldIds] = useState<Set<string>>(new Set());

  // Evaluate Rules (Header only for now)
  useEffect(() => {
    const hidden = evaluateVisibility(definition.header.rules, headerValues);
    setHiddenFieldIds(hidden);
  }, [headerValues, definition.header.rules]);

  const handleHeaderChange = (field: string, val: any) => {
    setHeaderValues((prev: any) => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    // Validate Header
    const headerErrors = validateForm(definition.header, headerValues);
    if (Object.keys(headerErrors).length > 0) {
      setErrors(headerErrors);
      alert('Please correct the errors in the header.');
      return;
    }

    // Prepare Payload
    const payload = {
      ...headerValues,
      items: lines
    };
    
    onSubmit(payload);
  };

  // Calculate Totals (Mock simple summation logic for now)
  const totalAmount = lines.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header Sections */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
           <h2 className="font-bold text-lg text-gray-800">{definition.name}</h2>
           <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">{definition.code}</span>
        </div>
        
        <div className="p-6">
          {definition.header.sections.map(section => (
            <DynamicSectionRenderer
              key={section.id}
              section={section}
              allFields={definition.header.fields}
              values={headerValues}
              errors={errors}
              onChange={handleHeaderChange}
              hiddenFieldIds={hiddenFieldIds}
            />
          ))}
        </div>
      </div>

      {/* 2. Line Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="font-bold text-gray-700 mb-2">Line Items</h3>
        <DynamicTableRenderer
          definition={definition.lines}
          rows={lines}
          onChange={setLines}
        />
        
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