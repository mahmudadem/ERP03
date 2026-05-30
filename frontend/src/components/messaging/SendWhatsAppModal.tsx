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

export interface SendWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Document context — for default message
  documentNumber: string;
  customerName: string;
  amount: number;
  currency: string;
  documentDate: string;
  // Customer default phone (pre-fill)
  defaultPhone?: string;
  // Available sender accounts (caller filters by channel)
  accounts: MessagingAccount[];
  // Send action — caller wires to module-specific API
  onSend: (params: {
    messagingAccountId?: string;
    toPhoneNumber?: string;
    messageText?: string;
    documentUrl?: string;
  }) => Promise<{ messageId: string; recipientPhoneNumber: string; senderLabel?: string }>;
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

export const SendWhatsAppModal: React.FC<SendWhatsAppModalProps> = ({
  isOpen,
  onClose,
  documentNumber,
  customerName,
  amount,
  currency,
  documentDate,
  defaultPhone,
  accounts,
  onSend,
  i18nNamespace = 'common',
}) => {
  const { t } = useTranslation(i18nNamespace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [accountId, setAccountId] = useState('');
  const [message, setMessage] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPhone(defaultPhone || '');
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
  }, [isOpen, defaultPhone, accounts, documentNumber, customerName, amount, currency, documentDate]);

  const handleSend = async () => {
    try {
      setBusy(true);
      setError(null);
      const result = await onSend({
        messagingAccountId: accountId || undefined,
        toPhoneNumber: phone.trim() || undefined,
        messageText: message.trim() || undefined,
        documentUrl: documentUrl.trim() || undefined,
      });
      onClose();
      errorHandler.showInfo(
        t(
          'messaging.whatsapp.success',
          'WhatsApp sent successfully to {{phone}} using {{sender}} (message id: {{messageId}}).',
          {
            phone: result.recipientPhoneNumber,
            sender: result.senderLabel || t('messaging.whatsapp.defaultSender', 'default sender'),
            messageId: result.messageId,
          }
        )
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('messaging.whatsapp.sendError', 'Failed to send via WhatsApp.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('messaging.whatsapp.modalTitle', 'Send via WhatsApp')}
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('messaging.whatsapp.senderLabel', 'Sender Account')}
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={busy}
          >
            <option value="">{t('messaging.whatsapp.senderDefaultOption', 'Use system default sender')}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
                {account.phoneNumberE164 ? ` (${account.phoneNumberE164})` : ''}
                {account.isDefault ? ` - ${t('messaging.whatsapp.defaultTag', 'Default')}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('messaging.whatsapp.phoneLabel', 'Recipient Phone (E.164)')}
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('messaging.whatsapp.phonePlaceholder', '+905551112233')}
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('messaging.whatsapp.documentUrlLabel', 'Document URL (Optional)')}
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={documentUrl}
            onChange={(e) => setDocumentUrl(e.target.value)}
            placeholder={t('messaging.whatsapp.documentUrlPlaceholder', 'https://...')}
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            {t('messaging.whatsapp.messageLabel', 'Message')}
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
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={handleSend}
            disabled={busy}
          >
            {busy
              ? t('messaging.whatsapp.sending', 'Sending...')
              : t('messaging.whatsapp.send', 'Send')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
