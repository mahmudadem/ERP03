import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { QuoteDTO, QuoteLineDTO, QuoteStatus, salesOperationalApi } from '../../../api/salesOperationalApi';
import { salesMasterDataApi, SalespersonDTO } from '../../../api/salesMasterDataApi';
import { inventoryApi, InventoryItemDTO } from '../../../api/inventoryApi';
import { sharedApi, PartyDTO, TaxCodeDTO } from '../../../api/sharedApi';
import { PartySelector } from '../../../components/shared/selectors';
import { FileText, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const roundMoney = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

// ─── Status badge ─────────────────────────────────────────────────────────────

type QuoteStatusLocal = QuoteStatus;

const STATUS_STYLES: Record<QuoteStatusLocal, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-amber-100 text-amber-700',
  CONVERTED: 'bg-violet-100 text-violet-700',
};

const StatusBadge: React.FC<{ status: QuoteStatusLocal }> = ({ status }) => (
  <span
    className={clsx(
      'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
      STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700'
    )}
  >
    {status}
  </span>
);

// ─── Editable line shape ──────────────────────────────────────────────────────

interface EditableLine {
  lineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quotedQty: number;
  uom: string;
  uomId?: string;
  unitPriceDoc: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
  description?: string;
}

interface EditableForm {
  id?: string;
  quoteNumber?: string;
  status: QuoteStatusLocal;
  customerId: string;
  customerName: string;
  salespersonId?: string;
  quoteDate: string;
  validUntil: string;
  currency: string;
  exchangeRate: number;
  notes: string;
  convertedToType?: 'SALES_ORDER' | 'SALES_INVOICE';
  convertedToId?: string;
  lines: EditableLine[];
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  itemCode: '',
  itemName: '',
  quotedQty: 1,
  uom: 'EA',
  unitPriceDoc: 0,
  discountValue: undefined,
  taxCodeId: undefined,
  description: '',
});

const createEmptyForm = (): EditableForm => ({
  status: 'DRAFT',
  customerId: '',
  customerName: '',
  quoteDate: todayIso(),
  validUntil: '',
  currency: 'USD',
  exchangeRate: 1,
  notes: '',
  lines: [createEmptyLine()],
});

const fromQuoteDTO = (q: QuoteDTO): EditableForm => ({
  id: q.id,
  quoteNumber: q.quoteNumber,
  status: q.status,
  customerId: q.customerId,
  customerName: q.customerName,
  salespersonId: q.salespersonId,
  quoteDate: q.quoteDate,
  validUntil: q.validUntil ?? '',
  currency: q.currency,
  exchangeRate: q.exchangeRate,
  notes: q.notes ?? '',
  convertedToType: q.convertedToType,
  convertedToId: q.convertedToId,
  lines: q.lines.map((l) => ({
    lineId: l.lineId,
    itemId: l.itemId,
    itemCode: l.itemCode,
    itemName: l.itemName,
    quotedQty: l.quotedQty,
    uom: l.uom,
    uomId: l.uomId,
    unitPriceDoc: l.unitPriceDoc,
    discountType: l.discountType,
    discountValue: l.discountValue,
    taxCodeId: l.taxCodeId,
    description: l.description,
  })),
});

// ─── Page component ───────────────────────────────────────────────────────────

const QuotationDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const isCreateMode = !params.id || params.id === 'new';

  const [form, setForm] = useState<EditableForm>(createEmptyForm());
  const [salespersons, setSalespersons] = useState<SalespersonDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const itemById = useMemo(
    () =>
      items.reduce<Record<string, InventoryItemDTO>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [items]
  );

  const taxById = useMemo(
    () =>
      taxCodes.reduce<Record<string, TaxCodeDTO>>((acc, tc) => {
        acc[tc.id] = tc;
        return acc;
      }, {}),
    [taxCodes]
  );

  const salesTaxCodes = useMemo(
    () => taxCodes.filter((tc) => tc.scope === 'SALES' || tc.scope === 'BOTH'),
    [taxCodes]
  );

  const computedLines = useMemo(() =>
    form.lines.map((line) => {
      const taxRate = line.taxCodeId ? (taxById[line.taxCodeId]?.rate ?? 0) : 0;
      const gross = roundMoney((line.quotedQty || 0) * (line.unitPriceDoc || 0));
      let discountAmt = 0;
      if (line.discountType === 'PERCENT' && line.discountValue) {
        discountAmt = roundMoney(gross * (line.discountValue / 100));
      } else if (line.discountType === 'AMOUNT' && line.discountValue) {
        discountAmt = roundMoney(line.discountValue);
      }
      const lineTotalDoc = roundMoney(gross - discountAmt);
      const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
      return { gross, discountAmt, lineTotalDoc, taxAmountDoc };
    }),
    [form.lines, taxById]
  );

  const totals = useMemo(() => {
    const subtotalDoc = roundMoney(computedLines.reduce((s, l) => s + l.lineTotalDoc, 0));
    const taxTotalDoc = roundMoney(computedLines.reduce((s, l) => s + l.taxAmountDoc, 0));
    return { subtotalDoc, taxTotalDoc, grandTotalDoc: roundMoney(subtotalDoc + taxTotalDoc) };
  }, [computedLines]);

  const isDraft = form.status === 'DRAFT';
  const isReadOnly = !isDraft;

  // ── Data loading ──────────────────────────────────────────────────────────────

  const loadReferenceData = async () => {
    const [itemResult, taxResult, spResult] = await Promise.all([
      inventoryApi.listItems({ active: true, limit: 500 }),
      sharedApi.listTaxCodes({ active: true }),
      salesMasterDataApi.listSalespersons({ status: 'ACTIVE' }),
    ]);
    setItems(Array.isArray(unwrap<InventoryItemDTO[]>(itemResult)) ? unwrap<InventoryItemDTO[]>(itemResult) : []);
    setTaxCodes(Array.isArray(unwrap<TaxCodeDTO[]>(taxResult)) ? unwrap<TaxCodeDTO[]>(taxResult) : []);
    setSalespersons(Array.isArray(spResult) ? spResult : []);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      await loadReferenceData();
      if (isCreateMode) {
        setForm(createEmptyForm());
      } else if (params.id) {
        const q = await salesOperationalApi.getQuote(params.id);
        setForm(fromQuoteDTO(q));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load quotation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Line helpers ──────────────────────────────────────────────────────────────

  const setLine = (index: number, patch: Partial<EditableLine>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      const current = lines[index];
      const next: EditableLine = { ...current, ...patch };
      if (patch.itemId !== undefined && patch.itemId) {
        const item = itemById[patch.itemId];
        if (item) {
          next.itemCode = item.code;
          next.itemName = item.name;
          next.uom = item.salesUom || item.baseUom || 'EA';
          next.uomId = item.salesUomId || item.baseUomId;
          if (!next.taxCodeId && item.defaultSalesTaxCodeId) {
            next.taxCodeId = item.defaultSalesTaxCodeId;
          }
        }
      }
      lines[index] = next;
      return { ...prev, lines };
    });
  };

  const addLine = () =>
    setForm((prev) => ({ ...prev, lines: [...prev.lines, createEmptyLine()] }));

  const removeLine = (index: number) =>
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return { ...prev, lines: prev.lines.filter((_, i) => i !== index) };
    });

  // ── Validation ────────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (!form.customerId) return 'Customer is required.';
    if (!form.quoteDate) return 'Quote date is required.';
    if (!form.currency.trim()) return 'Currency is required.';
    if (form.exchangeRate <= 0) return 'Exchange rate must be greater than 0.';
    if (!form.lines.length) return 'At least one line is required.';
    for (let i = 0; i < form.lines.length; i++) {
      const l = form.lines[i];
      if (!l.itemId) return `Line ${i + 1}: item is required.`;
      if (l.quotedQty <= 0) return `Line ${i + 1}: quantity must be greater than 0.`;
      if (l.unitPriceDoc < 0) return `Line ${i + 1}: unit price must be >= 0.`;
    }
    return null;
  };

  // ── Save ──────────────────────────────────────────────────────────────────────

  const buildPayload = () => ({
    customerId: form.customerId,
    customerName: form.customerName,
    salespersonId: form.salespersonId || undefined,
    quoteDate: form.quoteDate,
    validUntil: form.validUntil || undefined,
    currency: form.currency.toUpperCase(),
    exchangeRate: form.exchangeRate,
    notes: form.notes || undefined,
    lines: form.lines.map((l, i) => {
      const item = itemById[l.itemId];
      return {
        lineId: l.lineId,
        lineNo: i + 1,
        itemId: l.itemId,
        itemCode: l.itemCode || item?.code || '',
        itemName: l.itemName || item?.name || '',
        quotedQty: l.quotedQty,
        uomId: l.uomId,
        uom: l.uom || item?.salesUom || item?.baseUom || 'EA',
        unitPriceDoc: l.unitPriceDoc,
        discountType: l.discountType,
        discountValue: l.discountValue,
        taxCodeId: l.taxCodeId || undefined,
        taxRate: l.taxCodeId ? (taxById[l.taxCodeId]?.rate ?? 0) : 0,
        description: l.description || undefined,
      };
    }),
  });

  const saveQuote = async (): Promise<QuoteDTO | null> => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return null;
    }
    try {
      setSaving(true);
      setError(null);
      const payload = buildPayload();
      let saved: QuoteDTO;
      if (isCreateMode || !form.id) {
        saved = await salesOperationalApi.createQuote(payload);
        navigate(`/sales/quotes/${saved.id}`, { replace: true });
      } else {
        saved = await salesOperationalApi.updateQuote(form.id, payload);
      }
      setForm(fromQuoteDTO(saved));
      return saved;
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to save quotation.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────────

  const withAction = async (action: () => Promise<void>) => {
    try {
      setActionBusy(true);
      setError(null);
      await action();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Action failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSend = () =>
    withAction(async () => {
      let id = form.id;
      if (!id) {
        const saved = await saveQuote();
        if (!saved) return;
        id = saved.id;
      }
      const updated = await salesOperationalApi.sendQuote(id!);
      setForm(fromQuoteDTO(updated));
    });

  const handleAccept = () =>
    withAction(async () => {
      const updated = await salesOperationalApi.acceptQuote(form.id!);
      setForm(fromQuoteDTO(updated));
    });

  const handleReject = () =>
    withAction(async () => {
      const updated = await salesOperationalApi.rejectQuote(form.id!);
      setForm(fromQuoteDTO(updated));
    });

  const handleRevise = () =>
    withAction(async () => {
      const newQuote = await salesOperationalApi.reviseQuote(form.id!);
      navigate(`/sales/quotes/${newQuote.id}`);
    });

  const handleConvertToOrder = () =>
    withAction(async () => {
      const result = await salesOperationalApi.convertQuoteToOrder(form.id!);
      navigate(`/sales/orders/${result.salesOrderId}`);
    });

  const handleConvertToInvoice = () =>
    withAction(async () => {
      const result = await salesOperationalApi.convertQuoteToInvoice(form.id!);
      navigate(`/sales/invoices/${result.salesInvoiceId}`);
    });

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Quotation</h1>
        <Card className="p-6">Loading quotation...</Card>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/sales/quotes')}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-100 dark:shadow-none">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                {form.quoteNumber ? `Quote ${form.quoteNumber}` : 'New Quotation'}
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">
                Sales Quote
                {form.id && ` · v${form.id ? (form as any).version ?? '' : ''}`}
              </p>
            </div>
            {form.status !== 'DRAFT' && <StatusBadge status={form.status} />}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isDraft && (
              <>
                <button
                  type="button"
                  onClick={saveQuote}
                  disabled={saving || actionBusy}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-slate-700 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={saving || actionBusy}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700 transition-colors"
                >
                  Send
                </button>
              </>
            )}

            {form.status === 'SENT' && (
              <>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={actionBusy}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-green-700 transition-colors"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={actionBusy}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 hover:bg-red-50 transition-colors"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={handleRevise}
                  disabled={actionBusy}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50 transition-colors"
                >
                  Revise
                </button>
              </>
            )}

            {form.status === 'ACCEPTED' && (
              <>
                <button
                  type="button"
                  onClick={handleConvertToOrder}
                  disabled={actionBusy}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                >
                  Convert to Sales Order
                </button>
                <button
                  type="button"
                  onClick={handleConvertToInvoice}
                  disabled={actionBusy}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-emerald-700 transition-colors"
                >
                  Convert to Invoice
                </button>
              </>
            )}

            {form.status === 'REJECTED' && (
              <button
                type="button"
                onClick={handleRevise}
                disabled={actionBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Revise
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Error banner */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Converted notice */}
          {form.status === 'CONVERTED' && form.convertedToType && form.convertedToId && (
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400 text-sm px-4 py-3 rounded-lg">
              Converted to {form.convertedToType === 'SALES_ORDER' ? 'Sales Order' : 'Sales Invoice'} —{' '}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    form.convertedToType === 'SALES_ORDER'
                      ? `/sales/orders/${form.convertedToId}`
                      : `/sales/invoices/${form.convertedToId}`
                  )
                }
                className="font-bold underline hover:no-underline"
              >
                {form.convertedToId}
              </button>
            </div>
          )}

          {/* Header fields */}
          <Card className="p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Customer
                </label>
                <PartySelector
                  value={form.customerId}
                  disabled={isReadOnly}
                  role="CUSTOMER"
                  onChange={(party: PartyDTO | null) =>
                    setForm((prev) => ({
                      ...prev,
                      customerId: party?.id ?? '',
                      customerName: party?.displayName ?? '',
                      currency: party?.defaultCurrency ?? prev.currency,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Salesperson
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  value={form.salespersonId ?? ''}
                  disabled={isReadOnly}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, salespersonId: e.target.value || undefined }))
                  }
                >
                  <option value="">— None —</option>
                  {salespersons.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Quote Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  value={form.quoteDate}
                  disabled={isReadOnly}
                  onChange={(e) => setForm((prev) => ({ ...prev, quoteDate: e.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Valid Until
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  value={form.validUntil}
                  disabled={isReadOnly}
                  onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Currency
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 uppercase font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  maxLength={3}
                  value={form.currency}
                  disabled={isReadOnly}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))
                  }
                  placeholder="USD"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Exchange Rate
                </label>
                <input
                  type="number"
                  min={0.000001}
                  step={0.000001}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  value={form.exchangeRate}
                  disabled={isReadOnly}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      exchangeRate: parseFloat(e.target.value) || 1,
                    }))
                  }
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Notes
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                value={form.notes}
                disabled={isReadOnly}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes visible to the customer..."
              />
            </div>
          </Card>

          {/* Lines table */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Line Items</h2>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Plus size={14} /> Add Line
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 text-left">Item</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-left">UOM</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-left">Disc. Type</th>
                    <th className="py-2 text-right">Disc. Value</th>
                    <th className="py-2 text-left">Tax Code</th>
                    <th className="py-2 text-right">Line Total</th>
                    <th className="py-2 text-right">Tax</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, index) => (
                    <tr
                      key={line.lineId ?? `line-${index}`}
                      className="border-b border-slate-100 dark:border-slate-800 align-top"
                    >
                      <td className="py-2 pr-2">
                        <select
                          className="w-52 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                          value={line.itemId}
                          disabled={isReadOnly}
                          onChange={(e) => setLine(index, { itemId: e.target.value })}
                        >
                          <option value="">Select item</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.code} - {item.name}
                            </option>
                          ))}
                        </select>
                        {line.itemName && (
                          <div className="mt-0.5 text-xs text-slate-400">{line.itemName}</div>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min={0.000001}
                          step={0.000001}
                          className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-right bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                          value={line.quotedQty}
                          disabled={isReadOnly}
                          onChange={(e) => setLine(index, { quotedQty: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          className="w-16 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 uppercase bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                          value={line.uom}
                          disabled={isReadOnly}
                          onChange={(e) => setLine(index, { uom: e.target.value.toUpperCase() })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-right bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                          value={line.unitPriceDoc}
                          disabled={isReadOnly}
                          onChange={(e) => setLine(index, { unitPriceDoc: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          className="w-24 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                          value={line.discountType ?? ''}
                          disabled={isReadOnly}
                          onChange={(e) =>
                            setLine(index, {
                              discountType: (e.target.value as 'PERCENT' | 'AMOUNT') || undefined,
                            })
                          }
                        >
                          <option value="">None</option>
                          <option value="PERCENT">%</option>
                          <option value="AMOUNT">Amt</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-right bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                          value={line.discountValue ?? ''}
                          disabled={isReadOnly || !line.discountType}
                          onChange={(e) =>
                            setLine(index, {
                              discountValue: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          placeholder="0"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          className="w-36 rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                          value={line.taxCodeId ?? ''}
                          disabled={isReadOnly}
                          onChange={(e) => setLine(index, { taxCodeId: e.target.value || undefined })}
                        >
                          <option value="">No Tax</option>
                          {salesTaxCodes.map((tc) => (
                            <option key={tc.id} value={tc.id}>
                              {tc.code} ({Math.round(tc.rate * 100)}%)
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2 text-right whitespace-nowrap">
                        {form.currency} {computedLines[index]?.lineTotalDoc.toFixed(2)}
                      </td>
                      <td className="py-2 pr-2 text-right whitespace-nowrap">
                        {form.currency} {computedLines[index]?.taxAmountDoc.toFixed(2)}
                      </td>
                      <td className="py-2 text-right">
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            disabled={form.lines.length <= 1}
                            className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                            title="Remove line"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Totals */}
          <Card className="p-5">
            <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Totals</h3>
            <div className="space-y-1.5 text-sm max-w-xs ml-auto">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                <span className="font-medium">
                  {form.currency} {totals.subtotalDoc.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Tax</span>
                <span className="font-medium">
                  {form.currency} {totals.taxTotalDoc.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Grand Total</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {form.currency} {totals.grandTotalDoc.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuotationDetailPage;
