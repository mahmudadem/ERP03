import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CreatePurchaseInvoicePayload,
  PurchaseInvoiceDTO,
  PurchaseSettingsDTO,
  purchasesApi,
} from '../../../api/purchasesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const PurchaseInvoiceDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const [invoice, setInvoice] = useState<PurchaseInvoiceDTO | null>(null);
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [vendors, setVendors] = useState<PartyDTO[]>([]);
  const [purchaseOrderId, setPurchaseOrderId] = useState(searchParams.get('purchaseOrderId') || '');
  const [vendorId, setVendorId] = useState(searchParams.get('vendorId') || '');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vendorNameById = useMemo(
    () =>
      vendors.reduce<Record<string, string>>((acc, vendor) => {
        acc[vendor.id] = vendor.displayName;
        return acc;
      }, {}),
    [vendors]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [settingsResult, vendorResult] = await Promise.all([
        purchasesApi.getSettings(),
        sharedApi.listParties({ role: 'VENDOR', active: true }),
      ]);
      const currentSettings = unwrap<PurchaseSettingsDTO | null>(settingsResult);
      const vendorList = unwrap<PartyDTO[]>(vendorResult);
      setSettings(currentSettings);
      setVendors(Array.isArray(vendorList) ? vendorList : []);

      if (!isCreateMode && params.id) {
        const result = await purchasesApi.getPI(params.id);
        const loaded = unwrap<PurchaseInvoiceDTO>(result);
        setInvoice(loaded);
      } else {
        setInvoice(null);
      }
    } catch (err: any) {
      console.error('Failed to load purchase invoice detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load purchase invoice.'
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

      if (!vendorId) {
        setError('Vendor is required.');
        return;
      }
      if (!invoiceDate) {
        setError('Invoice date is required.');
        return;
      }
      if (!currency) {
        setError('Currency is required.');
        return;
      }
      if (!exchangeRate || Number.isNaN(exchangeRate) || exchangeRate <= 0) {
        setError('Exchange rate must be greater than 0.');
        return;
      }

      const payload: CreatePurchaseInvoicePayload = {
        purchaseOrderId: purchaseOrderId || undefined,
        vendorId,
        vendorInvoiceNumber: vendorInvoiceNumber || undefined,
        invoiceDate,
        dueDate: dueDate || undefined,
        currency,
        exchangeRate,
        notes: notes || undefined,
      };

      const created = await purchasesApi.createPI(payload);
      const dto = unwrap<PurchaseInvoiceDTO>(created);
      navigate(`/purchases/invoices/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create purchase invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to create purchase invoice draft.'
      );
    } finally {
      setBusy(false);
    }
  };

  const postDraft = async () => {
    if (!invoice?.id) return;
    try {
      setBusy(true);
      setError(null);
      const posted = await purchasesApi.postPI(invoice.id);
      setInvoice(unwrap<PurchaseInvoiceDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post purchase invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to post purchase invoice.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Invoice</h1>
        <Card className="p-6">Loading purchase invoice...</Card>
      </div>
    );
  }

  if (isCreateMode) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Purchase Invoice</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => navigate('/purchases/invoices')}
          >
            Back to List
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">PO Reference (optional)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
                placeholder="purchaseOrderId"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Vendor</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
              >
                <option value="">Select vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Vendor Invoice #</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={vendorInvoiceNumber}
                onChange={(e) => setVendorInvoiceNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Invoice Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Due Date (optional)</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Exchange Rate</label>
              <input
                type="number"
                min={0.000001}
                step={0.000001}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
              />
            </div>
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
            If PO is provided, invoice lines are pre-filled server-side using mode-specific quantity rules.
          </div>
        </Card>

        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={createDraft}
          disabled={busy}
        >
          {busy ? 'Creating...' : 'Create Draft Invoice'}
        </button>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Invoice</h1>
        <Card className="p-6 text-sm text-red-700">Purchase invoice not found.</Card>
      </div>
    );
  }

  const canCreatePayment = invoice.status === 'POSTED' && invoice.outstandingAmountBase > 0;
  const canCreateReturn = invoice.status === 'POSTED';
  const paymentHref = `/accounting/vouchers?mode=create&type=payment&sourceType=PURCHASE_INVOICE&sourceId=${invoice.id}`;
  const createReturnHref = `/purchases/returns/new?purchaseInvoiceId=${encodeURIComponent(invoice.id)}${
    invoice.purchaseOrderId ? `&purchaseOrderId=${encodeURIComponent(invoice.purchaseOrderId)}` : ''
  }`;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-slate-600">
            Vendor: <span className="font-medium">{vendorNameById[invoice.vendorId] || invoice.vendorName}</span>
            {invoice.vendorInvoiceNumber ? ` • Vendor Ref: ${invoice.vendorInvoiceNumber}` : ''}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
          {invoice.status}
        </span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Invoice Date</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.invoiceDate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Due Date</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.dueDate || '-'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">PO Reference</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.purchaseOrderId || '-'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Currency</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.currency}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Exchange Rate</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.exchangeRate}</div>
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
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-left">UOM</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-left">Tax Code</th>
                <th className="py-2 text-right">Line Total</th>
                <th className="py-2 text-right">Tax</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                  <td className="py-2 text-right">{line.invoicedQty}</td>
                  <td className="py-2">{line.uom}</td>
                  <td className="py-2 text-right">{line.unitPriceDoc.toFixed(2)}</td>
                  <td className="py-2">{line.taxCode || line.taxCodeId || '-'}</td>
                  <td className="py-2 text-right">{line.lineTotalDoc.toFixed(2)}</td>
                  <td className="py-2 text-right">{line.taxAmountDoc.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Payment Info</h2>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <span className="text-slate-600">Payment Terms (days)</span>
            <span className="font-medium">{invoice.paymentTermsDays}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Payment Status</span>
            <span className="font-medium">{invoice.paymentStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Outstanding (Base)</span>
            <span className="font-medium">{invoice.outstandingAmountBase.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Paid (Base)</span>
            <span className="font-medium">{invoice.paidAmountBase.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          onClick={() => navigate('/purchases/invoices')}
        >
          Back to List
        </button>
        {invoice.status === 'DRAFT' && (
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={postDraft}
            disabled={busy}
          >
            {busy ? 'Posting...' : 'Post Invoice'}
          </button>
        )}
        {invoice.status === 'POSTED' && (
          <button
            type="button"
            className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => navigate(createReturnHref)}
            disabled={!canCreateReturn}
          >
            Create Return
          </button>
        )}
        {invoice.status === 'POSTED' && (
          <button
            type="button"
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => navigate(paymentHref)}
            disabled={!canCreatePayment}
          >
            Create Payment
          </button>
        )}
      </div>
    </div>
  );
};

export default PurchaseInvoiceDetailPage;
