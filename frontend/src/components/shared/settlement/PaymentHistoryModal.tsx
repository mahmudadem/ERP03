/**
 * PaymentHistoryModal — read-only list of payments recorded against an invoice.
 *
 * Reads the existing `getPaymentHistory` endpoint (Sales/Purchases) and shows each
 * PaymentHistory row (date, method, reference, amount, linked voucher). Complements
 * RecordPaymentDialog: record a payment, then see it reconciled here. Read-only — the
 * money facts live in the ledger; this is a window onto them.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface PaymentHistoryModalProps {
  open: boolean;
  invoiceNumber: string;
  currencyCode?: string;
  fetchPayments: () => Promise<Record<string, unknown>[]>;
  onClose: () => void;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  open,
  invoiceNumber,
  currencyCode,
  fetchPayments,
  onClose,
}) => {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPayments()
      .then((data) => { if (!cancelled) setRows(Array.isArray(data) ? data : []); })
      .catch((err: any) => { if (!cancelled) setError(err?.response?.data?.error?.message || err?.message || t('paymentHistory.loadFailed', 'Failed to load payments.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const totalPaid = round2(rows.reduce((s, r) => s + (Number(r.amountDoc ?? r.amountBase) || 0), 0));
  const ccy = currencyCode ? ` ${currencyCode}` : '';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">{t('paymentHistory.title', 'Payment History')}</h3>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{invoiceNumber}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {loading ? (
            <div className="py-10 text-center text-xs text-slate-500">{t('paymentHistory.loading', 'Loading…')}</div>
          ) : error ? (
            <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">{t('paymentHistory.empty', 'No payments recorded yet.')}</div>
          ) : (
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] font-black uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  <th className="px-2 py-1.5">{t('paymentHistory.date', 'Date')}</th>
                  <th className="px-2 py-1.5">{t('paymentHistory.method', 'Method')}</th>
                  <th className="px-2 py-1.5">{t('paymentHistory.reference', 'Reference')}</th>
                  <th className="px-2 py-1.5 text-right">{t('paymentHistory.amount', 'Amount')}</th>
                  <th className="px-2 py-1.5 text-center">{t('paymentHistory.voucher', 'Voucher')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r, i) => (
                  <tr key={String(r.id ?? i)} className="text-slate-700 dark:text-slate-200">
                    <td className="px-2 py-1.5">{String(r.paymentDate ?? '—')}</td>
                    <td className="px-2 py-1.5">{String(r.paymentMethod ?? '—')}</td>
                    <td className="px-2 py-1.5 truncate">{String(r.reference ?? '') || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold">{round2(Number(r.amountDoc ?? r.amountBase)).toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-center">
                      {r.voucherId ? <span className="text-emerald-600 dark:text-emerald-400" title={String(r.voucherId)}>✓</span> : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-xs dark:border-slate-800">
            <span className="font-bold text-slate-500">{t('paymentHistory.totalPaid', 'Total paid')}</span>
            <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">{totalPaid.toFixed(2)}{ccy}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentHistoryModal;
