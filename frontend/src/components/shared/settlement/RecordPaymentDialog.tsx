/**
 * RecordPaymentDialog — invoice-aware pay-later entry point (Task 184 Finding 5).
 *
 * Replaces the old "Create Payment/Receipt" button that navigated into the generic
 * Accounting voucher editor (blank form, ignored sourceType/sourceId, never reconciled
 * to the invoice, and unreachable for users without the Accounting module). This dialog
 * lives ON the invoice page, pre-fills party + outstanding, allows partial payment, and
 * calls `recordPayment(invoiceId, …)` directly — which posts the linked receipt/payment
 * voucher through the same two-voucher engine as settle-on-post (only the timing differs;
 * see docs/architecture/sales.md "Voucher model").
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountSelector } from '../../../modules/accounting/components/shared/AccountSelector';
import { DatePicker } from '../../../modules/accounting/components/shared/DatePicker';
import { todayLocalIso } from '../../../utils/dateUtils';

export interface RecordPaymentMethodConfig {
  method: string;
  settlementAccountId?: string;
  label?: string;
  isEnabled?: boolean;
}

export interface RecordPaymentPayload {
  paymentAmountBase: number;
  paymentMethod?: string;
  settlementAccountId?: string;
  reference?: string;
  notes?: string;
  paymentDate?: string;
}

export interface RecordPaymentDialogProps {
  open: boolean;
  module: 'sales' | 'purchases';
  invoiceNumber: string;
  partyName?: string;
  currencyCode?: string;
  outstandingBase: number;
  paymentMethodConfigs?: RecordPaymentMethodConfig[];
  /** When true, an amount above outstanding is allowed (excess becomes a party credit). */
  allowOverpayment?: boolean;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (payload: RecordPaymentPayload) => Promise<void> | void;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const RecordPaymentDialog: React.FC<RecordPaymentDialogProps> = ({
  open,
  module,
  invoiceNumber,
  partyName,
  currencyCode,
  outstandingBase,
  paymentMethodConfigs,
  allowOverpayment = false,
  busy = false,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation('common');
  const isSales = module === 'sales';

  const methods = useMemo(
    () => (paymentMethodConfigs || []).filter((c) => c.isEnabled !== false),
    [paymentMethodConfigs],
  );
  const accountForMethod = (method: string) => methods.find((m) => m.method === method)?.settlementAccountId || '';

  const [amount, setAmount] = useState<number>(round2(outstandingBase));
  const [method, setMethod] = useState<string>(methods[0]?.method || 'CASH');
  const [settlementAccountId, setSettlementAccountId] = useState<string>(accountForMethod(methods[0]?.method || 'CASH'));
  const [paymentDate, setPaymentDate] = useState<string>(todayLocalIso());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // Reset to defaults whenever the dialog is (re)opened for an invoice.
  useEffect(() => {
    if (!open) return;
    const firstMethod = methods[0]?.method || 'CASH';
    setAmount(round2(outstandingBase));
    setMethod(firstMethod);
    setSettlementAccountId(accountForMethod(firstMethod));
    setPaymentDate(todayLocalIso());
    setReference('');
    setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outstandingBase]);

  if (!open) return null;

  const ccy = currencyCode ? ` ${currencyCode}` : '';
  const isOver = round2(amount) > round2(outstandingBase) + 0.01;
  const fieldLabel = 'text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400';

  const validity: { ok: boolean; message?: string } = (() => {
    if (!(Number(amount) > 0)) return { ok: false, message: t('recordPayment.validation.positiveAmount', 'Enter an amount greater than zero.') };
    if (!settlementAccountId) return { ok: false, message: t('recordPayment.validation.selectAccount', 'Select the cash/bank account.') };
    if (isOver && !allowOverpayment) {
      return { ok: false, message: t('recordPayment.validation.overpayment', 'Amount exceeds the outstanding balance. Turn on "Allow over-payment" in settings to record the excess as a party credit.') };
    }
    return { ok: true };
  })();

  const handleMethodChange = (next: string) => {
    setMethod(next);
    const mapped = accountForMethod(next);
    if (mapped) setSettlementAccountId(mapped);
  };

  const submit = async () => {
    if (!validity.ok || busy) return;
    await onSubmit({
      paymentAmountBase: round2(amount),
      paymentMethod: method || undefined,
      settlementAccountId: settlementAccountId || undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      paymentDate: paymentDate || undefined,
    });
  };

  const title = isSales ? t('recordPayment.titleReceipt', 'Record Receipt') : t('recordPayment.titlePayment', 'Record Payment');
  const contraLabel = isSales
    ? t('recordPayment.receivedInto', 'Received into (cash / bank)')
    : t('recordPayment.paidFrom', 'Paid from (cash / bank)');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">{title}</h3>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {invoiceNumber}{partyName ? ` · ${partyName}` : ''}
            </p>
          </div>
          <button type="button" onClick={() => !busy && onClose()} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/40">
            <span className="font-bold text-slate-500">{t('recordPayment.outstanding', 'Outstanding')}</span>
            <span className="font-mono font-black text-slate-900 dark:text-slate-100">{round2(outstandingBase).toFixed(2)}{ccy}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className={fieldLabel}>{t('recordPayment.amount', 'Amount')}{ccy}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-right font-mono text-sm font-bold text-slate-900 outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={amount}
                disabled={busy}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="min-w-0">
              <label className={fieldLabel}>{t('recordPayment.method', 'Method')}</label>
              <select
                className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={method}
                disabled={busy}
                onChange={(e) => handleMethodChange(e.target.value)}
              >
                {(methods.length ? methods : [{ method: 'CASH' }]).map((m) => (
                  <option key={m.method} value={m.method}>{(m as RecordPaymentMethodConfig).label || m.method}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-w-0">
            <label className={fieldLabel}>{contraLabel}</label>
            <AccountSelector
              value={settlementAccountId}
              placeholder={t('recordPayment.selectAccount', 'Select cash/bank account')}
              disabled={busy}
              onChange={(acc) => setSettlementAccountId(acc?.id || '')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className={fieldLabel}>{t('recordPayment.date', 'Date')}</label>
              <DatePicker
                value={paymentDate}
                onChange={(val) => setPaymentDate(val)}
              />
            </div>
            <div className="min-w-0">
              <label className={fieldLabel}>{t('recordPayment.reference', 'Reference')}</label>
              <input
                type="text"
                className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={reference}
                disabled={busy}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t('recordPayment.referencePlaceholder', 'Optional')}
              />
            </div>
          </div>

          <div className="min-w-0">
            <label className={fieldLabel}>{t('recordPayment.notes', 'Notes')}</label>
            <input
              type="text"
              className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={notes}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('recordPayment.notesPlaceholder', 'Optional')}
            />
          </div>

          {!validity.ok && (
            <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {validity.message}
            </div>
          )}
          {validity.ok && isOver && allowOverpayment && (
            <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              {t('recordPayment.overpaymentHint', 'The extra {{amount}} becomes a {{party}} credit.', {
                amount: round2(amount - outstandingBase).toFixed(2),
                party: isSales ? t('recordPayment.customer', 'customer') : t('recordPayment.vendor', 'vendor'),
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            disabled={busy}
          >
            {t('recordPayment.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={busy || !validity.ok}
          >
            {busy ? t('recordPayment.recording', 'Recording…') : t('recordPayment.record', 'Record')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordPaymentDialog;
