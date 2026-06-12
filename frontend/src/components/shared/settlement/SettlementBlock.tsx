/**
 * SettlementBlock — shared, reactive settlement control (Task 186 Part A).
 *
 * Two render variants from one component:
 *   - variant="editor"  → the editable control for the form HEADER
 *       (mode dropdown; Fully-paid = method + contra account, amount = full, no date;
 *        Multi payments = a floating modal grid of account/amount/type rows + "+").
 *   - variant="summary" → a read-only Outstanding / Recorded / Remaining strip for the RAIL,
 *        updating live from the same state.
 *
 * Controlled component: the host form feeds the selected party / currency / outstanding in
 * and the block emits the existing `settlementInput` shape via granular props, so it drops
 * into native SI/PI pages and designer forms without touching posting logic.
 * Contract: planning/tasks/186-shared-settlement-panel-and-overpayment.md (Part C).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountSelector } from '../../../modules/accounting/components/shared/AccountSelector';
import { todayLocalIso } from '../../../utils/dateUtils';

export type SettlementMode = 'DEFERRED' | 'CASH_FULL' | 'MULTI';

export interface SettlementRow {
  settlementAccountId: string;
  amountBase: number;
  paymentMethod: string;
  reference: string;
  notes: string;
  paymentDate: string;
}

export interface SettlementPaymentMethodConfig {
  method: string;
  settlementAccountId: string;
  label?: string;
  isEnabled?: boolean;
}

export interface SettlementValidity {
  ok: boolean;
  message?: string;
}

export interface SettlementBlockProps {
  /** "editor" = editable control (header); "summary" = read-only stats strip (rail). */
  variant?: 'editor' | 'summary';
  module: 'sales' | 'purchases';
  mode: SettlementMode;
  onModeChange?: (mode: SettlementMode) => void;
  rows: SettlementRow[];
  onRowsChange?: (rows: SettlementRow[]) => void;
  /** The party's AR (sales) / AP (purchases) account — the on-credit contra. */
  partyAccountId: string;
  /** Human label for the on-credit affected account (customer/vendor name). */
  partyAccountLabel?: string;
  /** Amount still to settle, base currency. */
  outstandingBase: number;
  /** Override for the "Recorded" stat (e.g. posted invoice's paid amount). Defaults to sum(rows). */
  recordedBase?: number;
  paymentMethodConfigs?: SettlementPaymentMethodConfig[];
  /** When true, recorded total may exceed outstanding (excess → party credit). */
  allowOverpayment?: boolean;
  readOnly?: boolean;
  /** Document currency code, for the amount label only. */
  currencyCode?: string;
  onValidityChange?: (v: SettlementValidity) => void;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const SettlementBlock: React.FC<SettlementBlockProps> = ({
  variant = 'editor',
  module,
  mode,
  onModeChange,
  rows,
  onRowsChange,
  partyAccountId,
  partyAccountLabel,
  outstandingBase,
  recordedBase,
  paymentMethodConfigs,
  allowOverpayment = false,
  readOnly = false,
  currencyCode,
  onValidityChange,
}) => {
  const { t } = useTranslation('common');
  const isSales = module === 'sales';
  const [modalOpen, setModalOpen] = useState(false);

  const methods = useMemo(
    () => (paymentMethodConfigs || []).filter((c) => c.isEnabled !== false),
    [paymentMethodConfigs],
  );
  const cashMethod = methods.find((m) => m.method === 'CASH')?.method || methods[0]?.method || 'CASH';
  const accountForMethod = (method: string) =>
    methods.find((m) => m.method === method)?.settlementAccountId || '';

  const newRow = (): SettlementRow => ({
    settlementAccountId: accountForMethod(cashMethod),
    amountBase: round2(outstandingBase),
    paymentMethod: cashMethod,
    reference: '',
    notes: '',
    paymentDate: todayLocalIso(),
  });

  const setRows = (next: SettlementRow[]) => onRowsChange?.(next);
  const setMode = (m: SettlementMode) => onModeChange?.(m);

  const handleModeChange = (next: SettlementMode) => {
    if (next === 'DEFERRED') {
      setRows([]);
      setModalOpen(false);
    } else if (next === 'CASH_FULL') {
      setRows([{ ...newRow(), amountBase: round2(outstandingBase) }]);
      setModalOpen(false);
    } else {
      setRows(rows.length ? rows : [newRow()]);
      setModalOpen(true);
    }
    setMode(next);
  };

  // Keep the single Fully-Paid row synced to the live outstanding amount.
  useEffect(() => {
    if (mode === 'CASH_FULL' && rows.length === 1 && round2(rows[0].amountBase) !== round2(outstandingBase)) {
      setRows([{ ...rows[0], amountBase: round2(outstandingBase) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outstandingBase, mode]);

  const updateRow = (idx: number, patch: Partial<SettlementRow>) => {
    setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  // Method drives the contra account.
  const handleMethodChange = (idx: number, method: string) => {
    updateRow(idx, {
      paymentMethod: method,
      settlementAccountId: accountForMethod(method) || rows[idx].settlementAccountId,
    });
  };

  const recordedTotal = round2(rows.reduce((s, r) => s + (Number(r.amountBase) || 0), 0));
  const recorded = recordedBase !== undefined ? round2(recordedBase) : recordedTotal;
  const remaining = round2(outstandingBase - recorded);
  const isOver = recordedTotal > round2(outstandingBase) + 0.01;

  const validity: SettlementValidity = useMemo(() => {
    if (mode === 'DEFERRED') return { ok: true };
    if (rows.length === 0) return { ok: false, message: t('settlement.validation.noPayments', 'Add at least one payment.') };
    for (const r of rows) {
      if (!r.settlementAccountId) return { ok: false, message: t('settlement.validation.selectAccount', 'Select the cash/bank account that receives the payment.') };
      if (!(Number(r.amountBase) > 0)) return { ok: false, message: t('settlement.validation.positiveAmount', 'Each payment amount must be greater than zero.') };
    }
    if (isOver && !allowOverpayment) {
      return { ok: false, message: t('settlement.validation.overpayment', 'Total exceeds the outstanding amount. Turn on "Allow over-payment" in settings to record the excess as a party credit.') };
    }
    return { ok: true };
  }, [mode, rows, isOver, allowOverpayment]);

  useEffect(() => {
    onValidityChange?.(validity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validity.ok, validity.message]);

  const modeTag = mode === 'DEFERRED'
    ? t('settlement.mode.onCredit', 'On credit')
    : mode === 'CASH_FULL'
      ? t('settlement.mode.fullyPaid', 'Fully paid')
      : t('settlement.mode.multiPayments', 'Multi payments');
  const contraLabel = mode === 'DEFERRED'
    ? (isSales ? t('settlement.contra.ar', 'Affected account (A/R)') : t('settlement.contra.ap', 'Affected account (A/P)'))
    : t('settlement.contra.contra', 'Contra account');
  const affectedText = partyAccountLabel || partyAccountId || (isSales ? t('settlement.contra.customerReceivable', 'Customer receivable') : t('settlement.contra.vendorPayable', 'Vendor payable'));
  const ccy = currencyCode ? ` ${currencyCode}` : '';
  const fieldLabelClass = 'text-[9px] font-bold text-slate-950 dark:text-slate-100';
  const uppercaseFieldLabelClass = 'text-[9px] font-black uppercase text-slate-950 dark:text-slate-100';
  const headerNotice =
    mode === 'DEFERRED'
      ? null
      : !validity.ok
        ? { tone: 'error' as const, text: validity.message || t('settlement.validation.needsAttention', 'Settlement needs attention.') }
        : isOver && allowOverpayment
          ? {
              tone: 'warning' as const,
              text: t('settlement.overpayment.text', 'Over-payment: extra {amount} becomes {party} credit.', {
                amount: Math.abs(round2(recordedTotal - outstandingBase)).toFixed(2),
                party: isSales ? t('settlement.overpayment.customer', 'customer') : t('settlement.overpayment.vendor', 'vendor'),
              }),
            }
          : null;

  // ─── Summary variant (rail) ───────────────────────────────────────────────
  if (variant === 'summary') {
    return (
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5 dark:border-slate-800">
          <h3 className="text-[10px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{t('settlement.title', 'Settlement')}</h3>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${mode === 'DEFERRED' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>{modeTag}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-2 text-[11px]">
          {[
            { l: t('settlement.stat.outstanding', 'Outstanding'), v: round2(outstandingBase).toFixed(2), c: 'text-slate-900 dark:text-slate-100' },
            { l: t('settlement.stat.recorded', 'Recorded'), v: recorded.toFixed(2), c: 'text-emerald-700 dark:text-emerald-300' },
            { l: isOver ? t('settlement.stat.overpaid', 'Over-paid') : t('settlement.stat.remaining', 'Remaining'), v: Math.abs(remaining).toFixed(2), c: isOver ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100' },
          ].map((s) => (
            <div key={s.l} className="rounded border border-slate-100 bg-slate-50/70 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{s.l}</div>
              <div className={`truncate font-mono font-black ${s.c}`}>{s.v}</div>
            </div>
          ))}
          <div className="col-span-3 rounded border border-slate-200 px-2 py-1 dark:border-slate-800">
            <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{contraLabel}</div>
            <div className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">{affectedText}</div>
          </div>
        </div>
      </section>
    );
  }

  // ─── Editor variant (header) ──────────────────────────────────────────────
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800 md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{t('settlement.title', 'Settlement')}</h3>
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${mode === 'DEFERRED' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>{modeTag}</span>
        </div>
        <div className="min-w-0">
          {headerNotice && (
            <div
              title={headerNotice.text}
              className={`truncate rounded border px-2 py-0.5 text-[10px] font-bold ${
                headerNotice.tone === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
              }`}
            >
              {headerNotice.text}
            </div>
          )}
        </div>
          <select
            className="h-8 w-full min-w-[13.5rem] rounded border border-slate-300 bg-white px-2 pr-8 text-xs outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:w-56"
            value={mode}
            disabled={readOnly}
            onChange={(e) => handleModeChange(e.target.value as SettlementMode)}
          >
            <option value="DEFERRED">{t('settlement.mode.deferredWithNoPayment', 'On credit (no payment)')}</option>
            <option value="CASH_FULL">{t('settlement.mode.fullyPaid', 'Fully paid')}</option>
            <option value="MULTI">{t('settlement.mode.multiPayments', 'Multi payments')}</option>
          </select>
      </div>

      <div className="space-y-2 p-3">
        {/* On credit */}
        {mode === 'DEFERRED' && (
          <div className="rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
            <div className={uppercaseFieldLabelClass}>{contraLabel}</div>
            <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{affectedText}</div>
          </div>
        )}

        {/* Fully paid — method + contra account, amount = full, no date */}
        {mode === 'CASH_FULL' && rows[0] && (
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <label className={fieldLabelClass}>{t('settlement.field.method', 'Method')}</label>
              <select
                className="h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={rows[0].paymentMethod}
                disabled={readOnly}
                onChange={(e) => handleMethodChange(0, e.target.value)}
              >
                {(methods.length ? methods : [{ method: 'CASH', settlementAccountId: '' }]).map((m) => (
                  <option key={m.method} value={m.method}>{(m as any).label || m.method}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className={fieldLabelClass}>{t('settlement.field.amountFull', 'Amount (full)')}{ccy}</label>
              <div className="flex h-9 items-center justify-end rounded border border-slate-200 bg-slate-50 px-2 text-right font-mono text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                {round2(outstandingBase).toFixed(2)}
              </div>
            </div>
            <div className="min-w-0">
              <label className={fieldLabelClass}>{contraLabel} ({t('settlement.field.cashBank', 'cash / bank')})</label>
              <AccountSelector
                value={rows[0].settlementAccountId}
                placeholder={t('settlement.field.selectAccount', 'Select cash/bank account')}
                disabled={readOnly}
                onChange={(acc) => updateRow(0, { settlementAccountId: acc?.id || '' })}
              />
            </div>
          </div>
        )}

        {/* Multi payments — compact summary + open modal */}
        {mode === 'MULTI' && (
          <div className="flex items-center justify-between rounded border border-slate-200 px-2 py-1.5 dark:border-slate-800">
            <div className="text-[11px] text-slate-600 dark:text-slate-300">
              <span className="font-black text-slate-900 dark:text-slate-100">{rows.length}</span>{' '}{t('settlement.field.paymentCount', { defaultValue: 'payment', count: rows.length })}
              <span className="mx-1 text-slate-300">·</span>
              {t('settlement.field.recordedOf', { defaultValue: 'recorded {amount} of {total}', amount: recordedTotal.toFixed(2), total: round2(outstandingBase).toFixed(2) })}
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {t('settlement.field.editPayments', 'Edit payments')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Multi payments floating modal */}
      {mode === 'MULTI' && modalOpen && !readOnly && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">{t('settlement.field.multiPayments', 'Multi payments')}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-y-auto p-3">
              {rows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 items-end gap-2 rounded border border-slate-200 p-2 dark:border-slate-800">
                  <div className="col-span-6">
                    <label className={fieldLabelClass}>{t('settlement.field.accountCashBank', 'Account (cash / bank)')}</label>
                    <AccountSelector
                      value={row.settlementAccountId}
                      placeholder={t('settlement.field.selectAccount', 'Select cash/bank account')}
                      onChange={(acc) => updateRow(idx, { settlementAccountId: acc?.id || '' })}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className={fieldLabelClass}>{t('settlement.field.amount', 'Amount')}{ccy}</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                      value={row.amountBase}
                      onChange={(e) => updateRow(idx, { amountBase: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={fieldLabelClass}>{t('settlement.field.type', 'Type')}</label>
                    <select
                      className="w-full rounded border border-slate-300 bg-white px-1 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      value={row.paymentMethod}
                      onChange={(e) => handleMethodChange(idx, e.target.value)}
                    >
                      {(methods.length ? methods : [{ method: 'CASH', settlementAccountId: '' }]).map((m) => (
                        <option key={m.method} value={m.method}>{(m as any).label || m.method}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-center pb-1">
                    {rows.length > 1 && (
                      <button type="button" title={t('settlement.field.remove', 'Remove')} className="text-rose-600 hover:text-rose-800" onClick={() => setRows(rows.filter((_, i) => i !== idx))}>✕</button>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setRows([...rows, newRow()])}
                className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-slate-300 bg-white py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {t('settlement.field.addPayment', '+ Add payment')}
              </button>
            </div>

            <div className="space-y-1.5 border-t border-slate-200 px-4 py-2.5 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span>{t('settlement.field.recordedOf', { defaultValue: 'Recorded {amount} of {total}', amount: recordedTotal.toFixed(2), total: round2(outstandingBase).toFixed(2) })}</span>
                <span className={isOver ? 'text-amber-700 dark:text-amber-300' : ''}>{isOver ? t('settlement.field.overpaid', 'Over-paid') : t('settlement.field.remaining', 'Remaining')} <span className="font-mono font-black">{Math.abs(round2(outstandingBase - recordedTotal)).toFixed(2)}</span></span>
              </div>
              {!validity.ok && <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{validity.message}</div>}
              {validity.ok && isOver && allowOverpayment && <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">{isSales ? t('settlement.field.extraBecomesCustomerCredit', 'The extra becomes a credit on the customer account.') : t('settlement.field.extraBecomesVendorCredit', 'The extra becomes a credit on the vendor account.')}</div>}
              <div className="flex justify-end">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900">{t('settlement.field.done', 'Done')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default SettlementBlock;
