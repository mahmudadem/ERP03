/**
 * ApiKeyInput.tsx
 *
 * API key input field for BYOK mode.
 * Displays a password input with placeholder indicating whether a key is already saved.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Key } from 'lucide-react';

interface ApiKeyInputProps {
  apiKey: string;
  hasApiKey: boolean | undefined;
  canManage: boolean;
  onChange: (value: string) => void;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  apiKey,
  hasApiKey,
  canManage,
  onChange,
}) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <div>
      <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
        <Key className="w-4 h-4 inline mr-1" />
        {t('settings.apiKey', 'API Key')}
      </label>
      <input
        id="api-key"
        type="password"
        value={apiKey}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hasApiKey ? '••••••••' : t('settings.apiKeyPlaceholder', 'Enter your API key')}
        disabled={!canManage}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
      />
      {hasApiKey && (
        <p className="text-xs text-gray-400 mt-1">
          {t('settings.apiKeySet', 'An API key is already configured. Enter a new one to replace it.')}
        </p>
      )}
    </div>
  );
};