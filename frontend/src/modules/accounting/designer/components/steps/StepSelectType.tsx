import React from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
  onCodeSelected?: (code: string) => void;
}

// Hardcoded factory types for now, as backend endpoint might not be ready.
// In real implementation, this should come from voucherTypeRepository.getAvailableTypes()
const AVAILABLE_TYPES = [
    { code: 'JV', name: 'Journal Voucher', mode: 'multi-line' },
    { code: 'PV', name: 'Payment Voucher', mode: 'single-line' },
    { code: 'RV', name: 'Receipt Voucher', mode: 'single-line' },
    { code: 'SI', name: 'Sales Invoice', mode: 'multi-line' },
    { code: 'PI', name: 'Purchase Invoice', mode: 'multi-line' },
    { code: 'CN', name: 'Credit Note', mode: 'multi-line' },
    { code: 'DN', name: 'Debit Note', mode: 'multi-line' }
];

export const StepSelectType: React.FC<Props> = ({ definition, updateDefinition, onCodeSelected }) => {
  const handleSelect = (type: typeof AVAILABLE_TYPES[0]) => {
      updateDefinition({
          code: type.code,
          name: type.name,
          mode: type.mode as any,
      });
      if (onCodeSelected) onCodeSelected(type.code);
  };

  return (
    <div className="space-y-6 p-4">
        <div className="border-b pb-4 mb-4 border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
                Select Voucher Type
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                Choose a supported voucher type from the system factory. You cannot create new types, only configure existing ones.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AVAILABLE_TYPES.map(type => {
                const isSelected = definition.code === type.code;
                return (
                    <button
                        key={type.code}
                        onClick={() => handleSelect(type)}
                        className={`
                            relative flex flex-col items-start p-4 rounded-xl border-2 transition-all
                            ${isSelected 
                                ? 'border-indigo-600 bg-indigo-50 shadow-md ring-1 ring-indigo-600' 
                                : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                            }
                        `}
                    >
                        <div className="flex justify-between w-full mb-2">
                            <span className={`
                                px-2 py-1 text-xs font-bold rounded
                                ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}
                            `}>
                                {type.code}
                            </span>
                            {isSelected && (
                                <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" transform="rotate(45 10 10)" />
                                </svg>
                            )}
                        </div>
                        <h3 className={`font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                            {type.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 capitalize">
                            {type.mode.replace('-', ' ')}
                        </p>
                    </button>
                );
            })}
        </div>
    </div>
  );
};
