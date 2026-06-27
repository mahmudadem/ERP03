/**
 * PosReturnPage.tsx — Process returns against a completed receipt.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { ManagerOverrideCapture, ManagerOverrideValue } from '../components/ManagerOverrideCapture';
import { useConfirm as useConfirmHook } from '../../../hooks/useConfirm';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition } from '../../../components/ui/DataTable';
import { Spinner } from '../../../components/ui/Spinner';
import { posApi } from '../../../api/posApi';
import { errorHandler } from '../../../services/errorHandler';
import { useAuth } from '../../../context/AuthContext';
import { Minus, Plus, RefreshCcw, Search, ShoppingCart, Trash2, Undo2, Receipt } from 'lucide-react';

interface Props { isWindow?: boolean }

interface ReceiptLineView {
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  returnedQty: number;
  returnQty: number;
}

interface ExchangeSaleLineView {
  itemId: string;
  itemCode: string;
  itemName: string;
  uom?: string;
  qty: number;
  unitPrice: number;
  taxCodeId?: string;
}

const PosReturnPage: React.FC<Props> = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { confirm: confirmDialog } = useConfirmHook();
  void confirmDialog; // reserved for future confirmation patterns
  const [mode, setMode] = useState<'RETURN' | 'EXCHANGE'>('RETURN');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receipt, setReceipt] = useState<any | null>(null);
  const [lines, setLines] = useState<ReceiptLineView[]>([]);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM'>('CASH');
  const [replacementLines, setReplacementLines] = useState<ExchangeSaleLineView[]>([]);
  const [replacementSearch, setReplacementSearch] = useState('');
  const [replacementResults, setReplacementResults] = useState<any[]>([]);
  const [replacementSearching, setReplacementSearching] = useState(false);
  const [replacementPaymentMethod, setReplacementPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM'>('CASH');
  const [replacementPaymentRef, setReplacementPaymentRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [returns, setReturns] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showExchangeConfirm, setShowExchangeConfirm] = useState(false);
  const [bootstrap, setBootstrap] = useState<any | null>(null);
  const [managerOverride, setManagerOverride] = useState<ManagerOverrideValue | null>(null);
  const [showManagerOverride, setShowManagerOverride] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [list, bs] = await Promise.all([
          posApi.listReturns({ limit: 50 }).catch(() => []),
          posApi.getBootstrap({ cashierUserId: user?.uid || '' }),
        ]);
        setReturns((list as any) || []);
        setBootstrap(bs);
      } catch (err) {
        console.error('Failed to load returns', err);
      }
    };
    void load();
  }, [user?.uid]);

  const onLookup = async () => {
    if (!receiptNumber.trim()) {
      toast.error(t('pos:return.enterReceipt', { defaultValue: 'Enter a receipt number.' }));
      return;
    }
    try {
      setLoading(true);
      // For V1 the controller doesn't expose /receipts/by-number; the cashier
      // types the ID directly. We accept the receipt id (last 8 chars work fine).
      const result = await posApi.getReceipt(receiptNumber.trim());
      const data = (result as any).receipt;
      setReceipt(data);
      setLines(data.lines.map((l: any) => ({
        ...l,
        returnedQty: 0,
        returnQty: 0,
      })));
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Receipt not found.');
      setReceipt(null);
      setLines([]);
    } finally {
      setLoading(false);
    }
  };

  const total = lines.reduce((s, l) => s + l.returnQty * l.unitPrice, 0);
  const replacementTotal = replacementLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const netExchange = replacementTotal - total;
  const netDueFromCustomer = Math.max(0, netExchange);
  const netRefundToCustomer = Math.max(0, -netExchange);
  const enabledMethods = ((bootstrap?.settings?.paymentMethods || []) as Array<{ code: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM'; isEnabled: boolean }>)
    .filter((method) => method.isEnabled)
    .map((method) => method.code);
  const paymentMethods = enabledMethods.length ? enabledMethods : ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'];

  const onSubmit = async () => {
    if (!receipt) return;
    const returnLines = lines.filter((l) => l.returnQty > 0);
    if (returnLines.length === 0) {
      toast.error(t('pos:return.noLines', { defaultValue: 'Pick at least one line to return.' }));
      return;
    }
    const openShift = bootstrap?.openShift;
    const register = bootstrap?.register;
    if (!openShift || !register) {
      toast.error(t('pos:return.needOpenShift', { defaultValue: 'No open shift for this register.' }));
      return;
    }
    try {
      setSubmitting(true);
      const result = await posApi.completeReturn({
        originalReceiptId: receipt.id,
        registerId: register.id,
        shiftId: openShift.id,
        lines: returnLines.map((l) => ({ itemId: l.itemId, qty: l.returnQty })),
        refundMethod,
        managerOverrideId: managerOverride?.managerOverrideId,
      });
      toast.success(t('pos:return.completed', {
        defaultValue: 'Return posted. Refund: {{amount}}.',
      }).replace('{{amount}}', String((result as any).refundTotal || 0)));
      setReceipt(null);
      setLines([]);
      setReceiptNumber('');
      // Reload history
      const list = await posApi.listReturns({ limit: 50 }).catch(() => []);
      setReturns((list as any) || []);
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to post return.');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const onSearchReplacement = async () => {
    const q = replacementSearch.trim();
    if (!q) {
      toast.error(t('pos:exchange.enterItem', { defaultValue: 'Enter an item code or name.' }));
      return;
    }
    try {
      setReplacementSearching(true);
      const result = await posApi.searchProducts(q, 20);
      setReplacementResults(result.items || []);
      if (!result.items?.length) {
        toast(t('pos:exchange.noItems', { defaultValue: 'No matching items.' }), { icon: 'ℹ️' });
      }
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to search POS items.');
    } finally {
      setReplacementSearching(false);
    }
  };

  const addReplacementLine = (item: any) => {
    const unitPrice = Number(item.salePrice || 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      toast.error(t('pos:exchange.priceRequired', { defaultValue: 'Set a sale price for this item before using it as a replacement.' }));
      return;
    }
    setReplacementLines((prev) => {
      const existing = prev.find((line) => line.itemId === item.id);
      if (existing) {
        return prev.map((line) => line.itemId === item.id ? { ...line, qty: line.qty + 1 } : line);
      }
      return [
        ...prev,
        {
          itemId: item.id,
          itemCode: item.code || '',
          itemName: item.name || '',
          uom: item.uom || item.unitOfMeasure || '',
          qty: 1,
          unitPrice,
          taxCodeId: item.taxCodeId,
        },
      ];
    });
    setReplacementSearch('');
    setReplacementResults([]);
  };

  const updateReplacementLine = (itemId: string, patch: Partial<ExchangeSaleLineView>) => {
    setReplacementLines((prev) =>
      prev.map((line) => line.itemId === itemId ? { ...line, ...patch } : line)
    );
  };

  const removeReplacementLine = (itemId: string) => {
    setReplacementLines((prev) => prev.filter((line) => line.itemId !== itemId));
  };

  const onSubmitExchange = async () => {
    if (!receipt) return;
    const returnLines = lines.filter((l) => l.returnQty > 0);
    if (returnLines.length === 0) {
      toast.error(t('pos:exchange.noReturnLines', { defaultValue: 'Pick at least one line to return for the exchange.' }));
      return;
    }
    if (replacementLines.length === 0) {
      toast.error(t('pos:exchange.noReplacementLines', { defaultValue: 'Add at least one replacement item.' }));
      return;
    }
    const openShift = bootstrap?.openShift;
    const register = bootstrap?.register;
    if (!openShift || !register) {
      toast.error(t('pos:return.needOpenShift', { defaultValue: 'No open shift for this register.' }));
      return;
    }
    try {
      setSubmitting(true);
      const result = await posApi.completeExchange({
        originalReceiptId: receipt.id,
        registerId: register.id,
        shiftId: openShift.id,
        customerId: receipt.customerId,
        returnLines: returnLines.map((l) => ({ itemId: l.itemId, qty: l.returnQty })),
        saleLines: replacementLines.map((l) => ({
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          uom: l.uom,
          qty: l.qty,
          unitPrice: l.unitPrice,
          taxCodeId: l.taxCodeId,
        })),
        salePayments: [{
          method: replacementPaymentMethod,
          amount: Number(replacementTotal.toFixed(2)),
          reference: replacementPaymentRef.trim() || undefined,
        }],
        refundMethod,
        reason: 'POS exchange',
        managerOverrideId: managerOverride?.managerOverrideId,
      });
      const due = Number((result as any).netDueFromCustomer || 0);
      const refund = Number((result as any).netRefundToCustomer || 0);
      toast.success(t('pos:exchange.completed', {
        defaultValue: 'Exchange posted. Due: {{due}}, refund: {{refund}}.',
      }).replace('{{due}}', due.toFixed(2)).replace('{{refund}}', refund.toFixed(2)));
      setReceipt(null);
      setLines([]);
      setReceiptNumber('');
      setManagerOverride(null);
      setReplacementLines([]);
      setReplacementResults([]);
      setReplacementSearch('');
      setReplacementPaymentRef('');
      const list = await posApi.listReturns({ limit: 50 }).catch(() => []);
      setReturns((list as any) || []);
    } catch (err: any) {
      errorHandler.showError(err?.response?.data?.error?.message || err?.message || 'Failed to post exchange.');
    } finally {
      setSubmitting(false);
      setShowExchangeConfirm(false);
    }
  };

  const returnColumns: ColumnDefinition<any>[] = [
    { key: 'returnNumber', label: t('pos:return.col.number', { defaultValue: 'Return # '}), width: '160px', priority: 1, accessor: (r) => r.returnNumber },
    { key: 'originalReceiptNumber', label: t('pos:return.col.original', { defaultValue: 'Original receipt' }), width: '160px', priority: 1, accessor: (r) => r.originalReceiptNumber },
    { key: 'refundMethod', label: t('pos:return.col.method', { defaultValue: 'Refund method' }), width: '120px', priority: 1, accessor: (r) => r.refundMethod },
    { key: 'refundTotal', label: t('pos:return.col.amount', { defaultValue: 'Refund' }), width: '120px', priority: 1, accessor: (r) => Number(r.refundTotal || 0).toFixed(2) },
    { key: 'salesReturnNumber', label: t('pos:return.col.sr', { defaultValue: 'Sales Return #' }), width: '160px', priority: 1, accessor: (r) => r.salesReturnNumber || '—' },
    { key: 'createdAt', label: t('pos:return.col.date', { defaultValue: 'Date' }), width: '160px', priority: 2, accessor: (r) => new Date(r.createdAt).toLocaleString() },
  ];

  return (
    <div className="p-6 space-y-4">
      <Card>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-indigo-600" /> {t('pos:return.title', { defaultValue: 'Process return' })}
            </h2>
            <div className="inline-flex rounded border border-slate-300 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode('RETURN')}
                className={`rounded px-3 py-1 ${mode === 'RETURN' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t('pos:return.modeReturn', { defaultValue: 'Return' })}
              </button>
              <button
                type="button"
                onClick={() => setMode('EXCHANGE')}
                className={`rounded px-3 py-1 ${mode === 'EXCHANGE' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t('pos:return.modeExchange', { defaultValue: 'Exchange' })}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder={t('pos:return.receiptPlaceholder', { defaultValue: 'Receipt number or ID' })}
              className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              onClick={onLookup}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
            >
              {loading ? <Spinner size="sm" variant="white" /> : <Search className="w-4 h-4" />}
              {t('pos:return.lookup', { defaultValue: 'Look up' })}
            </button>
          </div>
          {receipt && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                <Receipt className="inline w-3.5 h-3.5 mr-1" />
                {t('pos:return.receiptFor', { defaultValue: 'Receipt' })}: <span className="font-mono">{receipt.receiptNumber}</span> — {t('pos:return.si', { defaultValue: 'SI' })}: <span className="font-mono">{receipt.salesInvoiceNumber}</span>
              </div>
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="py-2 px-2">{t('pos:return.item', { defaultValue: 'Item' })}</th>
                      <th className="py-2 px-2 text-right">{t('pos:return.sold', { defaultValue: 'Sold' })}</th>
                      <th className="py-2 px-2 text-right">{t('pos:return.return', { defaultValue: 'Return' })}</th>
                      <th className="py-2 px-2 text-right">{t('pos:return.price', { defaultValue: 'Price' })}</th>
                      <th className="py-2 px-2 text-right">{t('pos:return.lineTotal', { defaultValue: 'Line total' })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.itemId} className="border-b last:border-b-0">
                        <td className="py-1.5 px-2">
                          <div className="text-sm">{l.itemName}</div>
                          <div className="text-xs text-slate-500">{l.itemCode}</div>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">{l.qty}</td>
                        <td className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max={l.qty}
                            step="0.001"
                            value={l.returnQty}
                            onChange={(e) => {
                              const next = Math.min(Number(e.target.value) || 0, l.qty);
                              setLines((prev) => prev.map((p, j) => j === i ? { ...p, returnQty: next } : p));
                            }}
                            className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-sm text-right"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">{l.unitPrice.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{(l.returnQty * l.unitPrice).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between text-sm pt-2">
                <span>{t('pos:return.refundMethod', { defaultValue: 'Refund method' })}:</span>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as any)}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="CASH">{t('pos:return.payment.cash', { defaultValue: 'Cash' })}</option>
                  <option value="CARD">{t('pos:return.payment.card', { defaultValue: 'Card' })}</option>
                  <option value="BANK_TRANSFER">{t(`BANK_TRANSFER`)}</option>
                  <option value="CUSTOM">{t('pos:return.payment.custom', { defaultValue: 'Custom' })}</option>
                </select>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>{t('pos:return.total', { defaultValue: 'Refund total' })}:</span>
                <span className="font-mono">{total.toFixed(2)}</span>
              </div>
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-amber-900">
                    {managerOverride
                      ? t('pos:managerOverride.attached', { defaultValue: 'Approval attached: {{id}}' }).replace('{{id}}', managerOverride.managerOverrideId)
                      : t('pos:managerOverride.returnHelp', { defaultValue: 'Capture manager approval if the cashier role requires approval for returns or exchanges.' })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManagerOverride(true)}
                    className="rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer"
                  >
                    {managerOverride
                      ? t('pos:managerOverride.replace', { defaultValue: 'Replace approval' })
                      : t('pos:managerOverride.capture', { defaultValue: 'Capture approval' })}
                  </button>
                </div>
              </div>
              {mode === 'EXCHANGE' && (
                <div className="space-y-3 rounded border border-indigo-100 bg-indigo-50/40 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <RefreshCcw className="h-4 w-4 text-indigo-600" />
                    {t('pos:exchange.replacementTitle', { defaultValue: 'Replacement sale' })}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replacementSearch}
                      onChange={(e) => setReplacementSearch(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void onSearchReplacement(); }}
                      placeholder={t('pos:exchange.searchPlaceholder', { defaultValue: 'Search replacement item' })}
                      className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={onSearchReplacement}
                      disabled={replacementSearching}
                      className="inline-flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      {replacementSearching ? <Spinner size="sm" variant="white" /> : <Search className="h-4 w-4" />}
                      {t('pos:exchange.search', { defaultValue: 'Search' })}
                    </button>
                  </div>
                  {replacementResults.length > 0 && (
                    <div className="max-h-44 overflow-auto rounded border border-slate-200 bg-white">
                      {replacementResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addReplacementLine(item)}
                          className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                        >
                          <span>
                            <span className="block font-medium text-slate-900">{item.name}</span>
                            <span className="block font-mono text-xs text-slate-500">{item.code}</span>
                          </span>
                          <span className="font-mono text-xs text-slate-600">{Number(item.salePrice || 0).toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {replacementLines.length > 0 && (
                    <div className="rounded border bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-slate-500">
                            <th className="px-2 py-2">{t('pos:exchange.item', { defaultValue: 'Replacement item' })}</th>
                            <th className="px-2 py-2 text-right">{t('pos:exchange.qty', { defaultValue: 'Qty' })}</th>
                            <th className="px-2 py-2 text-right">{t('pos:exchange.price', { defaultValue: 'Price' })}</th>
                            <th className="px-2 py-2 text-right">{t('pos:exchange.total', { defaultValue: 'Total' })}</th>
                            <th className="px-2 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {replacementLines.map((line) => (
                            <tr key={line.itemId} className="border-b last:border-b-0">
                              <td className="px-2 py-1.5">
                                <div className="font-medium text-slate-900">{line.itemName}</div>
                                <div className="font-mono text-xs text-slate-500">{line.itemCode}</div>
                              </td>
                              <td className="px-2 py-1.5">
                                <div className="ml-auto flex w-28 items-center justify-end gap-1">
                                  <button type="button" onClick={() => updateReplacementLine(line.itemId, { qty: Math.max(0.001, line.qty - 1) })} className="rounded border p-1 text-slate-600 hover:bg-slate-50">
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    value={line.qty}
                                    onChange={(e) => updateReplacementLine(line.itemId, { qty: Math.max(0.001, Number(e.target.value) || 0.001) })}
                                    className="w-14 rounded border border-slate-300 px-1 py-0.5 text-right text-xs"
                                  />
                                  <button type="button" onClick={() => updateReplacementLine(line.itemId, { qty: line.qty + 1 })} className="rounded border p-1 text-slate-600 hover:bg-slate-50">
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={line.unitPrice}
                                  onChange={(e) => updateReplacementLine(line.itemId, { unitPrice: Math.max(0.01, Number(e.target.value) || 0.01) })}
                                  className="w-24 rounded border border-slate-300 px-1.5 py-0.5 text-right text-xs"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">{(line.qty * line.unitPrice).toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right">
                                <button type="button" onClick={() => removeReplacementLine(line.itemId)} className="rounded p-1 text-rose-600 hover:bg-rose-50">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="block text-xs font-medium text-slate-600">{t('pos:exchange.salePaymentMethod', { defaultValue: 'Replacement payment method' })}</span>
                      <select
                        value={replacementPaymentMethod}
                        onChange={(e) => setReplacementPaymentMethod(e.target.value as any)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-medium text-slate-600">{t('pos:exchange.salePaymentRef', { defaultValue: 'Payment reference' })}</span>
                      <input
                        type="text"
                        value={replacementPaymentRef}
                        onChange={(e) => setReplacementPaymentRef(e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 rounded border border-slate-200 bg-white p-3 text-sm md:grid-cols-3">
                    <div>
                      <div className="text-xs text-slate-500">{t('pos:exchange.returnValue', { defaultValue: 'Return value' })}</div>
                      <div className="font-mono font-semibold">{total.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">{t('pos:exchange.replacementValue', { defaultValue: 'Replacement value' })}</div>
                      <div className="font-mono font-semibold">{replacementTotal.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">{netDueFromCustomer > 0 ? t('pos:exchange.netDue', { defaultValue: 'Net due' }) : t('pos:exchange.netRefund', { defaultValue: 'Net refund' })}</div>
                      <div className="font-mono font-semibold">{(netDueFromCustomer || netRefundToCustomer).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => mode === 'RETURN' ? setShowConfirm(true) : setShowExchangeConfirm(true)}
                disabled={total <= 0 || (mode === 'EXCHANGE' && replacementTotal <= 0)}
                className={`w-full rounded px-3 py-2 text-sm text-white disabled:opacity-50 ${mode === 'RETURN' ? 'bg-rose-600' : 'bg-indigo-600'}`}
              >
                {mode === 'RETURN'
                  ? t('pos:return.post', { defaultValue: 'Post return' })
                  : <span className="inline-flex items-center justify-center gap-2"><ShoppingCart className="h-4 w-4" /> {t('pos:exchange.post', { defaultValue: 'Post exchange' })}</span>}
              </button>
            </div>
          )}
        </div>
      </Card>

      <OperationalListLayout<any>
        title={t('pos:return.historyTitle', { defaultValue: 'Return history' })}
        subtitle={t('pos:return.historySubtitle', { defaultValue: 'Recent returns for this company.' })}
        onRefresh={async () => {
          const list = await posApi.listReturns({ limit: 50 }).catch(() => []);
          setReturns((list as any) || []);
        }}
        data={returns}
        columns={returnColumns}
        idKey="id"
        emptyMessage={t('pos:return.empty', { defaultValue: 'No returns yet.' })}
      />

      <ConfirmDialog
        isOpen={showConfirm}
        title={t('pos:return.confirmTitle', { defaultValue: 'Post return?' })}
        message={t('pos:return.confirmBody', { defaultValue: 'This posts a sales return, reverses revenue/tax, restocks inventory (per policy), and (for CASH) reduces the shift drawer. Continue?' })}
        tone="warning"
        onConfirm={onSubmit}
        onCancel={() => setShowConfirm(false)}
        confirmLabel={submitting ? '…' : t('pos:return.confirm', { defaultValue: 'Post return' })}
      />
      <ConfirmDialog
        isOpen={showExchangeConfirm}
        title={t('pos:exchange.confirmTitle', { defaultValue: 'Post exchange?' })}
        message={t('pos:exchange.confirmBody', { defaultValue: 'This posts one POS return and one replacement POS sale linked by the same exchange id. Stock, tax, settlement, and receipt audit follow the normal POS posting rules. Continue?' })}
        tone="warning"
        onConfirm={onSubmitExchange}
        onCancel={() => setShowExchangeConfirm(false)}
        confirmLabel={submitting ? '…' : t('pos:exchange.confirm', { defaultValue: 'Post exchange' })}
      />
      <ManagerOverrideCapture
        isOpen={showManagerOverride}
        action="RETURN"
        title={mode === 'EXCHANGE'
          ? t('pos:managerOverride.exchangeTitle', { defaultValue: 'Approve exchange' })
          : t('pos:managerOverride.returnTitle', { defaultValue: 'Approve return' })}
        context={{
          receiptId: receipt?.id,
          receiptNumber: receipt?.receiptNumber,
          mode,
          returnTotal: total,
          replacementTotal,
        }}
        onCancel={() => setShowManagerOverride(false)}
        onApproved={(override) => {
          setManagerOverride(override);
          setShowManagerOverride(false);
        }}
      />
    </div>
  );
};

export default PosReturnPage;
