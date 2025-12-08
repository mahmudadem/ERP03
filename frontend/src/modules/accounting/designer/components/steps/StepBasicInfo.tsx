import React from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
  initialCode?: string;
}

export const StepBasicInfo: React.FC<Props> = ({ definition, updateDefinition, initialCode }) => {
  const metadata = definition.metadata || {};

  const updateMetadata = (updates: any) => {
    updateDefinition({
        metadata: { ...metadata, ...updates }
    });
  };

  return (
    <div className="space-y-6 p-4">
        <div className="border-b pb-4 mb-4 border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
                Basic Information
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                Define the identity and behavior of this voucher type.
            </p>
        </div>

        {/* Mode Selection */}
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <label className="block text-sm font-medium mb-2 text-indigo-900">
                Voucher Mode
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    type="button"
                    onClick={() => updateMetadata({ mode: 'singleLine' })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                        metadata.mode === 'singleLine'
                            ? 'border-indigo-600 bg-white shadow-md'
                            : 'border-transparent bg-white/50 hover:bg-white'
                    }`}
                >
                    <div className="font-semibold text-gray-900 mb-1">
                        Single-line Mode
                    </div>
                    <p className="text-xs text-gray-500">
                        Simple form for payments and receipts. Fixed debit/credit accounts.
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() => updateMetadata({ mode: 'multiLine' })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                        metadata.mode === 'multiLine' || !metadata.mode // Default to multiLine
                            ? 'border-indigo-600 bg-white shadow-md'
                            : 'border-transparent bg-white/50 hover:bg-white'
                    }`}
                >
                    <div className="font-semibold text-gray-900 mb-1">
                        Multi-line Mode
                    </div>
                    <p className="text-xs text-gray-500">
                        Full journal entry table with multiple debit/credit lines.
                    </p>
                </button>
            </div>
        </div>

        {/* Identity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-1 md:col-span-3">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    Category <span className="text-red-500">*</span>
                </label>
                <select
                    value={definition.category || 'Financial'}
                    onChange={(e) => updateDefinition({ category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="Financial">Financial</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Sales">Sales</option>
                    <option value="Purchase">Purchase</option>
                    <option value="Custom">Custom</option>
                </select>
            </div>

            <div className="col-span-1 md:col-span-3">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    Name <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={definition.name || ''}
                    onChange={(e) => updateDefinition({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Journal Entry"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    Code <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={definition.code || ''}
                    onChange={(e) => updateDefinition({ code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. JE-001"
                    disabled={!!initialCode}
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    Abbreviation <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={metadata.abbreviation || ''}
                    onChange={(e) => updateMetadata({ abbreviation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    maxLength={5}
                    placeholder="e.g. JE"
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    Color
                </label>
                <div className="flex gap-2">
                    <input
                        type="color"
                        value={metadata.color || '#3B82F6'}
                        onChange={(e) => updateMetadata({ color: e.target.value })}
                        className="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
                    />
                    <div 
                        className="flex-1 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm"
                        style={{ backgroundColor: metadata.color || '#3B82F6' }}
                    >
                        {metadata.abbreviation || 'AB'}
                    </div>
                </div>
            </div>
        </div>

        {/* Status */}
        <div className="pt-4 border-t border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={definition.status === 'ACTIVE'}
                        onChange={(e) => updateDefinition({ status: e.target.checked ? 'ACTIVE' : 'DRAFT' })}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                <span className="text-sm font-medium text-gray-900">
                    Active Status
                </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-14">
                If disabled, this voucher type will not be available for creating new vouchers.
            </p>
        </div>
    </div>
  );
};
