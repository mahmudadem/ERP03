import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SendWhatsAppModal,
  type MessagingAccount,
  type SendWhatsAppModalProps,
} from './SendWhatsAppModal';
import {
  SendTelegramModal,
  type SendTelegramModalProps,
} from './SendTelegramModal';

export type SendChannel = 'WHATSAPP' | 'TELEGRAM' | 'WHATSAPP_LINK';

export interface SendDocumentButtonProps {
  // Document context shared across channels
  documentNumber: string;
  customerName: string;
  amount: number;
  currency: string;
  documentDate: string;
  // Combined list of messaging accounts; component partitions by channel
  accounts: MessagingAccount[];
  // Customer default phone — used both for WhatsApp API pre-fill and wa.me share link
  defaultPhone?: string;
  // Channel handlers — caller wires to module-specific APIs
  onSendWhatsApp?: SendWhatsAppModalProps['onSend'];
  onSendTelegram?: SendTelegramModalProps['onSend'];
  // wa.me link share (no API). Pass `false` to hide it; pass a string to override default message
  shareLink?: false | { message?: string };
  // i18n namespace forwarded to modals
  i18nNamespace?: string;
  // Visual
  className?: string;
  disabled?: boolean;
  label?: string; // override default "Send" label
}

const buildShareLinkHref = (phone: string | undefined, message: string) => {
  const cleaned = (phone || '').trim().replace(/[\s()\-]/g, '').replace(/^\+/, '');
  return cleaned
    ? `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
};

export const SendDocumentButton: React.FC<SendDocumentButtonProps> = ({
  documentNumber,
  customerName,
  amount,
  currency,
  documentDate,
  accounts,
  defaultPhone,
  onSendWhatsApp,
  onSendTelegram,
  shareLink,
  i18nNamespace = 'common',
  className,
  disabled,
  label,
}) => {
  const { t } = useTranslation(i18nNamespace);
  const [open, setOpen] = useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const whatsappAccounts = useMemo(
    () => accounts.filter((a) => a.channel === 'WHATSAPP' && a.isActive !== false),
    [accounts]
  );
  const telegramAccounts = useMemo(
    () => accounts.filter((a) => a.channel === 'TELEGRAM' && a.isActive !== false),
    [accounts]
  );

  const showShareLink = shareLink !== false;
  const showWhatsApp = whatsappAccounts.length > 0 && !!onSendWhatsApp;
  const showTelegram = telegramAccounts.length > 0 && !!onSendTelegram;
  const hasAnyChannel = showShareLink || showWhatsApp || showTelegram;

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!hasAnyChannel) return null;

  const shareMessage =
    (shareLink && typeof shareLink === 'object' && shareLink.message) ||
    [
      `${t('messaging.share.document', 'Document')} ${documentNumber}`,
      `${t('messaging.share.customer', 'Customer')}: ${customerName}`,
      `${t('messaging.share.amount', 'Amount')}: ${amount.toFixed(2)} ${currency}`,
      `${t('messaging.share.date', 'Date')}: ${documentDate}`,
    ].join('\n');

  const shareHref = buildShareLinkHref(defaultPhone, shareMessage);

  return (
    <div ref={wrapperRef} className={`relative inline-block ${className || ''}`}>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label || t('messaging.send.action', 'Send')}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[220px] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 shadow-lg"
        >
          {showWhatsApp && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => {
                setOpen(false);
                setWhatsAppOpen(true);
              }}
            >
              <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              {t('messaging.send.whatsapp', 'WhatsApp')}
            </button>
          )}
          {showTelegram && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => {
                setOpen(false);
                setTelegramOpen(true);
              }}
            >
              <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-sky-500" />
              {t('messaging.send.telegram', 'Telegram')}
            </button>
          )}
          {showShareLink && (
            <a
              role="menuitem"
              href={shareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
              {t('messaging.send.whatsappLink', 'Share via WhatsApp link')}
            </a>
          )}
        </div>
      )}

      {showWhatsApp && onSendWhatsApp && (
        <SendWhatsAppModal
          isOpen={whatsAppOpen}
          onClose={() => setWhatsAppOpen(false)}
          accounts={whatsappAccounts}
          defaultPhone={defaultPhone}
          documentNumber={documentNumber}
          customerName={customerName}
          amount={amount}
          currency={currency}
          documentDate={documentDate}
          onSend={onSendWhatsApp}
          i18nNamespace={i18nNamespace}
        />
      )}
      {showTelegram && onSendTelegram && (
        <SendTelegramModal
          isOpen={telegramOpen}
          onClose={() => setTelegramOpen(false)}
          accounts={telegramAccounts}
          documentNumber={documentNumber}
          customerName={customerName}
          amount={amount}
          currency={currency}
          documentDate={documentDate}
          onSend={onSendTelegram}
          i18nNamespace={i18nNamespace}
        />
      )}
    </div>
  );
};
