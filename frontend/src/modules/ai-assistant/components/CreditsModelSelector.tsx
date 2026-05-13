/**
 * CreditsModelSelector.tsx
 *
 * CREDITS mode inline certified model selector.
 * Shows available certified models and allows selection.
 * Optionally displays credit balance information when provided.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Shield, ShieldCheck } from 'lucide-react';
import type { CertifiedProfileEntry } from '../../../api/aiAssistantApi';

interface CreditsModelSelectorProps {
  erp03AvailableModels: CertifiedProfileEntry[];
  erp03ModelsLoading: boolean;
  selectedErp03Profile: CertifiedProfileEntry | null;
  canManage: boolean;
  onSelect: (entry: CertifiedProfileEntry) => void;
  onDeselect: () => void;
  /** Optional credit balance info — shown only if provided */
  creditBalance?: {
    balance: number;
    totalPurchased: number;
    totalConsumed: number;
  } | null;
}

export const CreditsModelSelector: React.FC<CreditsModelSelectorProps> = ({
  erp03AvailableModels,
  erp03ModelsLoading,
  selectedErp03Profile,
  canManage,
  onSelect,
  onDeselect,
  creditBalance,
}) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-800 mb-1">
        <ShieldCheck className="w-4 h-4 inline mr-1.5 text-indigo-600" />
        {t('settings.erp03AiSelectModel', 'Select AI Model')}
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        {t('settings.erp03AiSelectModelDesc', 'Choose from models available on your plan.')}
      </p>

      {/* Credit balance card — only rendered if balance data is provided */}
      {creditBalance && (
        <div className="mb-4 rounded-md border border-indigo-200 bg-indigo-50 p-4">
          <h4 className="text-sm font-medium text-indigo-800 mb-2">
            {t('settings.creditBalance', 'Credit Balance')}
          </h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-indigo-700">{creditBalance.balance}</div>
              <div className="text-xs text-indigo-500">{t('settings.creditRemaining', 'Remaining')}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-700">{creditBalance.totalPurchased}</div>
              <div className="text-xs text-gray-500">{t('settings.creditPurchased', 'Purchased')}</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-700">{creditBalance.totalConsumed}</div>
              <div className="text-xs text-gray-500">{t('settings.creditConsumed', 'Consumed')}</div>
            </div>
          </div>
        </div>
      )}

      {erp03ModelsLoading ? (
        <div className="text-sm text-gray-400 py-4 text-center">
          {t('settings.certifiedModels.loading', 'Loading certified models...')}
        </div>
      ) : erp03AvailableModels.length === 0 ? (
        <div className="text-sm text-gray-400 py-4 text-center">
          {t('settings.certifiedModels.empty', 'No certified models available')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {erp03AvailableModels.map((entry) => {
            const profile = entry.profile as Record<string, unknown>;
            const name = String(profile.displayName || profile.modelName || profile.modelId || 'Unknown');
            const isSelected = selectedErp03Profile?.profile.id === entry.profile.id;
            const hasGlobal = entry.certifications?.some((c) => c.scope === 'GLOBAL');
            const scopeLabel = hasGlobal
              ? t('settings.certifiedModels.scopeGlobal', 'GLOBAL')
              : t('settings.certifiedModels.scopeTenant', 'TENANT');
            const scopeColor = hasGlobal ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
            const cats = entry.certifications
              ?.filter((c) => !['blocked', 'deprecated', 'expired'].includes(String(c.status).toLowerCase()))
              .map((c) => c.category) ?? [];
            const uniqueCats = [...new Set(cats)].slice(0, 3);

            return (
              <div
                key={String(entry.profile.id)}
                className={`relative rounded-lg border-2 p-4 transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                      <span className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {name}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${scopeColor}`}>
                        {scopeLabel}
                      </span>
                      {uniqueCats.map((cat) => (
                        <span key={cat} className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onDeselect();
                      } else {
                        onSelect(entry);
                      }
                    }}
                    disabled={!canManage}
                    className={`flex-shrink-0 inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    } ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('settings.erp03AiChangeModel', 'Change')}
                      </>
                    ) : (
                      t('settings.certifiedModels.selectButton', 'Select')
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
        <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          {t('settings.erp03AiNoProviderNeeded', 'No provider or API key needed — ERP03 manages credentials for you.')}
        </span>
      </div>
    </div>
  );
};