/**
 * aiErrorMessages.ts
 *
 * Maps AI provider HTTP error codes to user-friendly messages with
 * retry guidance and action links.
 *
 * Used by AiErrorDisplay to show meaningful error feedback instead
 * of raw error text.
 */

import i18n from 'i18next';

export interface AiErrorResponse {
  title: string;
  message: string;
  canRetry: boolean;
  actionLabel?: string;
  actionUrl?: string;
}

/**
 * Extracts the HTTP status code from an axios-style error.
 * Handles both `err.response.status` and `err.status` shapes.
 */
function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const err = error as Record<string, unknown>;

  // Axios-style: err.response.status
  if (err.response && typeof err.response === 'object') {
    const resp = err.response as Record<string, unknown>;
    if (typeof resp.status === 'number') return resp.status;
  }

  // Direct status
  if (typeof err.status === 'number') return err.status;

  // Some errors encode status in statusCode
  if (typeof err.statusCode === 'number') return err.statusCode;

  return undefined;
}

/**
 * Maps any caught error to a structured AiErrorResponse with:
 * - A user-friendly title and message
 * - Whether the user can retry
 * - An optional action label and URL (e.g. "Go to Settings")
 */
export function mapAiError(error: unknown): AiErrorResponse {
  const status = extractStatus(error);
  const t = i18n.t.bind(i18n);

  switch (status) {
    case 429:
      return {
        title: t('aiAssistant:chat.errors.rateLimitTitle', 'Rate Limit Reached'),
        message: t(
          'aiAssistant:chat.errors.rateLimit',
          "You've reached your daily AI request limit. Try again tomorrow or contact your admin to increase the limit."
        ),
        canRetry: false,
      };

    case 401:
      return {
        title: t('aiAssistant:chat.errors.authFailedTitle', 'Authentication Failed'),
        message: t(
          'aiAssistant:chat.errors.authFailed',
          'Your AI provider API key is invalid or expired. Please update it in AI Settings.'
        ),
        canRetry: false,
        actionLabel: t('aiAssistant:chat.errors.goToSettings', 'Go to Settings'),
        actionUrl: '/ai-assistant/settings',
      };

    case 403:
      return {
        title: t('aiAssistant:chat.errors.noCreditsTitle', 'No Credits Remaining'),
        message: t(
          'aiAssistant:chat.errors.noCredits',
          'No AI credits remaining. Please purchase more credits or switch to BYOK mode in AI Settings.'
        ),
        canRetry: false,
        actionLabel: t('aiAssistant:chat.errors.goToSettings', 'Go to Settings'),
        actionUrl: '/ai-assistant/settings',
      };

    case 409:
      return {
        title: t('aiAssistant:chat.errors.conflictTitle', 'Request Already Processing'),
        message: t(
          'aiAssistant:chat.errors.conflict',
          'A request is already being processed for this conversation. Please wait.'
        ),
        canRetry: false,
      };

    case 408:
      return {
        title: t('aiAssistant:chat.errors.timeoutTitle', 'Request Timed Out'),
        message: t(
          'aiAssistant:chat.errors.timeout',
          'The request took too long. This might happen with complex questions. Try simplifying your question.'
        ),
        canRetry: true,
      };

    case 500:
    case 502:
    case 503:
    case 504:
      return {
        title: t('aiAssistant:chat.errors.providerDownTitle', 'Provider Unavailable'),
        message: t(
          'aiAssistant:chat.errors.providerDown',
          'The AI provider is temporarily unavailable. Please try again in a moment.'
        ),
        canRetry: true,
      };

    default: {
      // Check if it looks like a provider/config error from the message
      const errMsg =
        (error instanceof Error ? error.message : '') ||
        (typeof error === 'object' && error !== null
          ? String((error as Record<string, unknown>).message ?? (error as Record<string, unknown>).error ?? '')
          : '');

      const isProviderError = /api key|provider|diagnostics|ai settings/i.test(errMsg);

      if (isProviderError) {
        return {
          title: t('aiAssistant:chat.errors.providerErrorTitle', 'Provider Not Available'),
          message: t(
            'aiAssistant:chat.errors.providerNotAvailable',
            'AI provider is not available. Check your AI settings and run diagnostics.'
          ),
          canRetry: false,
          actionLabel: t('aiAssistant:chat.errors.goToSettings', 'Go to Settings'),
          actionUrl: '/ai-assistant/settings',
        };
      }

      return {
        title: t('aiAssistant:chat.errors.genericTitle', 'Something Went Wrong'),
        message: t(
          'aiAssistant:chat.errors.generic',
          'Something went wrong. Please try again.'
        ),
        canRetry: true,
      };
    }
  }
}