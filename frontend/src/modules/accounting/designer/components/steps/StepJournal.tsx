import React, { useEffect } from 'react';
import { VoucherTypeDefinition, TableColumn } from '../../../../../designer-engine/types/VoucherTypeDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
  onValidationChange: (isValid: boolean) => void;
}

const AVAILABLE_COLUMNS = [
  { id: 'account', label: 'Account' },
  { id: 'debit', label: 'Debit' },
  { id: 'credit', label: 'Credit' },
  { id: 'description', label: 'Description' },
  { id: 'costCenter', label: 'Cost Center' },
  { id: 'project', label: 'Project' },
  { id: 'currency', label: 'Currency' },
  { id: 'exchangeRate', label: 'Exchange Rate' },
  { id: 'reference', label: 'Reference' }
];

export const StepJournal: React.FC<Props> = ({ definition, updateDefinition, onValidationChange }) => {
  const columns = definition.tableColumns || [];

  useEffect(() => {
    onValidationChange(true);
  }, [onValidationChange]);

  const toggleColumn = (field: { id: string; label: string }) => {
    const exists = columns.some(c => c.fieldId === field.id);
    
    if (exists) {
      updateDefinition({
        tableColumns: columns.filter(c => c.fieldId !== field.id)
      });
    } else {
      const newColumn: TableColumn = {
        fieldId: field.id,
        width: '15%'
      };
      updateDefinition({
        tableColumns: [...columns, newColumn]
      });
    }
  };

  return (
    <div className="space-y-8 p-4">
      <div className="border-b pb-4 border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Table Configuration
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Select columns for the line items table.
        </p>
      </div>

      <section>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Available Columns
        </h3>
        <div className="flex flex-wrap gap-2 mb-6">
          {AVAILABLE_COLUMNS.map(field => {
            const isSelected = columns.some(c => c.fieldId === field.id);
            return (
              <button
                key={field.id}
                onClick={() => toggleColumn(field)}
                className={`px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {isSelected && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {field.label}
              </button>
            );
          })}
        </div>

        {columns.length > 0 && (
          <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th className="px-4 py-3">Column</th>
                  <th className="px-4 py-3 text-center">Width</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((column, index) => {
                  const field = AVAILABLE_COLUMNS.find(f => f.id === column.fieldId);
                  return (
                    <tr key={column.fieldId} className="border-b bg-white">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {field?.label || column.fieldId}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="text"
                          value={column.width || '15%'}
                          onChange={(e) => {
                            const newColumns = [...columns];
                            newColumns[index] = { ...newColumns[index], width: e.target.value };
                            updateDefinition({ tableColumns: newColumns });
                          }}
                          className="w-20 px-2 py-1 text-center border border-gray-300 rounded bg-white"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
