import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { accountingApi } from '../../../../../api/accountingApi';

export interface ExchangeRateMatrixRef {
  refresh: () => void;
}

export const ExchangeRateMatrix = forwardRef<ExchangeRateMatrixRef, {}>((_, ref) => {
  const [data, setData] = useState<{ matrix: Record<string, Record<string, number>>; currencies: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMatrix = async () => {
    setLoading(true);
    try {
      const res = await accountingApi.getLatestRatesMatrix();
      setData(res);
    } catch (e) {
      console.error('Failed to load matrix:', e);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: loadMatrix
  }));

  useEffect(() => { loadMatrix(); }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-indigo-600" size={24} />
      </div>
    );
  }

  if (!data || data.currencies.length <= 1) return null;

  const { matrix, currencies } = data;

  return (
    <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-[var(--color-border)] flex justify-between items-center">
        <h3 className="text-sm font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
          Exchange Rate Matrix
        </h3>
        <button onClick={loadMatrix} disabled={loading} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Refresh rates">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-[10px] uppercase bg-gray-100 dark:bg-gray-900 text-gray-500 font-black">
            <tr>
              <th className="px-4 py-3 border-r border-gray-200 dark:border-[var(--color-border)] w-24">From \ To</th>
              {currencies.map(c => (
                <th key={c} className="px-4 py-3 text-center min-w-[80px] border-b border-gray-200 dark:border-[var(--color-border)]">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[var(--color-border)]">
            {currencies.map(from => (
              <tr key={from}>
                <th className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 font-bold text-gray-600 dark:text-[var(--color-text-secondary)] border-r border-gray-200 dark:border-[var(--color-border)]">
                  {from}
                </th>
                {currencies.map(to => {
                  const rate = matrix[from]?.[to];
                  const isIdentity = from === to;
                  return (
                    <td 
                      key={to} 
                      className={`px-4 py-3 text-center transition-colors ${
                        isIdentity 
                          ? 'bg-gray-50 dark:bg-gray-900/20 text-gray-400 dark:text-gray-500' 
                          : 'text-gray-900 dark:text-[var(--color-text-primary)] hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                      }`}
                    >
                      {rate !== undefined ? (
                        <span className={rate === 1.0 && !isIdentity ? 'text-amber-600 font-bold' : 'font-medium'}>
                          {rate.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-700">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-[var(--color-border)] text-[10px] text-gray-500 font-medium">
        Matrix shows the latest available reference rates. Identical pairs are 1.0000 by definition.
      </div>
    </div>
  );
});

ExchangeRateMatrix.displayName = 'ExchangeRateMatrix';
