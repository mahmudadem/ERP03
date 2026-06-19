/**
 * ProviderSelector.tsx
 *
 * Provider dropdown selector and description/badges for BYOK mode.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Server } from 'lucide-react';
import type { TenantAiProviderOption } from '../../../api/aiAssistantApi';
import type { ProviderPreset } from '../utils/settingsHelpers';
import { PROVIDER_PRESETS, PRESET_LABEL_FALLBACKS } from '../utils/settingsHelpers';

interface ProviderSelectorProps {
  selectedProviderId: string;
  presetId: string;
  availableProviders: TenantAiProviderOption[];
  selectedProviderOption: TenantAiProviderOption | null;
  currentPreset: ProviderPreset;
  providersLoading: boolean;
  canManage: boolean;
  onChange: (newProviderId: string) => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProviderId,
  presetId,
  availableProviders,
  selectedProviderOption,
  currentPreset,
  providersLoading,
  canManage,
  onChange,
}) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <>
      {/* Provider Dropdown */}
      <div className="mb-4">
        <label htmlFor="provider-select" className="block text-sm font-medium text-gray-700 mb-1">
          <Server className="w-4 h-4 inline ltr:mr-1 rtl:ml-1" />
          {t('settings.selectProvider', 'AI Provider')}
        </label>
        {providersLoading ? (
          <div className="w-full px-3 py-2.5 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-400">
            {t('settings.providersLoading', 'Loading providers...')}
          </div>
        ) : (
          <select
            id="provider-select"
            value={selectedProviderId || presetId}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            disabled={!canManage}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {/* Mock (Development) — always available */}
            <option value="__mock__">{t('settings.presetMock', 'Mock (Development)')}</option>
            {/* Dynamic providers from API */}
            {availableProviders.length > 0 && (
              <optgroup label={t('settings.providerGroupAvailable', 'Available Providers')}>
                {availableProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.byok ? ` (${t('settings.providerByok', 'BYOK')})` : ` (${t('settings.providerManaged', 'Managed')})`}
                  </option>
                ))}
              </optgroup>
            )}
            {/* Fallback built-in presets when no dynamic providers */}
            {availableProviders.length === 0 && PROVIDER_PRESETS.filter((p) => p.id !== 'mock' && p.id !== 'custom').map((preset) => (
              <option key={preset.id} value={preset.id}>
                {t(`settings.preset${preset.id.charAt(0).toUpperCase() + preset.id.slice(1)}`, PRESET_LABEL_FALLBACKS[preset.id])}
              </option>
            ))}
            {/* Custom — manual entry escape hatch */}
            <option value="__custom__">{t('settings.presetCustom', 'Custom')}</option>
          </select>
        )}
      </div>

      {/* Provider description / badges */}
      <div className="mb-6 px-3 py-2 bg-gray-50 border border-gray-100 rounded-md text-sm text-gray-500">
        {selectedProviderOption ? (
          <>
            <span className="font-medium text-gray-700">{selectedProviderOption.name}</span>
            <span className="ltr:ml-2 rtl:mr-2 text-xs text-gray-400">({selectedProviderOption.type})</span>
            {selectedProviderOption.defaultBaseUrl && (
              <span className="ltr:ml-1 rtl:mr-1 text-xs font-mono text-gray-400">({selectedProviderOption.defaultBaseUrl})</span>
            )}
            {selectedProviderOption.byok ? (
              <span className="ltr:ml-2 rtl:mr-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                {t('settings.apiKeyRequired', 'API key required')}
              </span>
            ) : (
              <span className="ltr:ml-2 rtl:mr-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                {t('settings.noApiKeyRequired', 'No API key')}
              </span>
            )}
            {selectedProviderOption.supportsTools && (
              <span className="ltr:ml-1 rtl:mr-1 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded border border-blue-200">
                {t('settings.providerCapTools', 'Tools')}
              </span>
            )}
          </>
        ) : selectedProviderId === '__mock__' || presetId === 'mock' ? (
          <>
            {t('settings.presetMockDesc', 'Returns simulated responses. Safe for development. No API key needed.')}
            <span className="ltr:ml-2 rtl:mr-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
              {t('settings.noApiKeyRequired', 'No API key')}
            </span>
          </>
        ) : (
          <>
            {t('settings.presetCustomDesc', 'Use any OpenAI-compatible endpoint manually.')}
            <span className="ltr:ml-2 rtl:mr-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
              {t('settings.apiKeyRequired', 'API key required')}
            </span>
          </>
        )}
      </div>
    </>
  );
};