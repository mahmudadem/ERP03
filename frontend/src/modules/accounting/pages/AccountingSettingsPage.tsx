import React, { useState } from 'react';
import { Settings, DollarSign, Calendar, FileText, Database } from 'lucide-react';

export const AccountingSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'vouchers', label: 'Vouchers', icon: FileText },
    { id: 'currencies', label: 'Currencies', icon: DollarSign },
    { id: 'fiscal', label: 'Fiscal Year', icon: Calendar },
    { id: 'chartOfAccounts', label: 'Chart of Accounts', icon: Database },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="text-indigo-600" size={32} />
          Accounting Settings
        </h1>
        <p className="text-gray-600 mt-2">
          Configure your accounting module preferences and defaults
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Tab Headers */}
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'general' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">General Settings</h2>
              <p className="text-gray-600">
                Configure general accounting preferences such as default currency, date formats, and fiscal year settings.
              </p>
              {/* General settings form will go here */}
            </div>
          )}

          {activeTab === 'vouchers' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Voucher Settings</h2>
              <p className="text-gray-600">
                Configure voucher numbering, prefixes, and default voucher behaviors.
              </p>
              {/* Voucher settings form will go here */}
            </div>
          )}

          {activeTab === 'currencies' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Currency Settings</h2>
              <p className="text-gray-600">
                Manage currencies, exchange rates, and multi-currency settings.
              </p>
              {/* Currency settings will go here */}
            </div>
          )}

          {activeTab === 'fiscal' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Fiscal Year Settings</h2>
              <p className="text-gray-600">
                Configure fiscal year start date and year-end closing preferences.
              </p>
              {/* Fiscal year settings will go here */}
            </div>
          )}

          {activeTab === 'chartOfAccounts' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Chart of Accounts Settings</h2>
              <p className="text-gray-600">
                Configure account numbering schemes and default account categories.
              </p>
              {/* Chart of accounts settings will go here */}
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          Save Settings
        </button>
      </div>
    </div>
  );
};
