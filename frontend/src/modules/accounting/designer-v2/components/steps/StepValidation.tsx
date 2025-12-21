/**
 * StepValidation.tsx
 * 
 * Auto-validates the layout configuration.
 * Shows any blocking errors that must be fixed.
 */

import React from 'react';
import { VoucherTypeCode } from '../../types/VoucherLayoutV2';
import { FieldDefinitionV2 } from '../../types/FieldDefinitionV2';
import { getCoreFields } from '../../registries';

interface Props {
  voucherType: VoucherTypeCode;
  fields: FieldDefinitionV2[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: {
    coreFieldsCount: number;
    sharedFieldsCount: number;
    personalFieldsCount: number;
    totalFieldsCount: number;
  };
}

export const StepValidation: React.FC<Props> = ({ voucherType, fields }) => {
  // Validate layout
  const validate = (): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const coreFields = getCoreFields(voucherType);

    // Check 1: All CORE fields must be present
    for (const coreField of coreFields) {
      const field = fields.find(f => f.id === coreField.id);
      if (!field) {
        errors.push(`Missing CORE field: ${coreField.label}`);
      }
    }

    // Check 2: No CORE fields can be hidden
    for (const field of fields.filter(f => f.category === 'CORE')) {
      if (field.hidden === true) {
        errors.push(`CORE field "${field.label}" cannot be hidden`);
      }
    }

    // Check 3: All fields must have labels
    for (const field of fields) {
      if (!field.label || field.label.trim() === '') {
        warnings.push(`Field "${field.id}" is missing a label`);
      }
    }

    // Count fields by category
    const coreFieldsCount = fields.filter(f => f.category === 'CORE').length;
    const sharedFieldsCount = fields.filter(f => f.category === 'SHARED').length;
    const personalFieldsCount = fields.filter(f => f.category === 'PERSONAL').length;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info: {
        coreFieldsCount,
        sharedFieldsCount,
        personalFieldsCount,
        totalFieldsCount: fields.length
      }
    };
  };

  const result = validate();

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
          result.valid ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {result.valid ? (
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {result.valid ? 'Validation Passed!' : 'Validation Failed'}
        </h2>
        <p className="text-gray-600">
          {result.valid 
            ? 'Your layout configuration is valid and ready to save' 
            : 'Please fix the errors below before proceeding'
          }
        </p>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-bold text-red-900 mb-1">
                {result.errors.length} Error{result.errors.length !== 1 ? 's' : ''} Found
              </h3>
              <p className="text-sm text-red-700">
                These must be fixed before you can save
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {result.errors.map((error, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-red-800">
                <span className="font-bold">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="mb-6 bg-amber-50 border-2 border-amber-200 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <svg className="w-6 h-6 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-bold text-amber-900 mb-1">
                {result.warnings.length} Warning{result.warnings.length !== 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-amber-700">
                These won't block saving but should be reviewed
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {result.warnings.map((warning, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="font-bold">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success Summary */}
      {result.valid && (
        <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-bold text-green-900 mb-1">All Checks Passed</h3>
              <p className="text-sm text-green-700">
                Your layout meets all requirements and can be saved
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Field Breakdown */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-bold text-gray-900 mb-4">Field Breakdown</h3>
        
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="text-3xl font-bold text-red-600 mb-1">
              {result.info.coreFieldsCount}
            </div>
            <div className="text-sm text-gray-600">CORE Fields</div>
            <div className="text-xs text-gray-500 mt-1">(Required)</div>
          </div>

          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {result.info.sharedFieldsCount}
            </div>
            <div className="text-sm text-gray-600">SHARED Fields</div>
            <div className="text-xs text-gray-500 mt-1">(Optional)</div>
          </div>

          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {result.info.personalFieldsCount}
            </div>
            <div className="text-sm text-gray-600">PERSONAL Fields</div>
            <div className="text-xs text-gray-500 mt-1">(Private)</div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 text-center">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {result.info.totalFieldsCount}
          </div>
          <div className="text-sm text-gray-600">Total Fields in Layout</div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-bold text-blue-900 mb-1">What Happens Next?</h4>
            <p className="text-sm text-blue-800">
              {result.valid 
                ? "Click 'Next' to review your configuration and save. Your layout will be applied to your voucher views only - it won't affect other users or the General Journal."
                : "Go back and fix the errors, then return here. The layout must pass validation before it can be saved."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
