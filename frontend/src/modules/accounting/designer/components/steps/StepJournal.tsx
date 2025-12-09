import React from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';

// Defined locally as it was missing from types directory
export interface TableColumnDefinition {
    id: string;
    name: string;
    label: string;
    type: 'TEXT' | 'NUMBER' | 'ACCOUNT' | 'CURRENCY' | 'DATE';
    width?: number;
    required?: boolean;
    editable?: boolean;
}

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
}

const AVAILABLE_LINE_FIELDS = [
    { id: 'account', defaultLabel: 'Account' },
    { id: 'debit', defaultLabel: 'Debit' },
    { id: 'credit', defaultLabel: 'Credit' },
    { id: 'description', defaultLabel: 'Description' },
    { id: 'costCenter', defaultLabel: 'Cost Center' },
    { id: 'project', defaultLabel: 'Project' },
    { id: 'currency', defaultLabel: 'Currency' },
    { id: 'exchangeRate', defaultLabel: 'Exchange Rate' },
    { id: 'reference', defaultLabel: 'Reference' },
];

export const StepJournal: React.FC<Props> = ({ definition, updateDefinition }) => {
  const columns = definition.tableFields || [];
  const activeColumnIds = new Set(columns.map(c => c.id));

  const toggleColumn = (template: any) => {
    if (activeColumnIds.has(template.id)) {
        updateDefinition({
            tableFields: columns.filter(c => c.id !== template.id)
        });
    } else {
        const newColumn: TableColumnDefinition = {
            id: template.id,
            name: template.id,
            label: template.defaultLabel,
            type: 'TEXT', // Simplified
            width: 150,
            required: false,
            editable: true
        };
        updateDefinition({
            tableFields: [...columns, newColumn]
        });
    }
  };

  if (definition.mode === 'single-line') { 
     return (
        <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
                Not Applicable
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
                This step is for multi-line vouchers only. You are in Single-line mode.
            </p>
        </div>
    );
  }

  return (
    <div className="space-y-8 p-4">
        <div className="border-b pb-4 border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
                Journal Configuration
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                Configure the line items table columns.
            </p>
        </div>

        {/* Table Columns */}
        <section>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
                Table Columns
            </h3>
            <div className="flex flex-wrap gap-2 mb-6">
                {AVAILABLE_LINE_FIELDS.map(field => {
                    const isSelected = activeColumnIds.has(field.id);
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
                            {field.defaultLabel}
                        </button>
                    );
                })}
            </div>

            {/* Column Configuration */}
            {columns.length > 0 && (
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th className="px-4 py-3">Column</th>
                                <th className="px-4 py-3 text-center">Width</th>
                                <th className="px-4 py-3 text-center">Required</th>
                                <th className="px-4 py-3 text-center">Editable</th>
                            </tr>
                        </thead>
                        <tbody>
                            {columns.map((column, index) => (
                                <tr key={column.id} className="border-b bg-white">
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                        {column.label || column.id}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="number"
                                            value={column.width || 150}
                                            onChange={(e) => {
                                                const newColumns = [...columns];
                                                newColumns[index] = { ...column, width: parseInt(e.target.value) };
                                                updateDefinition({ tableFields: newColumns });
                                            }}
                                            className="w-20 px-2 py-1 text-center border border-gray-300 rounded bg-white"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={column.required}
                                            onChange={(e) => {
                                                const newColumns = [...columns];
                                                newColumns[index] = { ...column, required: e.target.checked };
                                                updateDefinition({ tableFields: newColumns });
                                            }}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={column.editable !== false}
                                            onChange={(e) => {
                                                const newColumns = [...columns];
                                                newColumns[index] = { ...column, editable: e.target.checked };
                                                updateDefinition({ tableFields: newColumns });
                                            }}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    </div>
  );
};
