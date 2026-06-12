import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { StatusChip } from '../../../components/ui/StatusChip';
import { QuoteDTO, QuoteLineDTO, QuoteStatus, salesOperationalApi } from '../../../api/salesOperationalApi';
import { salesMasterDataApi, SalespersonDTO } from '../../../api/salesMasterDataApi';
import { inventoryApi, InventoryItemDTO } from '../../../api/inventoryApi';
import { sharedApi, PartyDTO, TaxCodeDTO } from '../../../api/sharedApi';
import { PartySelector, ItemSelector, UomSelector, TaxCodeSelector, DiscountTypeSelector } from '../../../components/shared/selectors';
import { ClassicLineItemsTable, ColumnDef } from '../../../components/shared/ClassicLineItemsTable';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { CurrencyExchangeWidget } from '../../accounting/components/shared/CurrencyExchangeWidget';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useConfirm } from '../../../hooks/useConfirm';
import { errorHandler } from '../../../services/errorHandler';
import { FileText, ChevronLeft } from 'lucide-react';
import {
  DocumentHeaderField,
  DocumentHeaderGrid,
  documentHeaderControlClass,
  documentHeaderLabelClass,
  documentHeaderSelectorClass,
} from '../../../components/shared/DocumentDetailScaffold';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const roundMoney = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

type QuoteStatusLocal = QuoteStatus;

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
  quotedQty: 0,
  uom: 'EA',
  unitPriceDoc: 0,
  discountType: undefined,
  discountValue: undefined,
  taxCodeId: undefined,
  description: '',
});

