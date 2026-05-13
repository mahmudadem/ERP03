/**
 * ContextBudgetSettings.tsx
 *
 * Advanced settings section: conversation context mode, previous tool results toggle,
 * max tokens, and max requests per day.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConversationContextMode } from '../utils/settingsHelpers';

interface ContextBudgetSettingsProps {
  conversationContextMode: ConversationContextMode;
  includePreviousToolResults: boolean;
  maxTokens: number;
  maxRequestsPerDay: number;
  canManage: boolean;
  onConversationContextModeChange: (mode: ConversationContextMode) => void;
  onIncludePreviousToolResultsChange: (value: boolean) => void;
  onMaxTokensChange: (value: number) => void;
  onMaxRequestsPerDayChange: (value: number) => void;
}

export const ContextBudgetSettings: React.FC<ContextBudgetSettingsProps> = ({
  conversationContextMode,
  includePreviousToolResults,
  maxTokens,
  maxRequestsPerDay,
  canManage,
  onConversationContextModeChange,
  onIncludePreviousToolResultsChange,
  onMaxTokensChange,
  onMaxRequestsPerDayChange,
}) => {
  const { t } = useTranslation('aiAssistant');

  return (
    <div className="space-y-4 mb-6">
      <h3 className="text-sm font-medium text-gray-700">
        {t('settings.advanced', 'Advanced')}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="max-tokens" className="block text-sm text-gray-600 mb-1">
            {t('settings.maxTokens', 'Max Tokens per Request')}
          </label>
          <input
            id="max-tokens"
            type="number"
            value={maxTokens || ''}
            onChange={(e) => {
              const val = e.target.value;
              onMaxTokensChange(val === '' ? 0 : parseInt(val) || 0);
            }}
            onBlur={() => {
              if (!maxTokens || maxTokens < 256) onMaxTokensChange(4096);
            }}
            disabled={!canManage}
            min={256}
            max={32768}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="max-requests" className="block text-sm text-gray-600 mb-1">
            {t('settings.maxRequests', 'Max Requests per Day')}
          </label>
          <input
            id="max-requests"
            type="number"
            value={maxRequestsPerDay || ''}
            onChange={(e) => {
              const val = e.target.value;
              onMaxRequestsPerDayChange(val === '' ? 0 : parseInt(val) || 0);
            }}
            onBlur={() => {
              if (!maxRequestsPerDay || maxRequestsPerDay < 1) onMaxRequestsPerDayChange(100);
            }}
            disabled={!canManage}
            min={1}
            max={10000}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="mb-3">
          <h4 className="text-sm font-medium text-gray-700">
            {t('settings.contextTitle', 'Conversation Context')}
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            {t('settings.contextDesc', 'Controls how much previous chat and ERP tool data is sent to the model. More context improves follow-up answers but may consume more tokens from your API key.')}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="conversation-context-mode" className="block text-sm text-gray-600 mb-1">
              {t('settings.contextMode', 'Context depth')}
            </label>
            <select
              id="conversation-context-mode"
              value={conversationContextMode}
              onChange={(e) => onConversationContextModeChange(e.target.value as ConversationContextMode)}
              disabled={!canManage}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white disabled:bg-gray-100"
            >
              <option value="minimal">{t('settings.contextModeMinimal', 'Minimal - lowest token cost')}</option>
              <option value="balanced">{t('settings.contextModeBalanced', 'Balanced - recommended')}</option>
              <option value="deep">{t('settings.contextModeDeep', 'Deep - best continuity, higher cost')}</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              {t(`settings.contextMode${conversationContextMode.charAt(0).toUpperCase() + conversationContextMode.slice(1)}Desc`)}
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3">
            <input
              type="checkbox"
              checked={includePreviousToolResults}
              onChange={(e) => onIncludePreviousToolResultsChange(e.target.checked)}
              disabled={!canManage}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
            />
            <span>
              <span className="block text-sm font-medium text-gray-700">
                {t('settings.includePreviousToolResults', 'Include previous tool results')}
              </span>
              <span className="mt-1 block text-xs text-gray-500">
                {t('settings.includePreviousToolResultsDesc', 'Lets follow-up questions reuse ERP data already fetched in this chat. Turn off for lower token usage.')}
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};