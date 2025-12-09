import React, { useState } from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';
import { Button } from '../../../../../components/ui/Button';

interface CustomField {
    key: string;
    type: 'text' | 'number' | 'date' | 'file' | 'dropdown';
    label: string;
    options?: string[]; // For dropdown
}

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
}

export const StepCustomFields: React.FC<Props> = ({ definition, updateDefinition }) => {
  const customFields: CustomField[] = definition.customFields || [];
  const [isAdding, setIsAdding] = useState(false);
  const [newField, setNewField] = useState<CustomField>({ key: '', type: 'text', label: '' });

  const handleAdd = () => {
    if (!newField.key || !newField.label) return;
    
    // Auto-clean key
    const cleanKey = newField.key.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    updateDefinition({
        customFields: [...customFields, { ...newField, key: cleanKey }]
    });
    setNewField({ key: '', type: 'text', label: '' });
    setIsAdding(false);
  };

  const removeField = (index: number) => {
    const newFields = [...customFields];
    newFields.splice(index, 1);
    updateDefinition({ customFields: newFields });
  };

  return (
    <div className="space-y-6 p-4">
        <div className="border-b pb-4 mb-4 border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
                Custom Fields
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                Add extra fields for information only. These fields do not affect accounting ledgers.
            </p>
        </div>

        {/* List of Custom Fields */}
        <div className="space-y-3 mb-6">
            {customFields.map((field, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                            {field.type.substr(0, 3)}
                        </div>
                        <div>
                            <h4 className="font-medium text-gray-900">{field.label}</h4>
                            <code className="text-xs text-gray-500 bg-gray-100 px-1 rounded">
                                {field.key}
                            </code>
                        </div>
                    </div>
                    <button 
                        onClick={() => removeField(idx)}
                        className="text-red-400 hover:text-red-600 p-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            ))}
            
            {customFields.length === 0 && !isAdding && (
                <div className="text-center py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg text-gray-500">
                    No custom fields added yet.
                </div>
            )}
        </div>

        {/* Add Form */}
        {isAdding ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                <h4 className="font-medium text-gray-900">New Custom Field</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded p-2 text-sm"
                            placeholder="e.g. Bank Reference"
                            value={newField.label}
                            onChange={e => setNewField({...newField, label: e.target.value, key: e.target.value.toLowerCase().replace(/ /g, '_')})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Key (Internal ID)</label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded p-2 text-sm bg-gray-100"
                            placeholder="e.g. bank_ref"
                            value={newField.key}
                            onChange={e => setNewField({...newField, key: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                        <select 
                            className="w-full border border-gray-300 rounded p-2 text-sm"
                            value={newField.type}
                            onChange={e => setNewField({...newField, type: e.target.value as any})}
                        >
                            <option value="text">Text Input</option>
                            <option value="number">Number Input</option>
                            <option value="date">Date Picker</option>
                            <option value="file">File Attachment</option>
                            <option value="dropdown">Dropdown Selection</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-2 justify-end mt-2">
                    <Button variant="secondary" onClick={() => setIsAdding(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleAdd}>Add Field</Button>
                </div>
            </div>
        ) : (
            <Button variant="secondary" className="w-full border-dashed" onClick={() => setIsAdding(true)}>
                + Add Custom Field
            </Button>
        )}
    </div>
  );
};
