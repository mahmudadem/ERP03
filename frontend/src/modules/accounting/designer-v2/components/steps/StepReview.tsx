/**
 * StepReview.tsx
 * 
 * Final review step before saving configuration.
 * Shows summary of what will be saved.
 */

import React from 'react';
import { VoucherTypeCode, DisplayMode } from '../../types/VoucherLayoutV2';
import { FieldDefinitionV2 } from '../../types/FieldDefinitionV2';

interface Props {
  voucherType: VoucherTypeCode;
  fields: FieldDefinitionV2[];
  mode: DisplayMode;
}

const VOUCHER_TYPE_NAMES: Record<VoucherTypeCode, string> = {
  PAYMENT: 'Payment Voucher',
  RECEIPT: 'Receipt Voucher',
  JOURNAL_ENTRY: 'Journal Entry',
  OPENING_BALANCE: 'Opening Balance'
};

export const StepReview: React.FC<Props> = ({ voucherType, fields, mode }) => {
  const coreFields = fields.filter(f => f.category === 'CORE');
  const sharedFields = fields.filter(f => f.category === 'SHARED');
  const personalFields = fields.filter(f => f.category === 'PERSONAL');

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Review & Confirm
        </h2>
        <p className="text-lg text-gray-600">
          Review your customization before saving
        </p>
      </div>

      {/* Configuration Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Configuration Summary</h3>

        <div className="grid grid-cols-2 gap-6">
          {/* Voucher Type */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Voucher Type
            </label>
            <div className="text-xl font-bold text-indigo-600">
              {VOUCHER_TYPE_NAMES[voucherType]}
            </div>
          </div>

          {/* Display Mode */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Display Mode
            </label>
            <div className="text-xl font-bold text-gray-900 capitalize">
              {mode}
            </div>
          </div>

          {/* Total Fields */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Total Fields
            </label>
            <div className="text-xl font-bold text-gray-900">
              {fields.length} fields
            </div>
          </div>

          {/* Field Categories */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Field Breakdown
            </label>
            <div className="flex gap-4 text-sm">
              <span className="text-red-600 font-medium">{coreFields.length} CORE</span>
              <span className="text-blue-600 font-medium">{sharedFields.length} SHARED</span>
              <span className="text-purple-600 font-medium">{personalFields.length} PERSONAL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fields List */}
      <div className="bg-white border border-gray-200 rounded-xl p-8 mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Fields in Your Layout</h3>

        {/* CORE Fields */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-red-100 rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </span>
            CORE Fields ({coreFields.length})
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {coreFields.map(field => (
              <div key={field.id} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{field.label}</div>
                  <div className="text-xs text-gray-600">{field.type}</div>
                </div>
                <div className="text-xs text-gray-500">
                  {field.width === 'full' ? '4 cols' : field.width === '1/2' ? '2 cols' : '1 col'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SHARED Fields */}
        {sharedFields.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
              </span>
              SHARED Fields ({sharedFields.length})
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {sharedFields.map(field => (
                <div key={field.id} className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{field.label}</div>
                    <div className="text-xs text-gray-600">{field.type}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {field.width === 'full' ? '4 cols' : field.width === '1/2' ? '2 cols' : '1 col'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PERSONAL Fields */}
        {personalFields.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </span>
              PERSONAL Fields ({personalFields.length})
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {personalFields.map(field => (
                <div key={field.id} className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{field.label}</div>
                    <div className="text-xs text-gray-600">Private to you</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {field.width === 'full' ? '4 cols' : field.width === '1/2' ? '2 cols' : '1 col'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Important Notes */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-8">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-amber-900 mb-2">Important Notes</h4>
            <ul className="space-y-2 text-sm text-amber-800">
              <li className="flex gap-2">
                <span>•</span>
                <span>This configuration applies to <strong>your view only</strong> - it won't affect other users</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>CORE fields are required and will always appear (accounting rules)</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>SHARED fields you hide from your view still appear in the General Journal and reports</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>PERSONAL fields are private and never appear in journals or reports</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Reassurance Box */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-green-900 mb-2">You Can Modify This Later</h4>
            <p className="text-sm text-green-800">
              This isn't permanent! You can come back to the designer anytime to adjust field order, 
              styling, visibility, or add new personal fields. The underlying accounting data remains unchanged.
            </p>
          </div>
        </div>
      </div>

      {/* Save Instruction */}
      <div className="mt-8 text-center">
        <p className="text-gray-600 mb-2">
          Click <strong>"Save & Activate"</strong> to apply this configuration
        </p>
        <p className="text-sm text-gray-500">
          Or click "Previous" to make changes
        </p>
      </div>
    </div>
  );
};
