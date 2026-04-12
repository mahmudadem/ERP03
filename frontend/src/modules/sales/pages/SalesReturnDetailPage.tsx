import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreateSalesReturnPayload,
  DeliveryNoteDTO,
  ReturnContext,
  SalesInvoiceDTO,
  SalesReturnDTO,
  salesApi,
} from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const SalesReturnDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const initialSalesInvoiceId = searchParams.get('salesInvoiceId') || '';
  const initialDeliveryNoteId = searchParams.get('deliveryNoteId') || '';
  const initialContext: ReturnContext = initialSalesInvoiceId
    ? 'AFTER_INVOICE'
    : initialDeliveryNoteId
      ? 'BEFORE_INVOICE'
      : 'AFTER_INVOICE';

  const [salesReturn, setSalesReturn] = useState<SalesReturnDTO | null>(null);
  const [salesInvoiceId, setSalesInvoiceId] = useState(initialSalesInvoiceId);
  const [deliveryNoteId, setDeliveryNoteId] = useState(initialDeliveryNoteId);
  const [returnContext, setReturnContext] = useState<ReturnContext>(initialContext);
  const [returnDate, setReturnDate] = useState(todayIso());
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoiceDTO[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const salesInvoiceLabelById = useMemo(
    () =>
      salesInvoices.reduce<Record<string, string>>((acc, invoice) => {
        acc[invoice.id] = `${invoice.invoiceNumber} - ${invoice.customerName}`;
        return acc;
      }, {}),
    [salesInvoices]
  );

  const deliveryNoteLabelById = useMemo(
    () =>
      deliveryNotes.reduce<Record<string, string>>((acc, note) => {
        acc[note.id] = `${note.dnNumber} - ${note.customerName}`;
        return acc;
      }, {}),
    [deliveryNotes]
  );

  const warehouseLabelById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses]
  );

  const loadReferenceData = async () => {
    const [invoiceResult, deliveryNoteResult, warehouseResult] = await Promise.all([
      salesApi.listSIs({ status: 'POSTED', limit: 500 }),
      salesApi.listDNs({ status: 'POSTED', limit: 500 }),
      inventoryApi.listWarehouses({ active: true, limit: 200 }),
    ]);

    const invoiceList = unwrap<SalesInvoiceDTO[]>(invoiceResult);
    const deliveryNoteList = unwrap<DeliveryNoteDTO[]>(deliveryNoteResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);

    setSalesInvoices(Array.isArray(invoiceList) ? invoiceList : []);
    setDeliveryNotes(Array.isArray(deliveryNoteList) ? deliveryNoteList : []);
    setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      await loadReferenceData();

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

  const applyDefaultWarehouseFromInvoice = (invoiceId: string) => {
    const selectedInvoice = salesInvoices.find((entry) => entry.id === invoiceId);
    const sourceWarehouseId = selectedInvoice?.lines.find((line) => !!line.warehouseId)?.warehouseId;
    if (sourceWarehouseId) {
      setWarehouseId((prev) => prev || sourceWarehouseId);
    }
  };

  const applyDefaultWarehouseFromDeliveryNote = (noteId: string) => {
    const selectedDeliveryNote = deliveryNotes.find((entry) => entry.id === noteId);
    if (selectedDeliveryNote?.warehouseId) {
      setWarehouseId((prev) => prev || selectedDeliveryNote.warehouseId);
    }
  };

  const handleContextChange = (nextContext: ReturnContext) => {
    setReturnContext(nextContext);
    setError(null);

    if (nextContext === 'AFTER_INVOICE') {
      setDeliveryNoteId('');
    } else {
      setSalesInvoiceId('');
    }
  };

  const handleSalesInvoiceChange = (value: string) => {
    setSalesInvoiceId(value);
    setDeliveryNoteId('');
    if (value) {
      applyDefaultWarehouseFromInvoice(value);
    }
  };

  const handleDeliveryNoteChange = (value: string) => {
    setDeliveryNoteId(value);
    setSalesInvoiceId('');
    if (value) {
      applyDefaultWarehouseFromDeliveryNote(value);
    }
  };

  const createDraft = async () => {
    try {
      setBusy(true);
      setError(null);

      if (returnContext === 'AFTER_INVOICE' && !salesInvoiceId) {
        setError('A posted sales invoice is required for AFTER_INVOICE returns.');
        return;
      }
      if (returnContext === 'BEFORE_INVOICE' && !deliveryNoteId) {
        setError('A posted delivery note is required for BEFORE_INVOICE returns.');
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
        salesInvoiceId: returnContext === 'AFTER_INVOICE' ? salesInvoiceId || undefined : undefined,
        deliveryNoteId: returnContext === 'BEFORE_INVOICE' ? deliveryNoteId || undefined : undefined,
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Return Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    returnContext === 'AFTER_INVOICE'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-300 text-slate-700'
                  }`}
                  onClick={() => handleContextChange('AFTER_INVOICE')}
                  disabled={busy}
                >
                  After Invoice
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    returnContext === 'BEFORE_INVOICE'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-300 text-slate-700'
                  }`}
                  onClick={() => handleContextChange('BEFORE_INVOICE')}
                  disabled={busy}
                >
                  Before Invoice
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Context</label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium">
                {returnContext}
              </div>
            </div>

            {returnContext === 'AFTER_INVOICE' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Posted Sales Invoice</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={salesInvoiceId}
                  onChange={(e) => handleSalesInvoiceChange(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select sales invoice</option>
                  {salesInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} - {invoice.customerName}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Posted Delivery Note</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={deliveryNoteId}
                  onChange={(e) => handleDeliveryNoteChange(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select delivery note</option>
                  {deliveryNotes.map((note) => (
                    <option key={note.id} value={note.id}>
                      {note.dnNumber} - {note.customerName}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
              <label className="mb-1 block text-sm font-medium text-slate-700">Warehouse (optional)</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                disabled={busy}
              >
                <option value="">Use source/default warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
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
            Lines are pre-filled from the selected posted source document when the draft is created.
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

  const sourceLabel =
    salesReturn.returnContext === 'AFTER_INVOICE'
      ? (salesReturn.salesInvoiceId && salesInvoiceLabelById[salesReturn.salesInvoiceId]) || salesReturn.salesInvoiceId || '-'
      : (salesReturn.deliveryNoteId && deliveryNoteLabelById[salesReturn.deliveryNoteId]) || salesReturn.deliveryNoteId || '-';

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
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {warehouseLabelById[salesReturn.warehouseId] || salesReturn.warehouseId}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Reason</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{salesReturn.reason}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Source Document</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{sourceLabel}</div>
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
