import React from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';
import { FieldDefinition } from '../../../../../designer-engine/types/FieldDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
}

// Mock available fields since we don't have the constants file
const AVAILABLE_FIELDS = [
    { id: 'date', defaultLabel: 'Date', section: 'HEADER', defaultSpan: '1/2' },
    { id: 'description', defaultLabel: 'Description', section: 'HEADER', defaultSpan: 'full' },
    { id: 'reference', defaultLabel: 'Reference', section: 'HEADER', defaultSpan: '1/2' },
    { id: 'currency', defaultLabel: 'Currency', section: 'HEADER', defaultSpan: '1/4' },
    { id: 'exchangeRate', defaultLabel: 'Exchange Rate', section: 'HEADER', defaultSpan: '1/4' },
    { id: 'project', defaultLabel: 'Project', section: 'EXTRA', defaultSpan: '1/2' },
    { id: 'costCenter', defaultLabel: 'Cost Center', section: 'EXTRA', defaultSpan: '1/2' },
    { id: 'notes', defaultLabel: 'Internal Notes', section: 'FOOTER', defaultSpan: 'full' },
    { id: 'attachments', defaultLabel: 'Attachments', section: 'FOOTER', defaultSpan: 'full' },
];

export const StepFields: React.FC<Props> = ({ definition, updateDefinition }) => {
  const fields = definition.headerFields || [];
  const activeFieldIds = new Set(fields.map(f => f.id));

  const toggleField = (template: any) => {
    if (activeFieldIds.has(template.id)) {
        // Remove field
        updateDefinition({
            headerFields: fields.filter(f => f.id !== template.id)
        });
    } else {
        // Add field
        const newField: FieldDefinition = {
            id: template.id,
            name: template.id,
            label: template.defaultLabel,
            type: 'TEXT', // Default type, logic would be more complex in real app
            width: template.defaultSpan,
            required: false,
            readOnly: false
        };
        updateDefinition({
            headerFields: [...fields, newField]
        });
    }
  };

  return (
    <div className="space-y-6 p-4">
        <div className="border-b pb-4 mb-4 border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
                Field Selection
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                Choose which fields to include in this voucher type.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AVAILABLE_FIELDS.map(field => {
                const isSelected = activeFieldIds.has(field.id);
                return (
                    <div 
                        key={field.id}
                        onClick={() => toggleField(field)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                                ? 'border-indigo-600 bg-indigo-50'
                                : 'border-gray-200 hover:border-indigo-300'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">
                                {field.defaultLabel}
                            </span>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                isSelected 
                                    ? 'bg-indigo-600 border-indigo-600 text-white' 
                                    : 'border-gray-300'
                            }`}>
                                {isSelected && (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-100 rounded">
                                {field.section}
                            </span>
                            {field.id === 'date' || field.id === 'description' ? (
                                <span className="text-indigo-600 font-medium">Recommended</span>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Selected Fields Summary */}
        <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
                Selected Fields Configuration
            </h3>
            
            {fields.length === 0 ? (
                <p className="text-gray-500 italic">
                    No fields selected yet.
                </p>
            ) : (
                <div className="space-y-3">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                            <span className="font-medium text-gray-900">
                                {field.label}
                            </span>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={field.required}
                                        onChange={(e) => {
                                            const newFields = [...fields];
                                            newFields[index] = { ...field, required: e.target.checked };
                                            updateDefinition({ headerFields: newFields });
                                        }}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-gray-700">Required</span>
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};
