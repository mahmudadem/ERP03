/**
 * DocumentChargesAllocation
 *
 * Shared presentational UI for the whole-document "Account Ledger & Taxes
 * Allocation Grid" used by both the Sales Invoice and Purchase Invoice detail
 * pages. The two pages previously carried ~400 duplicated lines of identical
 * grid + modal markup; the only real differences are i18n namespace, GL-account
 * classifications, and a couple of context labels. Those are props here.
 *
 * Boundary: this component is purely presentational. It owns NO charge state,
 * NO totals math, and NO posting logic — pages pass already-resolved display
 * rows (account label + base amount computed by the page) and the modal state,
 * and receive callbacks. Keeping the math/state in the pages preserves the
 * exact posting behaviour shipped in reports 209 (SI) and 210 (PI).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  DocumentSecondaryPanel,
  DocumentEmptyPanel,
} from './DocumentDetailScaffold';
import {
  AccountSelector,
  AccountClassification,
} from '../../modules/accounting/components/shared/AccountSelector';

/** Editable state of the single Add/Edit Charge-or-Discount modal. */
export interface ChargeModalState {
  kind: 'CHARGE' | 'DISCOUNT';
  /** null = creating a new row; otherwise the index being edited. */
  editIndex: number | null;
  accountId: string;
  /** Display label ("CODE — Name") for the picked account; not sent to the API. */
  accountLabel: string;
  amount: number;
  description: string;
}

/** A display-ready allocation row. The page resolves the account label and the
 *  base-currency amount before handing rows to the grid. */
export interface ChargeAllocationRow {
  /** Stable React key (the page's chargeId, falling back to the row index). */
  key: string;
  kind?: 'CHARGE' | 'DISCOUNT';
  name: string;
  accountLabel: string;
  amountDoc: number;
  amountBase: number;
}

interface DocumentChargesAllocationProps {
  /** i18n key prefix, e.g. 'sales.invoiceDetail' or 'purchases.invoiceDetail'. */
  tns: string;
  rows: ChargeAllocationRow[];
  currency: string;
  baseCurrency: string;
  showBase: boolean;
  isReadOnly: boolean;
  busy: boolean;
  onAddCharge: () => void;
  onAddDiscount: () => void;
  onEditRow: (index: number) => void;
  onRemoveRow: (index: number) => void;
}

