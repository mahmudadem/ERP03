/**
 * StepSelectType.tsx
 * 
 * First step: Select which voucher type to design.
 * Simplified version focused on the 4 ADR-005 voucher types.
 */

import React from 'react';
import { VoucherTypeCode } from '../../types/VoucherLayoutV2';

interface Props {
  selectedType?: VoucherTypeCode;
  onSelect: (type: VoucherTypeCode) => void;
}

interface VoucherTypeOption {
  code: VoucherTypeCode;
  name: string;
  description: string;
  icon: string;
  color: string;
  example: string;
}

const VOUCHER_TYPES: VoucherTypeOption[] = [
  {
    code: 'PAYMENT',
    name: 'Payment Voucher',
    description: 'Record payments for bills, expenses, and purchases',
    icon: '💸',
    color: 'red',
    example: 'Pay rent, utilities, supplier invoices'
  },
  {
    code: 'RECEIPT',
    name: 'Receipt Voucher',
    description: 'Record receipts from customers and income',
    icon: '💰',
    color: 'green',
    example: 'Customer payments, sales receipts'
  },
  {
    code: 'JOURNAL_ENTRY',
    name: 'Journal Entry',
    description: 'Manual accounting adjustments and corrections',
    icon: '📝',
    color: 'blue',
    example: 'Depreciation, accruals, reclassifications'
  },
  {
    code: 'OPENING_BALANCE',
    name: 'Opening Balance',
    description: 'Initialize system with starting account balances',
    icon: '🎯',
    color: 'purple',
    example: 'Migrate from old system, set initial balances'
  }
];

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    hover: 'hover:border-red-400'
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    hover: 'hover:border-green-400'
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    hover: 'hover:border-blue-400'
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    hover: 'hover:border-purple-400'
  }
};

export const StepSelectType: React.FC<Props> = ({ selectedType, onSelect }) => {
  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Select Voucher Type
        </h2>
        <p className="text-lg text-gray-600">
          Choose which type of voucher you want to customize
        </p>
      </div>

      {/* Voucher Type Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {VOUCHER_TYPES.map((type) => {
          const isSelected = selectedType === type.code;
          const colors = COLOR_CLASSES[type.color];

          return (
            <button
              key={type.code}
              onClick={() => onSelect(type.code)}
              className={`
                relative p-6 rounded-xl border-2 text-left transition-all duration-200
                ${isSelected 
                  ? `${colors.border} ${colors.bg} shadow-lg ring-2 ring-offset-2 ${colors.border.replace('border-', 'ring-')}`
                  : `border-gray-200 bg-white hover:shadow-md ${colors.hover}`
                }
              `}
            >
              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <div className={`w-6 h-6 rounded-full ${colors.bg} ${colors.border} border-2 flex items-center justify-center`}>
                    <svg className={`w-4 h-4 ${colors.text}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Icon & Title */}
              <div className="flex items-start gap-4 mb-4">
                <div className="text-4xl">{type.icon}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {type.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {type.description}
                  </p>
                </div>
              </div>

              {/* Example */}
              <div className={`mt-4 pt-4 border-t ${colors.border}`}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Example Use Cases
                </p>
                <p className={`text-sm ${colors.text} font-medium`}>
                  {type.example}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-bold text-blue-900 mb-1">
              What you're customizing
            </h4>
            <p className="text-sm text-blue-800">
              You're customizing how <strong>you</strong> see and use this voucher type. 
              Your changes won't affect other users. The underlying accounting logic remains unchanged.
            </p>
          </div>
        </div>
      </div>

      {/* Selection Indicator */}
      {selectedType && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Selected: <span className="font-bold text-gray-900">
              {VOUCHER_TYPES.find(t => t.code === selectedType)?.name}
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Click "Next" to continue
          </p>
        </div>
      )}
    </div>
  );
};
