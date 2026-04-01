import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CreateSalesReturnPayload, SalesReturnDTO, salesApi } from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const SalesReturnDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const [salesReturn, setSalesReturn] = useState<SalesReturnDTO | null>(null);
  const [salesInvoiceId, setSalesInvoiceId] = useState(searchParams.get('salesInvoiceId') || '');
  const [deliveryNoteId, setDeliveryNoteId] = useState(searchParams.get('deliveryNoteId') || '');
  const [salesOrderId, setSalesOrderId] = useState(searchParams.get('salesOrderId') || '');
  const [returnDate, setReturnDate] = useState(todayIso());
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contextLabel = useMemo(() => {
    if (salesInvoiceId.trim()) return 'AFTER_INVOICE';
    if (deliveryNoteId.trim()) return 'BEFORE_INVOICE';
    return '-';
  }, [deliveryNoteId, salesInvoiceId]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!isCreateMode && params.id) {
        const result = await salesApi.getReturn(params.id);
        const loaded = unwrap<SalesReturnDTO>(result);
        setSalesReturn(loaded);
      } else {
        setSalesReturn(null);
      }
    } catch (err: any) {
      console.error('Failed to load sales return detail', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || 'Failed to load sales return.'
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

      if (!salesInvoiceId && !deliveryNoteId) {
        setError('salesInvoiceId or deliveryNoteId is required.');
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

      const payload: CreateSalesReturnPayload = {
        salesInvoiceId: salesInvoiceId || undefined,
        deliveryNoteId: deliveryNoteId || undefined,
        salesOrderId: salesOrderId || undefined,
        returnDate,
        warehouseId: warehouseId || undefined,
        reason: reason.trim(),
        notes: notes || undefined,
      };

      const created = await salesApi.createReturn(payload);
      const dto = unwrap<SalesReturnDTO>(created);
      navigate(`/sales/returns/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create sales return', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || 'Failed to create sales return draft.'
      );
    } finally {
      setBusy(false);
    }
  };

  const postDraft = async () => {
    if (!salesReturn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const posted = await salesApi.postReturn(salesReturn.id);
      setSalesReturn(unwrap<SalesReturnDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post sales return', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || 'Failed to post sales return.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Return</h1>
        <Card className="p-6">Loading sales return...</Card>
      </div>
    );
  }

  if (isCreateMode) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Sales Return</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => navigate('/sales/returns')}
          >
            Back to List
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sales Invoice ID</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={salesInvoiceId}
                onChange={(e) => setSalesInvoiceId(e.target.value)}
                placeholder="Use for AFTER_INVOICE returns"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Delivery Note ID</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={deliveryNoteId}
                onChange={(e) => setDeliveryNoteId(e.target.value)}
                placeholder="Use for BEFORE_INVOICE returns"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sales Order ID (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={salesOrderId}
                onChange={(e) => setSalesOrderId(e.target.value)}
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

  if (!salesReturn) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Return</h1>
        <Card className="p-6 text-sm text-red-700">Sales return not found.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{salesReturn.returnNumber}</h1>
          <p className="text-sm text-slate-600">
            Customer: <span className="font-medium">{salesReturn.customerName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            {salesReturn.returnContext}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{salesReturn.status}</span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Return Date</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{salesReturn.returnDate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Warehouse</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{salesReturn.warehouseId}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Reason</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{salesReturn.reason}</div>
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
                <th className="py-2 text-right">Line Cost</th>
              </tr>
            </thead>
            <tbody>
              {salesReturn.lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                  <td className="py-2 text-right">{line.returnQty}</td>
                  <td className="py-2">{line.uom}</td>
                  <td className="py-2 text-right">{line.unitCostBase.toFixed(2)}</td>
                  <td className="py-2 text-right">{(line.returnQty * line.unitCostBase).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          onClick={() => navigate('/sales/returns')}
        >
          Back to List
        </button>
        {salesReturn.status === 'DRAFT' && (
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

export default SalesReturnDetailPage;

