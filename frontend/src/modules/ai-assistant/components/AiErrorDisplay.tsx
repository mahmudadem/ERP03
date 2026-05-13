/**
 * AiErrorDisplay - User-friendly error card for AI chat failures
 *
 * Displays a styled error card with:
 * - Title and descriptive message (from mapAiError)
 * - Retry button when canRetry is true
 * - "Go to Settings" link when actionUrl is provided
 * - Color-coded icon (orange for retryable, red for non-retryable)
 *
 * Uses i18n for all user-facing strings.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { mapAiError, AiErrorResponse } from '../utils/aiErrorMessages';

interface AiErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
}

export const AiErrorDisplay: React.FC<AiErrorDisplayProps> = ({ error, onRetry }) => {
  const { t } = useTranslation('aiAssistant');
  const mapped: AiErrorResponse = mapAiError(error);

  const IconComponent = mapped.canRetry ? AlertTriangle : AlertCircle;

  return (
    <div
      className={`rounded-xl border px-4 py-3 mt-2 ${
        mapped.canRetry
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <IconComponent
          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
            mapped.canRetry ? 'text-amber-500' : 'text-red-500'
          }`}
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{mapped.title}</p>
          <p className="text-sm mt-0.5 opacity-90">{mapped.message}</p>

          <div className="flex items-center gap-3 mt-2">
            {mapped.canRetry && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md
                  bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors border border-amber-200"
              >
                <RefreshCw className="w-3 h-3" />
                {t('chat.errors.retry', 'Retry')}
              </button>
            )}

            {mapped.actionUrl && mapped.actionLabel && (
              <a
                href={mapped.actionUrl}
                className="inline-flex items-center gap-1 text-xs font-medium
                  text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {mapped.actionLabel}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};