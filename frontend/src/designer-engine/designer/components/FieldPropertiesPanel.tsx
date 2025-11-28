
import React from 'react';
import { FieldDefinition } from '../../types/FieldDefinition';
import { Button } from '../../../components/ui/Button';

interface Props {
  field: FieldDefinition | null;
  onChange: (updates: Partial<FieldDefinition>) => void;
  onDelete: () => void;
}

export const FieldPropertiesPanel: React.FC<Props> = ({ field, onChange, onDelete }) => {
  if (!field) {
    return (
      <div className="p-6 text-center h-full flex flex-col items-center justify-center text-gray-400">
        <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <p className="text-sm">Select a field on the canvas to edit its properties.</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <h3 className="font-bold text-xs uppercase text-gray-500 mb-6 tracking-wider border-b pb-2">
        Field Properties
      </h3>

      <div className="space-y-4 flex-1 overflow-y-auto pr-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Field ID</label>
          <input 
            className="w-full bg-gray-100 border rounded px-2 py-1 text-xs font-mono text-gray-500"
            value={field.id}
            readOnly
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Label</label>
          <input 
            className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={field.label}
            onChange={e => onChange({ label: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Data Key (Name)</label>
          <input 
            className="w-full border rounded px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            value={field.name}
            onChange={e => onChange({ name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Placeholder</label>
          <input 
            className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={field.placeholder || ''}
            onChange={e => onChange({ placeholder: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
             <label className="block text-xs font-medium text-gray-700 mb-1">Width</label>
             <select 
               className="w-full border rounded px-2 py-1 text-sm"
               value={field.width || 'full'}
               onChange={e => onChange({ width: e.target.value as any })}
             >
               <option value="full">100%</option>
               <option value="1/2">50%</option>
               <option value="1/3">33%</option>
               <option value="1/4">25%</option>
             </select>
          </div>
          <div>
             <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
             <div className="px-2 py-1 text-sm bg-gray-100 rounded border text-gray-500">
               {field.type}
             </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={field.required} 
              onChange={e => onChange({ required: e.target.checked })}
              className="rounded text-blue-600"
            />
            <span className="text-sm text-gray-700">Required Field</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={field.readOnly} 
              onChange={e => onChange({ readOnly: e.target.checked })}
              className="rounded text-blue-600"
            />
            <span className="text-sm text-gray-700">Read Only</span>
          </label>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <Button variant="danger" size="sm" className="w-full" onClick={onDelete}>
          Delete Field
        </Button>
      </div>
    </div>
  );
};
