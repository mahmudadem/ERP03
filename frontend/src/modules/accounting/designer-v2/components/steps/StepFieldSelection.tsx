/**
 * StepFieldSelection.tsx
 * 
 * Second step: Select which fields to include.
 * Shows CORE (locked), SHARED (toggle), and PERSONAL (add/remove) fields.
 */

import React, { useState } from 'react';
import { VoucherTypeCode } from '../../types/VoucherLayoutV2';
import { FieldDefinitionV2, createPersonalField } from '../../types/FieldDefinitionV2';
import { getCoreFields, getSharedFields } from '../../registries';

interface Props {
  voucherType: VoucherTypeCode;
  selectedFieldIds: string[];
  personalFields: FieldDefinitionV2[];
  onFieldsChange: (fieldIds: string[], personalFields: FieldDefinitionV2[]) => void;
}

export const StepFieldSelection: React.FC<Props> = ({
  voucherType,
  selectedFieldIds,
  personalFields,
  onFieldsChange
}) => {
  const [newPersonalFieldName, setNewPersonalFieldName] = useState('');

  const coreFields = getCoreFields(voucherType);
  const sharedFields = getSharedFields(voucherType);

  const toggleSharedField = (fieldId: string) => {
    const isSelected = selectedFieldIds.includes(fieldId);
    
    if (isSelected) {
      // Remove from selection
      onFieldsChange(
        selectedFieldIds.filter(id => id !== fieldId),
        personalFields
      );
    } else {
      // Add to selection
      onFieldsChange(
        [...selectedFieldIds, fieldId],
        personalFields
      );
    }
  };

  const addPersonalField = () => {
    if (!newPersonalFieldName.trim()) return;

    const newField = createPersonalField({
      id: `personal_${Date.now()}`,
      label: newPersonalFieldName,
      type: 'TEXT',
      width: 'full'
    });

    onFieldsChange(
      [...selectedFieldIds, newField.id],
      [...personalFields, newField]
    );

    setNewPersonalFieldName('');
  };

  const removePersonalField = (fieldId: string) => {
    onFieldsChange(
      selectedFieldIds.filter(id => id !== fieldId),
      personalFields.filter(f => f.id !== fieldId)
    );
  };

  return (
    <div className="max-w-5xl mx-auto py-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Select Fields
        </h2>
        <p className="text-gray-600">
          Choose which fields to display in your voucher form
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CORE FIELDS (Required - Cannot Remove) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              🔒 Core Fields ({coreFields.length})
            </h3>
            <p className="text-sm text-gray-600">
              Required by accounting system - Cannot be removed or hidden
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coreFields.map(field => (
            <div
              key={field.id}
              className="p-4 bg-red-50 border-2 border-red-200 rounded-lg"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{field.label}</h4>
                  <p className="text-xs text-gray-600 mt-1">{field.semanticMeaning}</p>
                </div>
                <div className="flex-shrink-0 ml-2">
                  <div className="w-6 h-6 bg-red-200 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-700" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs px-2 py-0.5 bg-red-200 text-red-800 rounded font-medium">
                  CORE
                </span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {field.type}
                </span>
                {field.required && (
                  <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                    Required
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SHARED FIELDS (Optional - Can Show/Hide) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              🔗 Shared Fields ({sharedFields.length})
            </h3>
            <p className="text-sm text-gray-600">
              Optional, system-defined - Toggle to show/hide from your view
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sharedFields.map(field => {
            const isSelected = selectedFieldIds.includes(field.id);
            
            return (
              <button
                key={field.id}
                onClick={() => toggleSharedField(field.id)}
                className={`
                  p-4 rounded-lg border-2 text-left transition-all duration-200
                  ${isSelected 
                    ? 'bg-blue-50 border-blue-400 shadow-sm' 
                    : 'bg-white border-gray-200 hover:border-blue-300'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{field.label}</h4>
                    <p className="text-xs text-gray-600 mt-1">{field.semanticMeaning}</p>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected 
                        ? 'bg-blue-600 border-blue-600' 
                        : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                    SHARED
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {field.type}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PERSONAL FIELDS (User-Specific - Can Add/Remove) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              👤 Personal Fields ({personalFields.length})
            </h3>
            <p className="text-sm text-gray-600">
              Your private notes - Not visible to others or in reports
            </p>
          </div>
        </div>

        {/* Add Personal Field */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={newPersonalFieldName}
            onChange={(e) => setNewPersonalFieldName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addPersonalField()}
            placeholder="Enter field name (e.g., 'My Notes', 'Reminder')"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <button
            onClick={addPersonalField}
            disabled={!newPersonalFieldName.trim()}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
          >
            + Add Field
          </button>
        </div>

        {/* Personal Fields List */}
        {personalFields.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personalFields.map(field => (
              <div
                key={field.id}
                className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{field.label}</h4>
                    <p className="text-xs text-gray-600 mt-1">Private to you only</p>
                  </div>
                  <button
                    onClick={() => removePersonalField(field.id)}
                    className="flex-shrink-0 ml-2 p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                    title="Remove field"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded font-medium">
                    PERSONAL
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {field.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-gray-500">No personal fields added yet</p>
            <p className="text-sm text-gray-400 mt-1">Add fields for your private notes and reminders</p>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-10 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-bold text-gray-900 mb-3">Field Selection Summary</h4>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-2xl font-bold text-red-600">{coreFields.length}</div>
            <div className="text-sm text-gray-600">Core (required)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {sharedFields.filter(f => selectedFieldIds.includes(f.id)).length} / {sharedFields.length}
            </div>
            <div className="text-sm text-gray-600">Shared (selected)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{personalFields.length}</div>
            <div className="text-sm text-gray-600">Personal (private)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
