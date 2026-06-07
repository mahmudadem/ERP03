import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { errorHandler } from '../../services/errorHandler';

export interface MessagingAccount {
  id: string;
  label: string;
  isDefault?: boolean;
  isActive?: boolean;
  channel: 'WHATSAPP' | 'TELEGRAM';
  phoneNumberE164?: string;
  botUsername?: string;
}

export interface SendTelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Document context — for default message
  documentNumber: string;
  customerName: string;
  amount: number;
  currency: string;
  documentDate: string;
  // Available sender accounts (caller filters by channel)
  accounts: MessagingAccount[];
  // Send action — caller wires to module-specific API
  onSend: (params: {
    messagingAccountId?: string;
    toChatId?: string;
    messageText?: string;
    documentUrl?: string;
  }) => Promise<{ messageId: string; recipientChatId: string; senderLabel?: string }>;
  i18nNamespace?: string; // default 'common'
}

const buildDefaultOutboundMessage = (params: {
  documentNumber: string;
  customerName: string;
  amount: number;
  currency: string;
  documentDate: string;
}) => [
  `Document ${params.documentNumber}`,
  `Customer: ${params.customerName}`,
  `Amount: ${params.amount.toFixed(2)} ${params.currency}`,
  `Date: ${params.documentDate}`,
].join('\n');

export const SendTelegramModal: React.FC<SendTelegramModalProps> = ({
  isOpen,
  onClose,
  documentNumber,
  customerName,
  amount,
  currency,
  documentDate,
  accounts,
  onSend,
  i18nNamespace = 'common',
}) => {
  const { t } = useTranslation(i18nNamespace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [message, setMessage] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setChatId('');
      setDocumentUrl('');
      const defaultAccount = accounts.find((a) => a.isDefault) || accounts[0];
      setAccountId(defaultAccount?.id || '');
      setMessage(
        buildDefaultOutboundMessage({
          documentNumber,
          customerName,
          amount,
          currency,
          documentDate,
        })
      );
    }
  }, [isOpen, accounts, documentNumber, customerName, amount, currency, documentDate]);

  const handleSend = async () => {
    try {
      setBusy(true);
      setError(null);
      const result = await onSend({
        messagingAccountId: accountId || undefined,
        toChatId: chatId.trim() || undefined,
        messageText: message.trim() || undefined,
        documentUrl: documentUrl.trim() || undefined,
      });
      onClose();
      errorHandler.showInfo(
        t(
          'messaging.telegram.success',
          'Telegram sent successfully to {{chatId}} using {{sender}} (message id: {{messageId}}).',
          {
            chatId: result.recipientChatId,
            sender: result.senderLabel || t('messaging.telegram.defaultSender', 'default sender'),
            messageId: result.messageId,
          }
        )
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('messaging.telegram.sendError', 'Failed to send via Telegram.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('messaging.telegram.modalTitle', 'Send via Telegram')}
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('messaging.telegram.senderLabel', 'Sender Account')}
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={busy}
          >
            <option value="">{t('messaging.telegram.senderDefaultOption', 'Use default sender')}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
                {account.botUsername ? ` (${account.botUsername})` : ''}
                {account.isDefault ? ` - ${t('messaging.telegram.defaultTag', 'Default')}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('messaging.telegram.chatLabel', 'Recipient Chat ID or @Username')}
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder={t('messaging.telegram.chatPlaceholder', '@customer_username or -1001234567890')}
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('messaging.telegram.documentUrlLabel', 'Document URL (Optional)')}
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={documentUrl}
            onChange={(e) => setDocumentUrl(e.target.value)}
            placeholder={t('messaging.telegram.documentUrlPlaceholder', 'https://...')}
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('messaging.telegram.messageLabel', 'Message')}
          </label>
          <textarea
            className="min-h-[120px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            onClick={onClose}
            disabled={busy}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={handleSend}
            disabled={busy}
          >
            {busy
              ? t('messaging.telegram.sending', 'Sending...')
              : t('messaging.telegram.send', 'Send')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
