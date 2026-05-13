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
}) => {
  const { t } = useTranslation('aiAssistant');

  if (hasMessages) {
    return null;
  }

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full"
      dir="auto"
    >
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.labelKey}
          onClick={() => onSendMessage(t(action.promptKey))}
          className="group flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl
                     hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5
                     active:translate-y-0 active:shadow-sm
                     transition-all duration-200 ease-out text-center"
        >
          <span className="text-2xl select-none" role="img" aria-hidden="true">
            {action.icon}
          </span>
          <span className="text-sm font-medium text-gray-600 group-hover:text-indigo-600 transition-colors">
            {t(action.labelKey)}
          </span>
        </button>
      ))}
    </div>
  );
};

export default QuickActionButtons;