const createEmptyForm = (baseCurrency = 'USD'): EditableForm => ({
  status: 'DRAFT',
  customerId: '',
  customerName: '',
  quoteDate: todayIso(),
  validUntil: '',
  currency: baseCurrency,
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const isCreateMode = !params.id || params.id === 'new';
  const { company } = useCompanyAccess();
  const { confirm, confirmDialog } = useConfirm();

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

  // ── Button palette (rationalized: brand-primary / neutral / danger) ────────────
  const btnPrimary =
    'rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-primary-700 transition-colors';
  const btnNeutral =
    'rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors';
  const btnDanger =
    'rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50 hover:bg-red-50 transition-colors';

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
        setForm(createEmptyForm(company?.baseCurrency || 'USD'));
      } else if (params.id) {
        const q = await salesOperationalApi.getQuote(params.id);
        setForm(fromQuoteDTO(q));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? t('sales.quoteDetail.loadFailed', 'Failed to load quotation.'));
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
    if (!form.customerId) return t('sales.quoteDetail.valCustomer', 'Customer is required.');
    if (!form.quoteDate) return t('sales.quoteDetail.valQuoteDate', 'Quote date is required.');
    if (!form.currency.trim()) return t('sales.quoteDetail.valCurrency', 'Currency is required.');
    if (form.exchangeRate <= 0) return t('sales.quoteDetail.valExchangeRate', 'Exchange rate must be greater than 0.');
    if (!form.lines.length) return t('sales.quoteDetail.valNoLines', 'At least one line is required.');
    for (let i = 0; i < form.lines.length; i++) {
      const l = form.lines[i];
      if (!l.itemId) return t('sales.quoteDetail.valLineItem', { line: i + 1, defaultValue: 'Line {{line}}: item is required.' });
      if (l.quotedQty <= 0) return t('sales.quoteDetail.valLineQty', { line: i + 1, defaultValue: 'Line {{line}}: quantity must be greater than 0.' });
      if (l.unitPriceDoc < 0) return t('sales.quoteDetail.valLinePrice', { line: i + 1, defaultValue: 'Line {{line}}: unit price must be >= 0.' });
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
      setError(err?.response?.data?.message ?? err?.message ?? t('sales.quoteDetail.saveFailed', 'Failed to save quotation.'));
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
      setError(err?.response?.data?.message ?? err?.message ?? t('sales.quoteDetail.actionFailed', 'Action failed.'));
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

  const handleDiscard = () =>
    withAction(async () => {
      const confirmed = await confirm({
        title: t('sales.quoteDetail.discardTitle', 'Discard Quotation'),
        message: t('sales.quoteDetail.discardMessage', 'This will permanently delete this draft quotation. This action cannot be undone.'),
        confirmLabel: t('sales.quoteDetail.discard', 'Discard'),
        tone: 'danger',
      });
      if (!confirmed) return;
      await salesOperationalApi.deleteQuote(form.id!);
      errorHandler.showSuccess(t('sales.quoteDetail.discardSuccess', 'Quotation discarded.'));
      navigate('/sales/quotes');
    });

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('sales.quoteDetail.pageTitle', 'Quotation')}</h1>
        <Card className="p-6">{t('sales.quoteDetail.loadingQuotation', 'Loading quotation...')}</Card>
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
                {form.quoteNumber
                  ? t('sales.quoteDetail.titleWithNumber', { number: form.quoteNumber, defaultValue: 'Quote {{number}}' })
                  : t('sales.quoteDetail.newQuotation', 'New Quotation')}
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">
                {t('sales.quoteDetail.subtitle', 'Sales Quote')}
                {form.id && ` · v${form.id ? (form as any).version ?? '' : ''}`}
              </p>
            </div>
            <StatusChip status={form.status} type="quote" />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isDraft && (
              <>
                <button
                  type="button"
                  onClick={saveQuote}
                  disabled={saving || actionBusy}
                  className={btnPrimary}
                >
                  {saving ? t('sales.quoteDetail.saving', 'Saving...') : t('sales.quoteDetail.save', 'Save')}
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={saving || actionBusy}
                  className={btnNeutral}
                >
                  {t('sales.quoteDetail.send', 'Send')}
                </button>
                {form.id && (
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={saving || actionBusy}
                    className={btnDanger}
                  >
                    {t('sales.quoteDetail.discard', 'Discard')}
                  </button>
                )}
              </>
            )}

            {form.status === 'SENT' && (
              <>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={actionBusy}
                  className={btnPrimary}
                >
                  {t('sales.quoteDetail.accept', 'Accept')}
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={actionBusy}
                  className={btnDanger}
                >
                  {t('sales.quoteDetail.reject', 'Reject')}
                </button>
                <button
                  type="button"
                  onClick={handleRevise}
                  disabled={actionBusy}
                  className={btnNeutral}
                >
                  {t('sales.quoteDetail.revise', 'Revise')}
                </button>
              </>
            )}

            {form.status === 'ACCEPTED' && (
              <>
                <button
                  type="button"
                  onClick={handleConvertToOrder}
                  disabled={actionBusy}
                  className={btnPrimary}
                >
                  {t('sales.quoteDetail.convertToOrder', 'Convert to Sales Order')}
                </button>
                <button
                  type="button"
                  onClick={handleConvertToInvoice}
                  disabled={actionBusy}
                  className={btnNeutral}
                >
                  {t('sales.quoteDetail.convertToInvoice', 'Convert to Invoice')}
                </button>
              </>
            )}

            {form.status === 'REJECTED' && (
              <button
                type="button"
                onClick={handleRevise}
                disabled={actionBusy}
                className={btnPrimary}
              >
                {t('sales.quoteDetail.revise', 'Revise')}
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
              {t('sales.quoteDetail.convertedNotice', {
                target:
                  form.convertedToType === 'SALES_ORDER'
                    ? t('sales.quoteDetail.convertedToOrder', 'Sales Order')
                    : t('sales.quoteDetail.convertedToInvoice', 'Sales Invoice'),
                defaultValue: 'Converted to {{target}} —',
              })}{' '}
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
          <Card className="overflow-visible p-0">
            <DocumentHeaderGrid>
              <DocumentHeaderField label={t('sales.quoteDetail.customer', 'Customer')}>
                <PartySelector
                  className={documentHeaderSelectorClass}
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
              </DocumentHeaderField>

              <DocumentHeaderField label={t('sales.quoteDetail.salesperson', 'Salesperson')}>
                <select
                  className={documentHeaderControlClass}
                  value={form.salespersonId ?? ''}
                  disabled={isReadOnly}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, salespersonId: e.target.value || undefined }))
                  }
                >
                  <option value="">{t('sales.quoteDetail.none', '— None —')}</option>
                  {salespersons.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </DocumentHeaderField>

              <DocumentHeaderField label={t('sales.quoteDetail.quoteDate', 'Quote Date')}>
                <DatePicker
                  className="w-full"
                  inputClassName={documentHeaderControlClass}
                  value={form.quoteDate}
                  disabled={isReadOnly}
                  onChange={(val) => setForm((prev) => ({ ...prev, quoteDate: val }))}
                />
              </DocumentHeaderField>

              <DocumentHeaderField label={t('sales.quoteDetail.validUntil', 'Valid Until')}>
                <DatePicker
                  className="w-full"
                  inputClassName={documentHeaderControlClass}
                  value={form.validUntil}
                  disabled={isReadOnly}
                  onChange={(val) => setForm((prev) => ({ ...prev, validUntil: val }))}
                />
              </DocumentHeaderField>

              <DocumentHeaderField label={t('sales.quoteDetail.currency', 'Currency')}>
                <CurrencySelector
                  className={documentHeaderSelectorClass}
                  value={form.currency}
                  disabled={isReadOnly || saving || actionBusy}
                  onChange={(code) => setForm((prev) => ({ ...prev, currency: code }))}
                />
              </DocumentHeaderField>

              <DocumentHeaderField label={t('sales.quoteDetail.exchangeRate', 'Exchange Rate')}>
                <CurrencyExchangeWidget
                  currency={form.currency}
                  baseCurrency={company?.baseCurrency || 'USD'}
                  voucherDate={form.quoteDate}
                  value={form.exchangeRate}
                  disabled={isReadOnly || saving || actionBusy}
                  onChange={(rate) => setForm((prev) => ({ ...prev, exchangeRate: rate }))}
                />
              </DocumentHeaderField>
            </DocumentHeaderGrid>

            <div className="px-3 pb-3">
              <label className={documentHeaderLabelClass}>
                {t('sales.quoteDetail.notes', 'Notes')}
              </label>
              <textarea
                rows={3}
                className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900"
                value={form.notes}
                disabled={isReadOnly}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={t('sales.quoteDetail.notesPlaceholder', 'Notes visible to the customer...')}
              />
            </div>
          </Card>

          <ClassicLineItemsTable<EditableLine>
            tableId="sales.quotation.lines"
            title={t('sales.quoteDetail.lineItems', 'Line Items')}
            rows={form.lines}
            disabled={isReadOnly}
            onRowChange={setLine}
            onRowRemove={!isReadOnly ? removeLine : undefined}
            onRowsChange={!isReadOnly ? (lines) => setForm((prev) => ({ ...prev, lines })) : undefined}
            createEmptyRow={createEmptyLine}
            isRowFilled={(line) => Boolean(line.itemId || line.itemCode || line.itemName || line.description)}
            onRowAdd={!isReadOnly ? addLine : undefined}
            addLabel={t('sales.quoteDetail.addLine', 'Add Line')}
            minTableWidth="1120px"
            columns={[
              {
                id: 'item',
                label: t('sales.quoteDetail.colItem', 'Item'),
                kind: 'custom',
                width: '260px',
                render: (line, index) => isReadOnly ? (
                  <div className="flex h-9 items-center px-2 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{line.itemCode}</span>
                    {line.itemName && <span className="ml-1 text-slate-500">{line.itemName}</span>}
                  </div>
                ) : (
                  <ItemSelector
                    value={line.itemId}
                    noBorder
                    onChange={(item) => {
                      if (!item) {
                        const empty = createEmptyLine();
                        setLine(index, {
                          itemId: empty.itemId,
                          itemCode: empty.itemCode,
                          itemName: empty.itemName,
                          quotedQty: empty.quotedQty,
                          uomId: empty.uomId,
                          uom: empty.uom,
                          unitPriceDoc: empty.unitPriceDoc,
                          discountType: empty.discountType,
                          discountValue: empty.discountValue,
                          taxCodeId: empty.taxCodeId,
                          description: empty.description,
                        });
                        return;
                      }
                      const patch: Partial<EditableLine> = {
                        itemId: item.id,
                        itemCode: item.code,
                        itemName: item.name,
                        uom: item.salesUom || item.baseUom || 'EA',
                        uomId: item.salesUomId || item.baseUomId,
                      };
                      if (!line.taxCodeId && item.defaultSalesTaxCodeId) patch.taxCodeId = item.defaultSalesTaxCodeId;
                      setLine(index, patch);
                    }}
                  />
                ),
              } as ColumnDef<EditableLine>,
              { id: 'qty', label: t('sales.quoteDetail.colQty', 'Qty'), kind: 'number', width: '90px', accessor: (line) => line.quotedQty, setter: (value) => ({ quotedQty: Number(value) }) },
              {
                id: 'uom',
                label: t('sales.quoteDetail.colUom', 'UOM'),
                kind: 'custom',
                width: '90px',
                render: (line, index) => isReadOnly ? (
                  <div className="flex h-9 items-center px-2 text-xs uppercase text-slate-700 dark:text-slate-200">{line.uom}</div>
                ) : (
                  <UomSelector
                    item={itemById[line.itemId]}
                    itemId={line.itemId}
                    valueId={line.uomId}
                    valueCode={line.uom}
                    usage="sales"
                    disabled={!line.itemId}
                    noBorder
                    onChange={(selected) => setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' })}
                  />
                ),
              },
              { id: 'unitPrice', label: t('sales.quoteDetail.colUnitPrice', 'Unit Price'), kind: 'number', width: '115px', accessor: (line) => line.unitPriceDoc, setter: (value) => ({ unitPriceDoc: Number(value) }) },
              {
                id: 'discountType',
                label: t('sales.quoteDetail.colDiscType', 'Disc. Type'),
                kind: 'custom',
                width: '64px',
                render: (line, index) => (
                  <DiscountTypeSelector
                    noBorder
                    value={line.discountType}
                    currencyCode={form.currency}
                    disabled={isReadOnly || !line.itemId}
                    onChange={(next) => setLine(index, { discountType: next || undefined, discountValue: undefined })}
                  />
                ),
              },
              { id: 'discountValue', label: t('sales.quoteDetail.colDiscValue', 'Disc. Value'), kind: 'number', width: '90px', accessor: (line) => line.discountValue ?? '', setter: (value) => ({ discountValue: value ? Number(value) : undefined }) },
              {
                id: 'taxCode',
                label: t('sales.quoteDetail.colTaxCode', 'Tax Code'),
                kind: 'custom',
                width: '120px',
                render: (line, index) => (
                  <TaxCodeSelector
                    noBorder
                    options={salesTaxCodes.map((tc) => ({ id: tc.id, code: tc.code, name: tc.name, rate: tc.rate }))}
                    valueId={line.taxCodeId}
                    disabled={isReadOnly || !line.itemId}
                    emptySetupMessage={t(
                      'sales.quoteDetail.taxCodeEmptyHint',
                      'No sales tax codes set up. Create one with scope SALES or BOTH to use it here.',
                    )}
                    onChange={(option) => setLine(index, { taxCodeId: option?.id })}
                  />
                ),
              },
              {
                id: 'lineTotal',
                label: t('sales.quoteDetail.colLineTotal', 'Line Total'),
                kind: 'computed',
                width: '120px',
                compute: (_line, index) => computedLines[index]?.lineTotalDoc || 0,
                formatter: (value) => `${form.currency} ${Number(value).toFixed(2)}`,
                solveFromTotal: (value, line) => {
                  const q = Number(line.quotedQty || 0);
                  if (q <= 0 || !Number.isFinite(value)) return { unitPriceDoc: 0 };
                  const dt = line.discountType;
                  const dv = Number(line.discountValue || 0);
                  if (dt === 'PERCENT') {
                    const factor = 1 - dv / 100;
                    if (factor <= 0) return { unitPriceDoc: 0 };
                    return { unitPriceDoc: value / (q * factor) };
                  }
                  if (dt === 'AMOUNT') {
                    return { unitPriceDoc: (value + dv) / q };
                  }
                  return { unitPriceDoc: value / q };
                },
              },
              { id: 'tax', label: t('sales.quoteDetail.colTax', 'Tax'), kind: 'computed', width: '110px', compute: (_line, index) => computedLines[index]?.taxAmountDoc || 0, formatter: (value) => `${form.currency} ${Number(value).toFixed(2)}` },
            ]}
          />

          {/* Totals */}
          <Card className="p-5">
            <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t('sales.quoteDetail.totals', 'Totals')}</h3>
            <div className="space-y-1.5 text-sm max-w-xs ml-auto">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">{t('sales.quoteDetail.subtotal', 'Subtotal')}</span>
                <span className="font-medium">
                  {form.currency} {totals.subtotalDoc.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">{t('sales.quoteDetail.tax', 'Tax')}</span>
                <span className="font-medium">
                  {form.currency} {totals.taxTotalDoc.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{t('sales.quoteDetail.grandTotal', 'Grand Total')}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {form.currency} {totals.grandTotalDoc.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
};

export default QuotationDetailPage;
