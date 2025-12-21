import React, { useEffect, useState } from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
  existingVouchers: VoucherTypeDefinition[];
  onValidationChange: (isValid: boolean) => void;
  initialCode?: string;
}

export const StepBasicInfo: React.FC<Props> = ({
  definition,
  updateDefinition,
  existingVouchers,
  onValidationChange,
  initialCode
}) => {
  const [nameError, setNameError] = useState<string>('');

  useEffect(() => {
    const hasErrors = !!nameError || !definition.name;
    onValidationChange(!hasErrors);
  }, [nameError, definition.name, onValidationChange]);

  const validateName = (name: string) => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }

    const exists = existingVouchers.some(
      v => v.name.toLowerCase() === name.toLowerCase() && v.code !== initialCode
    );

    if (exists) {
      setNameError('A voucher type with this name already exists');
      return;
    }

    setNameError('');
  };

  const handleNameChange = (name: string) => {
    updateDefinition({ name });
    validateName(name);
  };

  return (
    <div className="space-y-6 p-4">
      <div className="border-b pb-4 mb-4 border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Basic Information
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure the identity of this <strong>{definition.code}</strong> voucher.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Name Field */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Display Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={definition.name || ''}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={(e) => validateName(e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 ${
              nameError ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g. Payment Voucher"
          />
          {nameError && (
            <p className="text-red-500 text-xs mt-1">{nameError}</p>
          )}
        </div>

        {/* Code Display (Read-only) */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Voucher Code (System Assigned)
          </label>
          <input
            type="text"
            value={definition.code || ''}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500"
          />
        </div>

        {/* Module Display (Read-only) */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Module
          </label>
          <input
            type="text"
            value={definition.module || 'ACCOUNTING'}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500"
          />
        </div>

        {/* Schema Version Display */}
        <div className="col-span-1 md:col-span-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Schema V2:</strong> All fields must be properly classified with posting roles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
