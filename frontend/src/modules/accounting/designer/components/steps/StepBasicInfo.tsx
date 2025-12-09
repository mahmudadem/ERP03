import React from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
  initialCode?: string;
}

export const StepBasicInfo: React.FC<Props> = ({ definition, updateDefinition, initialCode }) => {
  return (
    <div className="space-y-6 p-4">
        <div className="border-b pb-4 mb-4 border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
                Basic Information
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                Customize the identity of this <strong>{definition.code}</strong> voucher.
            </p>
        </div>

        {/* Identity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    Display Name <span className="text-red-500">*</span>
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
                    Voucher Code (Locked)
                </label>
                <input
                    type="text"
                    value={definition.code || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500"
                />
            </div>

            <div>
                 <label className="block text-sm font-medium mb-2 text-gray-700">
                    Mode (Locked)
                </label>
                <input
                    type="text"
                    value={definition.mode === 'multi-line' ? 'Multi-Line (Journal)' : 'Single-Line (Simple)'}
                    disabled
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    Abbreviation <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={definition.abbreviation || ''}
                    onChange={(e) => updateDefinition({ abbreviation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500"
                    maxLength={5}
                    placeholder="e.g. JE"
                />
            </div>
            
            <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                    Color Theme
                </label>
                <div className="flex gap-2">
                    <input
                        type="color"
                        value={definition.color || '#3B82F6'}
                        onChange={(e) => updateDefinition({ color: e.target.value })}
                        className="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
                    />
                    <div 
                        className="flex-1 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm"
                        style={{ backgroundColor: definition.color || '#3B82F6' }}
                    >
                        {definition.abbreviation || 'AB'}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
