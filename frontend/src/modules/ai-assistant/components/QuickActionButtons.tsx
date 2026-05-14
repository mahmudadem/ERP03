/**
 * QuickActionButtons.tsx
 *
 * Predefined prompt buttons shown when the AI chat conversation is empty.
 * Clicking a button fills the message input and auto-sends the prompt.
 * Buttons disappear once the first message is sent.
 *
 * Supports RTL (Arabic) layout and responsive grid:
 * - 5 columns on desktop (lg)
 * - 3 columns on tablet (md)
 * - 2 columns on mobile
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

export interface QuickActionButtonsProps {
  /** Callback to send a message when a quick action is clicked. */
  onSendMessage: (message: string) => void;
  /** If true, the conversation already has messages and buttons should not render. */
  hasMessages: boolean;
  /** Compact mode for small widgets (1 column). */
  compact?: boolean;
}

interface QuickAction {
  labelKey: string;
  icon: string;
  promptKey: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { labelKey: 'quickActions.financialOverview', icon: '📊', promptKey: 'quickActions.financialOverviewPrompt' },
  { labelKey: 'quickActions.trialBalance', icon: '⚖️', promptKey: 'quickActions.trialBalancePrompt' },
  { labelKey: 'quickActions.topExpenses', icon: '💰', promptKey: 'quickActions.topExpensesPrompt' },
  { labelKey: 'quickActions.salesSummary', icon: '🛒', promptKey: 'quickActions.salesSummaryPrompt' },
  { labelKey: 'quickActions.outstandingInvoices', icon: '📋', promptKey: 'quickActions.outstandingInvoicesPrompt' },
];

export const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({
  onSendMessage,
  hasMessages,
  compact = false,
}) => {
  const { t } = useTranslation('aiAssistant');

  if (hasMessages && !compact) {
    return null;
  }

  return (
    <div
      className={`grid gap-6 w-full ${
        compact 
          ? 'grid-cols-1' 
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
      }`}
      dir="auto"
    >
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.labelKey}
          onClick={() => onSendMessage(t(action.promptKey, { defaultValue: action.promptKey }))}
          className={`
            flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-3xl 
            hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-lg
            transition-all text-center group shadow-sm min-h-[120px]
            ${compact ? 'flex-row' : 'flex-col'}
          `}
        >
          <div className={`
            flex-shrink-0 w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center 
            group-hover:bg-white group-hover:scale-110 transition-all shadow-inner
          `}>
            <span className="text-2xl">
              {action.icon}
            </span>
          </div>
          <div className="flex-1 w-full">
            <span className="block text-sm font-bold text-gray-800 group-hover:text-indigo-700 leading-snug">
              {t(action.labelKey, { defaultValue: action.labelKey.split('.').pop() })}
            </span>
            {!compact && (
              <span className="block text-[10px] text-gray-400 group-hover:text-indigo-400 mt-2 font-medium">
                {t('quickActions.quickActionClick', 'Click to ask')}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

export default QuickActionButtons;