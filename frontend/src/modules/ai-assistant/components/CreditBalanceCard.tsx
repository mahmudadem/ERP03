/**
 * CreditBalanceCard.tsx
 *
 * Displays the AI credit balance for CREDITS runtime mode.
 * Fetches its own data from aiAssistantApi.getCreditBalance().
 * Shows current balance, total purchased/consumed, and last timestamps.
 * Rendered only when runtimeMode === 'CREDITS' in the settings page.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, RefreshCw, AlertCircle } from 'lucide-react';
import { aiAssistantApi, AiCreditBalanceResponse } from '../../../api/aiAssistantApi';

export const CreditBalanceCard: React.FC = () => {
  const { t } = useTranslation('aiAssistant');
  const [balance, setBalance] = useState<AiCreditBalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchBalance = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await aiAssistantApi.getCreditBalance();
        if (!cancelled) {
          setBalance(result);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.error?.message || err?.message || t('creditBalance.loadingError'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchBalance();
    return () => { cancelled = true; };
  }, [t]);

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (error) {
    return (
      <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mb-6 rounded-md border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
          <span className="text-sm text-gray-500">{t('creditBalance.loading')}</span>
        </div>
      </div>
    );
  }

  if (!balance) {
    return (
      <div className="mb-6 rounded-md border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <Coins className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-gray-800">
              {t('creditBalance.title')}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {t('creditBalance.noCreditsYet')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3 mb-4">
        <Coins className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-gray-800">
            {t('creditBalance.title')}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center mb-4">
        <div>
          <div className="text-2xl font-bold text-indigo-700">{balance.balance}</div>
          <div className="text-xs text-gray-500 mt-1">{t('creditBalance.currentBalance')}</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-700">{balance.totalPurchased}</div>
          <div className="text-xs text-gray-500 mt-1">{t('creditBalance.totalPurchased')}</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-700">{balance.totalConsumed}</div>
          <div className="text-xs text-gray-500 mt-1">{t('creditBalance.totalConsumed')}</div>
        </div>
      </div>

      {(balance.lastCreditAt || balance.lastDebitAt) && (
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 border-t border-gray-100 pt-3 mb-3">
          {balance.lastCreditAt && (
            <div>
              <span className="font-medium text-gray-600">{t('creditBalance.lastCredit')}:</span> {formatDate(balance.lastCreditAt)}
            </div>
          )}
          {balance.lastDebitAt && (
            <div>
              <span className="font-medium text-gray-600">{t('creditBalance.lastDebit')}:</span> {formatDate(balance.lastDebitAt)}
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
        {t('creditBalance.helpText')}
      </div>
    </div>
  );
};

export default CreditBalanceCard;