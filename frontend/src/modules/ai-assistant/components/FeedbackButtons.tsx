/**
 * FeedbackButtons - Thumbs up/down feedback for AI chat messages
 *
 * Shows 👍/👎 buttons below each assistant message.
 * Supports toggle (click same again to remove) and switch.
 * Disabled while submitting. i18n-aware.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { aiAssistantApi } from '../../../api/aiAssistantApi';

interface FeedbackButtonsProps {
  messageId: string;
  currentFeedback?: 'positive' | 'negative' | null;
  companyId: string;
  onFeedbackSubmitted?: (messageId: string, feedback: 'positive' | 'negative' | null) => void;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  messageId,
  currentFeedback,
  companyId,
  onFeedbackSubmitted,
}) => {
  const { t } = useTranslation('aiAssistant');
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null | undefined>(currentFeedback);
  const [submitting, setSubmitting] = useState(false);

  const handleClick = async (type: 'positive' | 'negative') => {
    if (submitting) return;

    // Toggle: if clicking the same feedback, remove it
    const newFeedback = feedback === type ? null : type;

    setSubmitting(true);
    try {
      if (newFeedback) {
        // Send a PATCH with the desired feedback value
        // The backend will toggle if same, so we need to send the value we want
        // But we handle toggle logic on client side for immediate UI feedback
        const result = await aiAssistantApi.updateMessageFeedback(messageId, type);
        // If backend toggled it off (same as before), result.feedback will be null
        setFeedback(result.feedback || null);
        onFeedbackSubmitted?.(messageId, result.feedback || null);
      } else {
        // We want to remove feedback — send the current type so backend toggles it off
        const effectiveType = (feedback as 'positive' | 'negative');
        const result = await aiAssistantApi.updateMessageFeedback(messageId, effectiveType);
        setFeedback(result.feedback || null);
        onFeedbackSubmitted?.(messageId, result.feedback || null);
      }
    } catch {
      // Silently fail — feedback is non-critical
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1.5">
      <button
        type="button"
        onClick={() => handleClick('positive')}
        disabled={submitting}
        title={t('chat.feedback.positive', 'Helpful')}
        className={`p-1 rounded-md transition-colors ${
          feedback === 'positive'
            ? 'text-green-600 bg-green-50 hover:bg-green-100'
            : 'text-gray-400 hover:text-green-500 hover:bg-gray-50'
        } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={t('chat.feedback.positive', 'Helpful')}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleClick('negative')}
        disabled={submitting}
        title={t('chat.feedback.negative', 'Not helpful')}
        className={`p-1 rounded-md transition-colors ${
          feedback === 'negative'
            ? 'text-red-500 bg-red-50 hover:bg-red-100'
            : 'text-gray-400 hover:text-red-400 hover:bg-gray-50'
        } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={t('chat.feedback.negative', 'Not helpful')}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};