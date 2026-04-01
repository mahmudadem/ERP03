import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CreatePurchaseReturnPayload, PurchaseReturnDTO, purchasesApi } from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const PurchaseReturnDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const [purchaseReturn, setPurchaseReturn] = useState<PurchaseReturnDTO | null>(null);
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState(searchParams.get('purchaseInvoiceId') || '');
  const [goodsReceiptId, setGoodsReceiptId] = useState(searchParams.get('goodsReceiptId') || '');
  const [purchaseOrderId, setPurchaseOrderId] = useState(searchParams.get('purchaseOrderId') || '');
  const [returnDate, setReturnDate] = useState(todayIso());
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextLabel = useMemo(() => {
    if (purchaseInvoiceId.trim()) return 'AFTER_INVOICE';
    if (goodsReceiptId.trim()) return 'BEFORE_INVOICE';
    return '-';
  }, [goodsReceiptId, purchaseInvoiceId]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!isCreateMode && params.id) {
        const result = await purchasesApi.getReturn(params.id);
        const loaded = unwrap<PurchaseReturnDTO>(result);
        setPurchaseReturn(loaded);
      } else {
        setPurchaseReturn(null);
      }
    } catch (err: any) {
      console.error('Failed to load purchase return detail', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || 'Failed to load purchase return.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const createDraft = async () => {
    try {
      setBusy(true);
      setError(null);

      if (!purchaseInvoiceId && !goodsReceiptId) {
        setError('purchaseInvoiceId or goodsReceiptId is required.');
        return;
      }
      if (!returnDate) {
        setError('Return date is required.');
        return;
      }
      if (!reason.trim()) {
        setError('Reason is required.');
        return;
      }

      const payload: CreatePurchaseReturnPayload = {
        purchaseInvoiceId: purchaseInvoiceId || undefined,
        goodsReceiptId: goodsReceiptId || undefined,
        purchaseOrderId: purchaseOrderId || undefined,
        returnDate,
        warehouseId: warehouseId || undefined,
        reason: reason.trim(),
        notes: notes || undefined,
      };

      const created = await purchasesApi.createReturn(payload);
      const dto = unwrap<PurchaseReturnDTO>(created);
      navigate(`/purchases/returns/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create purchase return', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || 'Failed to create purchase return draft.'
      );
    } finally {
      setBusy(false);
    }
  };

  const postDraft = async () => {
    if (!purchaseReturn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const posted = await purchasesApi.postReturn(purchaseReturn.id);
      setPurchaseReturn(unwrap<PurchaseReturnDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post purchase return', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || 'Failed to post purchase return.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Return</h1>
        <Card className="p-6">Loading purchase return...</Card>
      </div>
    );
  }

  if (isCreateMode) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Purchase Return</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => navigate('/purchases/returns')}
          >
            Back to List
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Purchase Invoice ID</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={purchaseInvoiceId}
                onChange={(e) => setPurchaseInvoiceId(e.target.value)}
                placeholder="Use for AFTER_INVOICE returns"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Goods Receipt ID</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={goodsReceiptId}
                onChange={(e) => setGoodsReceiptId(e.target.value)}
                placeholder="Use for BEFORE_INVOICE returns"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Purchase Order ID (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Return Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Warehouse ID (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Context</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium">
                {contextLabel}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Lines are pre-filled from the selected source document when the draft is created.
          </div>
        </Card>

        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={createDraft}
          disabled={busy}
        >
          {busy ? 'Creating...' : 'Create Draft Return'}
        </button>
      </div>
    );
  }

  if (!purchaseReturn) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Return</h1>
        <Card className="p-6 text-sm text-red-700">Purchase return not found.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{purchaseReturn.returnNumber}</h1>
          <p className="text-sm text-slate-600">
            Vendor: <span className="font-medium">{purchaseReturn.vendorName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {purchaseReturn.returnContext}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{purchaseReturn.status}</span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Return Date</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.returnDate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Warehouse</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.warehouseId}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Reason</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{purchaseReturn.reason}</div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Lines</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-right">Return Qty</th>
                <th className="py-2 text-left">UOM</th>
                <th className="py-2 text-right">Unit Cost</th>
                <th className="py-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {purchaseReturn.lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                  <td className="py-2 text-right">{line.returnQty}</td>
                  <td className="py-2">{line.uom}</td>
                  <td className="py-2 text-right">{line.unitCostDoc.toFixed(2)}</td>
                  <td className="py-2 text-right">{(line.returnQty * line.unitCostDoc).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-medium">
              {purchaseReturn.currency} {purchaseReturn.subtotalDoc.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Tax</span>
            <span className="font-medium">
              {purchaseReturn.currency} {purchaseReturn.taxTotalDoc.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Grand Total</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {purchaseReturn.currency} {purchaseReturn.grandTotalDoc.toFixed(2)}
            </span>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          onClick={() => navigate('/purchases/returns')}
        >
          Back to List
        </button>
        {purchaseReturn.status === 'DRAFT' && (
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={postDraft}
            disabled={busy}
          >
            {busy ? 'Posting...' : 'Post Return'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PurchaseReturnDetailPage;
