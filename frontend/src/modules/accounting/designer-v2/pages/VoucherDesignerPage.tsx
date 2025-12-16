/**
 * VoucherDesignerPage.tsx
 * 
 * Main page for voucher designer.
 * Entry point that shows list of voucher types and opens wizard.
 */

import React, { useState } from 'react';
import { VoucherWizard } from '../components/VoucherWizard';
import { VoucherTypeCode } from '../types/VoucherLayoutV2';

interface VoucherTypeCard {
  code: VoucherTypeCode;
  name: string;
  description: string;
  icon: string;
  color: string;
  hasCustomLayout: boolean;
}

const VOUCHER_TYPES: VoucherTypeCard[] = [
  {
    code: 'PAYMENT',
    name: 'Payment Voucher',
    description: 'Customize how you record payments',
    icon: '💸',
    color: 'red',
    hasCustomLayout: false
  },
  {
    code: 'RECEIPT',
    name: 'Receipt Voucher',
    description: 'Customize how you record receipts',
    icon: '💰',
    color: 'green',
    hasCustomLayout: false
  },
  {
    code: 'JOURNAL_ENTRY',
    name: 'Journal Entry',
    description: 'Customize manual journal entries',
    icon: '📝',
    color: 'blue',
    hasCustomLayout: false
  },
  {
    code: 'OPENING_BALANCE',
    name: 'Opening Balance',
    description: 'Customize opening balance setup',
    icon: '🎯',
    color: 'purple',
    hasCustomLayout: false
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

export const VoucherDesignerPage: React.FC = () => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<VoucherTypeCode | null>(null);

  const handleOpenDesigner = (type?: VoucherTypeCode) => {
    setSelectedType(type || null);
    setIsWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
    setSelectedType(null);
  };

  const handleSave = () => {
    // Refresh list or show success message
    console.log('Layout saved successfully!');
  };

  if (isWizardOpen) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="w-full max-w-6xl h-[90vh]">
          <VoucherWizard onClose={handleCloseWizard} onSave={handleSave} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Voucher Designer
        </h1>
        <p className="text-lg text-gray-600">
          Customize how you see and work with vouchers
        </p>
      </div>

      {/* Info Box */}
      <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-blue-900 mb-2">Personal Customization</h3>
            <p className="text-sm text-blue-800 mb-2">
              The voucher designer lets you customize how <strong>you</strong> see and use each voucher type. 
              Your changes are personal and won't affect other users.
            </p>
            <ul className="text-sm text-blue-700 space-y-1 ml-4">
              <li>• Choose which optional fields to show or hide</li>
              <li>• Rearrange fields in an order that works for you</li>
              <li>• Add private notes and reminders (not visible to others)</li>
              <li>• Customize styling, colors, and layout</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Voucher Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {VOUCHER_TYPES.map((type) => {
          const colors = COLOR_CLASSES[type.color];

          return (
            <div
              key={type.code}
              className={`
                relative p-6 rounded-xl border-2 bg-white transition-all duration-200
                ${colors.border} ${colors.hover} hover:shadow-lg
              `}
            >
              {/* Custom Layout Badge */}
              {type.hasCustomLayout && (
                <div className="absolute top-4 right-4">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">
                    CUSTOMIZED
                  </span>
                </div>
              )}

              {/* Icon & Title */}
              <div className="flex items-start gap-4 mb-4">
                <div className="text-5xl">{type.icon}</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {type.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {type.description}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => handleOpenDesigner(type.code)}
                  className={`
                    flex-1 px-4 py-2 rounded-lg font-medium transition-colors
                    ${type.hasCustomLayout
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : `${colors.bg} ${colors.text} hover:${colors.bg.replace('50', '100')}`
                    }
                  `}
                >
                  {type.hasCustomLayout ? 'Edit Layout' : 'Customize'}
                </button>
                
                {type.hasCustomLayout && (
                  <button
                    onClick={() => {
                      if (confirm('Reset to default layout?')) {
                        console.log('Reset layout for', type.code);
                      }
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-10 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleOpenDesigner()}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            + Create New Layout
          </button>
          <button
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            📥 Import Layout
          </button>
          <button
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            📤 Export Layouts
          </button>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-indigo-900 mb-2">Need Help?</h4>
            <p className="text-sm text-indigo-800 mb-3">
              The voucher designer is powerful but easy to use. Watch our tutorial or read the guide to get started.
            </p>
            <div className="flex gap-3">
              <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                📺 Watch Tutorial
              </button>
              <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                📖 Read Guide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoucherDesignerPage;
