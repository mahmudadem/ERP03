import React, { useState } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { CurrencyDTO } from '../../../../../api/accountingApi';

interface AvailableCurrenciesModalProps {
  currencies: CurrencyDTO[];
  onClose: () => void;
  onSelect: (currency: CurrencyDTO) => void;
}

export const AvailableCurrenciesModal: React.FC<AvailableCurrenciesModalProps> = ({
  currencies,
  onClose,
  onSelect
}) => {
  const [search, setSearch] = useState('');

  const filtered = currencies.filter(c => 
    c.code.toLowerCase().includes(search.toLowerCase()) || 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div 
        className="bg-white dark:bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-[var(--color-border)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[var(--color-border)] flex items-center justify-between bg-gray-50 dark:bg-gray-800">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
              Add New Currency
            </h3>
            <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)]">
              Enable additional currencies for your company transactions.
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[var(--color-border)]/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by currency code or name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[var(--color-bg-secondary)]">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(currency => (
                <button
                  key={currency.code}
                  onClick={() => onSelect(currency)}
                  className="flex items-center gap-4 p-4 border border-gray-100 dark:border-[var(--color-border)] rounded-xl hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all text-left group"
                >
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    {currency.symbol}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-[var(--color-text-primary)] group-hover:text-indigo-600 transition-colors">
                      {currency.code}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-[var(--color-text-secondary)] truncate font-medium uppercase tracking-wider">
                      {currency.name}
                    </p>
                  </div>
                  <Plus size={16} className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center mb-4">
                <Search size={24} className="text-gray-300" />
              </div>
              <p className="text-gray-900 dark:text-[var(--color-text-primary)] font-bold">No matches found</p>
              <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">Try a different currency code or name.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-[var(--color-border)] bg-gray-50 dark:bg-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
