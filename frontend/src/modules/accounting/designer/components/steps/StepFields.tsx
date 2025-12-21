/**
 * StepFields - Field Selection with Categories
 * Shows CORE (mandatory), SHARED (optional), SYSTEM (optional)
 */

import React, { useState, useEffect } from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';
import { FieldDefinition } from '../../types/FieldTypes';
import { getCoreFieldsByVoucherType } from '../../registries/coreFields';
import { getSharedFields } from '../../registries/sharedFields';
import { getSystemFields } from '../../registries/systemFields';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
}

export const StepFields: React.FC<Props> = ({ definition, updateDefinition }) => {
  const [coreFields, setCoreFields] = useState<FieldDefinition[]>([]);
  const [sharedFields, setSharedFields] = useState<FieldDefinition[]>([]);
  const [systemFields, setSystemFields] = useState<FieldDefinition[]>([]);
  const [selectedSharedIds, setSelectedSharedIds] = useState<string[]>([]);
  const [selectedSystemIds, setSelectedSystemIds] = useState<string[]>([]);

  useEffect(() => {
    if (definition.code) {
      const core = getCoreFieldsByVoucherType(definition.code);
      setCoreFields(core);
      setSharedFields(getSharedFields());
      setSystemFields(getSystemFields());
      
      // Initialize with CORE fields
      updateDefinition({
        headerFields: core as any[]
      });
    }
  }, [definition.code]);

  const handleSharedToggle = (fieldId: string) => {
    const newSelected = selectedSharedIds.includes(fieldId)
      ? selectedSharedIds.filter(id => id !== fieldId)
      : [...selectedSharedIds, fieldId];
    
    setSelectedSharedIds(newSelected);
    
    // Update header fields with CORE + selected SHARED (preserve systemFields)
    const selectedShared = sharedFields.filter(f => newSelected.includes(f.id));
    updateDefinition({
      headerFields: [...coreFields, ...selectedShared] as any[],
      systemFields: (definition as any).systemFields // Preserve existing systemFields
    });
  };

  const handleSystemToggle = (fieldId: string) => {
    const newSelected = selectedSystemIds.includes(fieldId)
      ? selectedSystemIds.filter(id => id !== fieldId)
      : [...selectedSystemIds, fieldId];
    
    setSelectedSystemIds(newSelected);
    updateDefinition({
      systemFields: newSelected as any,
      headerFields: definition.headerFields // Preserve existing headerFields
    });
  };

  return (
    <div className="p-4 space-y-6">
      <div className="border-b pb-4 border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Field Selection</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select fields for <strong>{definition.code}</strong> voucher type
        </p>
      </div>

      {/* CORE Fields */}
      <div className="border border-gray-200 rounded p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">CORE</span>
          <h3 className="text-sm font-bold text-gray-900">Mandatory Fields</h3>
        </div>
        <div className="space-y-2">
          {coreFields.map(field => (
            <label key={field.id} className="flex items-center gap-2 text-sm text-gray-600">
              <input 
                type="checkbox" 
                checked={true} 
                disabled 
                className="rounded border-gray-300 text-red-600"
              />
              <span>{field.label}</span>
              {field.required && <span className="text-red-500">*</span>}
            </label>
          ))}
        </div>
      </div>

      {/* SHARED Fields */}
      <div className="border border-gray-200 rounded p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">SHARED</span>
          <h3 className="text-sm font-bold text-gray-900">Optional Fields</h3>
        </div>
        <div className="space-y-2">
          {sharedFields.map(field => (
            <label key={field.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input 
                type="checkbox" 
                checked={selectedSharedIds.includes(field.id)}
                onChange={() => handleSharedToggle(field.id)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span>{field.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* SYSTEM Fields */}
      <div className="border border-gray-200 rounded p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-bold rounded">SYSTEM</span>
          <h3 className="text-sm font-bold text-gray-900">System Metadata (Read-only)</h3>
        </div>
        <div className="space-y-2">
          {systemFields.map(field => (
            <label key={field.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input 
                type="checkbox" 
                checked={selectedSystemIds.includes(field.id)}
                onChange={() => handleSystemToggle(field.id)}
                className="rounded border-gray-300 text-gray-600"
              />
              <span>{field.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded border border-gray-200">
        <strong>Selection Summary:</strong>
        <ul className="mt-2 space-y-1">
          <li>• CORE fields: {coreFields.length} (mandatory)</li>
          <li>• SHARED fields: {selectedSharedIds.length} selected</li>
          <li>• SYSTEM fields: {selectedSystemIds.length} selected</li>
        </ul>
      </div>
    </div>
  );
};