export const DocumentChargesAllocation: React.FC<DocumentChargesAllocationProps> = ({
  tns,
  rows,
  currency,
  baseCurrency,
  showBase,
  isReadOnly,
  busy,
  onAddCharge,
  onAddDiscount,
  onEditRow,
  onRemoveRow,
}) => {
  const { t } = useTranslation('common');
  const hasCharges = rows.length > 0;

  return (
    <DocumentSecondaryPanel
      title={t(`${tns}.allocation.title`, 'Account Ledger & Taxes Allocation Grid')}
      action={
        !isReadOnly ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onAddCharge}
              disabled={busy}
              className="inline-flex h-6 items-center gap-1 rounded border border-emerald-300 px-2 text-[10px] font-black uppercase tracking-wide text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              <Plus className="h-3 w-3" />
              {t(`${tns}.charges.addCharge`, 'Add Charge')}
            </button>
            <button
              type="button"
              onClick={onAddDiscount}
              disabled={busy}
              className="inline-flex h-6 items-center gap-1 rounded border border-rose-300 px-2 text-[10px] font-black uppercase tracking-wide text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              <Plus className="h-3 w-3" />
              {t(`${tns}.charges.addDiscount`, 'Add Discount')}
            </button>
          </div>
        ) : undefined
      }
    >
      {!hasCharges ? (
        <DocumentEmptyPanel
          title={t(`${tns}.allocation.emptyTitle`, 'No allocation rows')}
          description={
            isReadOnly
              ? t(`${tns}.charges.emptyReadOnly`, 'This document has no whole-invoice charges or discounts.')
              : t(`${tns}.charges.emptyDescription`, 'Use Add Charge or Add Discount to apply a whole-invoice charge (e.g. freight) or discount. Each posts to its own GL account and adjusts the totals.')
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                <th className="px-2 py-1.5 text-left font-black">{t(`${tns}.charges.col.type`, 'Type')}</th>
                <th className="px-2 py-1.5 text-left font-black">{t(`${tns}.charges.col.description`, 'Description')}</th>
                <th className="px-2 py-1.5 text-left font-black">{t(`${tns}.charges.col.account`, 'GL Account')}</th>
                <th className="px-2 py-1.5 text-right font-black">{t(`${tns}.charges.col.amount`, 'Amount')} ({currency})</th>
                {!isReadOnly && <th className="w-16 px-1 py-1.5" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isDiscount = row.kind === 'DISCOUNT';
                return (
                  <tr key={row.key} className="border-b border-slate-100 align-middle dark:border-slate-800/60">
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                          isDiscount
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        }`}
                      >
                        {isDiscount ? t(`${tns}.charges.discount`, 'Discount') : t(`${tns}.charges.charge`, 'Charge')}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-semibold text-slate-800 dark:text-slate-200">{row.name || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{row.accountLabel}</td>
                    <td className="px-2 py-1.5 text-right">
                      <span className={`font-mono font-bold ${isDiscount ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {isDiscount ? '−' : ''}{(row.amountDoc || 0).toFixed(2)}
                      </span>
                      {showBase && (
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {isDiscount ? '−' : ''}{baseCurrency} {(row.amountBase || 0).toFixed(2)}
                        </div>
                      )}
                    </td>
                    {!isReadOnly && (
                      <td className="px-1 py-1.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => onEditRow(index)}
                            disabled={busy}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800"
                            aria-label={t(`${tns}.charges.edit`, 'Edit')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveRow(index)}
                            disabled={busy}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/40"
                            aria-label={t(`${tns}.charges.remove`, 'Remove')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DocumentSecondaryPanel>
  );
};

interface DocumentChargeModalProps {
  /** i18n key prefix, e.g. 'sales.invoiceDetail' or 'purchases.invoiceDetail'. */
  tns: string;
  state: ChargeModalState | null;
  currency: string;
  /** GL classifications offered when adding a CHARGE row. */
  chargeClassifications: AccountClassification[];
  /** GL classifications offered when adding a DISCOUNT row. */
  discountClassifications: AccountClassification[];
  chargeContextLabel: string;
  discountContextLabel: string;
  onChange: React.Dispatch<React.SetStateAction<ChargeModalState | null>>;
  onClose: () => void;
  onSave: () => void;
}

export const DocumentChargeModal: React.FC<DocumentChargeModalProps> = ({
  tns,
  state,
  currency,
  chargeClassifications,
  discountClassifications,
  chargeContextLabel,
  discountContextLabel,
  onChange,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation('common');
  if (!state) return null;
  const isDiscount = state.kind === 'DISCOUNT';
  const canSave = state.description.trim().length > 0 && (state.amount || 0) > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between border-b px-4 py-3 ${isDiscount ? 'border-rose-200 dark:border-rose-900' : 'border-emerald-200 dark:border-emerald-900'}`}>
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">
            {state.editIndex !== null
              ? (isDiscount ? t(`${tns}.charges.editDiscount`, 'Edit Discount') : t(`${tns}.charges.editCharge`, 'Edit Charge'))
              : (isDiscount ? t(`${tns}.charges.addDiscount`, 'Add Discount') : t(`${tns}.charges.addCharge`, 'Add Charge'))}
          </h3>
          <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${isDiscount ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>
            {isDiscount ? t(`${tns}.charges.discount`, 'Discount') : t(`${tns}.charges.charge`, 'Charge')}
          </span>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t(`${tns}.charges.modal.account`, 'GL Account')}
            </label>
            <AccountSelector
              value={state.accountId || undefined}
              onChange={(account: any) =>
                onChange((prev) => prev ? { ...prev, accountId: account?.id || '', accountLabel: account ? `${account.code} — ${account.name}` : '' } : prev)
              }
              placeholder={isDiscount
                ? t(`${tns}.charges.modal.discountAccountPlaceholder`, 'Discount account')
                : t(`${tns}.charges.modal.chargeAccountPlaceholder`, 'Charge account')}
              allowedClassifications={isDiscount ? discountClassifications : chargeClassifications}
              contextLabel={isDiscount ? discountContextLabel : chargeContextLabel}
            />
            <p className="mt-1 text-[10px] text-slate-400">
              {t(`${tns}.charges.modal.accountHint`, 'Charge and discount each post to their own GL account.')}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t(`${tns}.charges.modal.amount`, 'Amount')} ({currency})
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              value={state.amount || ''}
              onChange={(e) => onChange((prev) => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : prev)}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-right font-mono text-sm text-slate-800 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t(`${tns}.charges.modal.description`, 'Description')}
            </label>
            <input
              type="text"
              value={state.description}
              onChange={(e) => onChange((prev) => prev ? { ...prev, description: e.target.value } : prev)}
              placeholder={isDiscount
                ? t(`${tns}.charges.modal.discountDescPlaceholder`, 'e.g. Year-end discount')
                : t(`${tns}.charges.modal.chargeDescPlaceholder`, 'e.g. Freight')}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className={`rounded px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white disabled:opacity-40 ${isDiscount ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
};
