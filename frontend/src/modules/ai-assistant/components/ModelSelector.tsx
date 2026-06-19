/**
 * ModelSelector.tsx
 *
 * Model dropdown selector or free-text input for BYOK mode.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import type { TenantAiProviderOption, TenantAiProviderModelOption } from '../../../api/aiAssistantApi';
import type { ProviderPreset } from '../utils/settingsHelpers';

interface ModelSelectorProps {
  model: string;
  providerModels: TenantAiProviderModelOption[];
  selectedProviderOption: TenantAiProviderOption | null;
  useDynamicProvider: boolean;
  modelsLoading: boolean;
  currentPreset: ProviderPreset;
  canManage: boolean;
  modelFieldId: string;
  onModelChange: (model: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  model,
  providerModels,
  selectedProviderOption,
  useDynamicProvider,
  modelsLoading,
  currentPreset,
  canManage,
  modelFieldId,
  onModelChange,
}) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <div>
      <label htmlFor={modelFieldId} className="block text-sm font-medium text-gray-700 mb-1">
        <Sparkles className="w-4 h-4 inline ltr:mr-1 rtl:ml-1" />
        {t('settings.model', 'Model')}
      </label>
      {useDynamicProvider && providerModels.length > 0 ? (
        <>
          <select
            id={modelFieldId}
            value={providerModels.some((m) => String((m.profile as Record<string, unknown>).modelId || (m.profile as Record<string, unknown>).modelName || '') === model) ? model : '__custom__'}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                onModelChange('');
              } else {
                onModelChange(e.target.value);
              }
            }}
            disabled={!canManage}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-100"
          >
            <option value="__custom__">{t('settings.modelCustomOption', 'Enter custom model name...')}</option>
            {providerModels.map((m) => {
              const profileData = m.profile as Record<string, unknown>;
              const modelId = String(profileData.modelId || profileData.modelName || '');
              const displayName = String(profileData.displayName || profileData.modelName || modelId);
              return (
                <option key={modelId} value={modelId}>
                  {displayName}
                </option>
              );
            })}
          </select>
          {/* Show free text input only when "custom" is selected in dropdown */}
          {(model === '' || !providerModels.some((m) => String((m.profile as Record<string, unknown>).modelId || (m.profile as Record<string, unknown>).modelName || '') === model)) && (
            <input
              id="model-custom"
              type="text"
              value={model === '' || providerModels.some((m) => String((m.profile as Record<string, unknown>).modelId || (m.profile as Record<string, unknown>).modelName || '') === model) ? '' : model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder={t('settings.modelPlaceholder', 'e.g., gpt-4o, claude-3-opus')}
              disabled={!canManage}
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          )}
        </>
      ) : (
        <>
          <input
            id={modelFieldId}
            type="text"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder={currentPreset.defaultModel || 'gpt-4o'}
            disabled={!canManage}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
          {useDynamicProvider && modelsLoading && (
            <p className="text-xs text-gray-400 mt-1">
              {t('settings.modelsLoading', 'Loading models...')}
            </p>
          )}
        </>
      )}
    </div>
  );
};