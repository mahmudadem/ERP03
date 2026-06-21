/**
 * PosReturnPage.tsx — Process returns against a completed receipt.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useConfirm as useConfirmHook } from '../../../hooks/useConfirm';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition } from '../../../components/ui/DataTable';
import { Spinner } from '../../../components/ui/Spinner';
import { posApi } from '../../../api/posApi';
import { errorHandler } from '../../../services/errorHandler';
import { useAuth } from '../../../context/AuthContext';
import { Undo2, Search, Receipt } from 'lucide-react';

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

const PosReturnPage: React.FC<Props> = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { confirm: confirmDialog } = useConfirmHook();
  void confirmDialog; // reserved for future confirmation patterns
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receipt, setReceipt] = useState<any | null>(null);
  const [lines, setLines] = useState<ReceiptLineView[]>([]);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM'>('CASH');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [returns, setReturns] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [bootstrap, setBootstrap] = useState<any | null>(null);

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
      toast.error(t('pos.return.enterReceipt', { defaultValue: 'Enter a receipt number.' }));
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

  const onSubmit = async () => {
    if (!receipt) return;
    const returnLines = lines.filter((l) => l.returnQty > 0);
    if (returnLines.length === 0) {
      toast.error(t('pos.return.noLines', { defaultValue: 'Pick at least one line to return.' }));
      return;
    }
    const openShift = bootstrap?.openShift;
    const register = bootstrap?.register;
    if (!openShift || !register) {
      toast.error(t('pos.return.needOpenShift', { defaultValue: 'No open shift for this register.' }));
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
      });
      toast.success(t('pos.return.completed', {
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

  const returnColumns: ColumnDefinition<any>[] = [
    { key: 'returnNumber', label: t('pos.return.col.number', { defaultValue: 'Return # '}), width: '160px', priority: 1, accessor: (r) => r.returnNumber },
    { key: 'originalReceiptNumber', label: t('pos.return.col.original', { defaultValue: 'Original receipt' }), width: '160px', priority: 1, accessor: (r) => r.originalReceiptNumber },
    { key: 'refundMethod', label: t('pos.return.col.method', { defaultValue: 'Refund method' }), width: '120px', priority: 1, accessor: (r) => r.refundMethod },
    { key: 'refundTotal', label: t('pos.return.col.amount', { defaultValue: 'Refund' }), width: '120px', priority: 1, accessor: (r) => Number(r.refundTotal || 0).toFixed(2) },
    { key: 'salesReturnNumber', label: t('pos.return.col.sr', { defaultValue: 'Sales Return #' }), width: '160px', priority: 1, accessor: (r) => r.salesReturnNumber || '—' },
    { key: 'createdAt', label: t('pos.return.col.date', { defaultValue: 'Date' }), width: '160px', priority: 2, accessor: (r) => new Date(r.createdAt).toLocaleString() },
  ];

  return (
    <div className="p-6 space-y-4">
      <Card>
        <div className="p-4 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-indigo-600" /> {t('pos.return.title', { defaultValue: 'Process return' })}
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder={t('pos.return.receiptPlaceholder', { defaultValue: 'Receipt number or ID' })}
              className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              onClick={onLookup}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
            >
              {loading ? <Spinner size="sm" variant="white" /> : <Search className="w-4 h-4" />}
              {t('pos.return.lookup', { defaultValue: 'Look up' })}
            </button>
          </div>
          {receipt && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                <Receipt className="inline w-3.5 h-3.5 mr-1" />
                {t('pos.return.receiptFor', { defaultValue: 'Receipt' })}: <span className="font-mono">{receipt.receiptNumber}</span> — {t('pos.return.si', { defaultValue: 'SI' })}: <span className="font-mono">{receipt.salesInvoiceNumber}</span>
              </div>
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="py-2 px-2">{t('pos.return.item', { defaultValue: 'Item' })}</th>
                      <th className="py-2 px-2 text-right">{t('pos.return.sold', { defaultValue: 'Sold' })}</th>
                      <th className="py-2 px-2 text-right">{t('pos.return.return', { defaultValue: 'Return' })}</th>
                      <th className="py-2 px-2 text-right">{t('pos.return.price', { defaultValue: 'Price' })}</th>
                      <th className="py-2 px-2 text-right">{t('pos.return.lineTotal', { defaultValue: 'Line total' })}</th>
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
                <span>{t('pos.return.refundMethod', { defaultValue: 'Refund method' })}:</span>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as any)}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                  <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                  <option value="CUSTOM">CUSTOM</option>
                </select>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>{t('pos.return.total', { defaultValue: 'Refund total' })}:</span>
                <span className="font-mono">{total.toFixed(2)}</span>
              </div>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={total <= 0}
                className="w-full px-3 py-2 rounded bg-rose-600 text-white text-sm disabled:opacity-50"
              >
                {t('pos.return.post', { defaultValue: 'Post return' })}
              </button>
            </div>
          )}
        </div>
      </Card>

      <OperationalListLayout<any>
        title={t('pos.return.historyTitle', { defaultValue: 'Return history' })}
        subtitle={t('pos.return.historySubtitle', { defaultValue: 'Recent returns for this company.' })}
        onRefresh={async () => {
          const list = await posApi.listReturns({ limit: 50 }).catch(() => []);
          setReturns((list as any) || []);
        }}
        data={returns}
        columns={returnColumns}
        idKey="id"
        emptyMessage={t('pos.return.empty', { defaultValue: 'No returns yet.' })}
      />

      <ConfirmDialog
        isOpen={showConfirm}
        title={t('pos.return.confirmTitle', { defaultValue: 'Post return?' })}
        message={t('pos.return.confirmBody', { defaultValue: 'This posts a sales return, reverses revenue/tax, restocks inventory (per policy), and (for CASH) reduces the shift drawer. Continue?' })}
        tone="warning"
        onConfirm={onSubmit}
        onCancel={() => setShowConfirm(false)}
        confirmLabel={submitting ? '…' : t('pos.return.confirm', { defaultValue: 'Post return' })}
      />
    </div>
  );
};

export default PosReturnPage;
