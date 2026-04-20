import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryItemDTO, InventoryWarehouseDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreateSalesInvoicePayload,
  SalesInvoiceDTO,
  SalesInvoiceLineInputDTO,
  SalesOrderDTO,
  salesApi,
  SalesSettingsDTO,
} from '../../../api/salesApi';
import { PartyDTO, TaxCodeDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { CurrencyExchangeWidget } from '../../accounting/components/shared/CurrencyExchangeWidget';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { PartySelector, ItemSelector, WarehouseSelector } from '../../../components/shared/selectors';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface EditableLine {
  lineId?: string;
  soLineId?: string;
  dnLineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  invoicedQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

interface EditableForm {
  salesOrderId: string;
  customerId: string;
  customerName?: string;
  customerInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  notes: string;
  lines: EditableLine[];
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  invoicedQty: 1,
  uomId: undefined,
  uom: '',
  unitPriceDoc: 0,
  taxCodeId: undefined,
  warehouseId: undefined,
  description: '',
});

const createEmptyForm = (salesOrderId = '', customerId = ''): EditableForm => ({
  salesOrderId,
  customerId,
  customerInvoiceNumber: '',
  invoiceDate: todayIso(),
  dueDate: '',
  currency: 'USD',
  exchangeRate: 1,
  notes: '',
  lines: [createEmptyLine()],
});

const SalesInvoiceDetailPage: React.FC = () => {
  const { company } = useCompanyAccess();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const initialSalesOrderId = searchParams.get('salesOrderId') || '';
  const initialCustomerId = searchParams.get('customerId') || '';

  const [invoice, setInvoice] = useState<SalesInvoiceDTO | null>(null);
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [form, setForm] = useState<EditableForm>(() => createEmptyForm(initialSalesOrderId, initialCustomerId));
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orderLineLoading, setOrderLineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customerNameById = useMemo(
    () =>
      customers.reduce<Record<string, string>>((acc, customer) => {
        acc[customer.id] = customer.displayName;
        return acc;
      }, {}),
    [customers]
  );

  const itemById = useMemo(
    () =>
      items.reduce<Record<string, InventoryItemDTO>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [items]
  );

  const salesOrderLabelById = useMemo(
    () =>
      salesOrders.reduce<Record<string, string>>((acc, order) => {
        acc[order.id] = `${order.orderNumber} - ${order.customerName}`;
        return acc;
      }, {}),
    [salesOrders]
  );

  const taxById = useMemo(
    () =>
      taxCodes.reduce<Record<string, TaxCodeDTO>>((acc, taxCode) => {
        acc[taxCode.id] = taxCode;
        return acc;
      }, {}),
    [taxCodes]
  );

  const salesTaxCodes = useMemo(
    () => taxCodes.filter((taxCode) => taxCode.scope === 'SALES' || taxCode.scope === 'BOTH'),
    [taxCodes]
  );

  const computedLines = useMemo(() => {
    return form.lines.map((line) => {
      const taxRate = line.taxCodeId ? taxById[line.taxCodeId]?.rate ?? 0 : 0;
      const lineTotalDoc = roundMoney((line.invoicedQty || 0) * (line.unitPriceDoc || 0));
      const lineTotalBase = roundMoney(lineTotalDoc * (form.exchangeRate || 0));
      const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
      const taxAmountBase = roundMoney(lineTotalBase * taxRate);

      return {
        lineTotalDoc,
        lineTotalBase,
        taxAmountDoc,
        taxAmountBase,
      };
    });
  }, [form.exchangeRate, form.lines, taxById]);

  const totals = useMemo(() => {
    const subtotalDoc = roundMoney(computedLines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
    const subtotalBase = roundMoney(computedLines.reduce((sum, line) => sum + line.lineTotalBase, 0));
    const taxTotalDoc = roundMoney(computedLines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    const taxTotalBase = roundMoney(computedLines.reduce((sum, line) => sum + line.taxAmountBase, 0));

    return {
      subtotalDoc,
      subtotalBase,
      taxTotalDoc,
      taxTotalBase,
      grandTotalDoc: roundMoney(subtotalDoc + taxTotalDoc),
      grandTotalBase: roundMoney(subtotalBase + taxTotalBase),
    };
  }, [computedLines]);

  const toEditableLinesFromSalesOrder = (so: SalesOrderDTO): EditableLine[] => {
    return so.lines
      .map((line) => {
        const remainingQty = Math.max(line.orderedQty - line.invoicedQty, 0);
        if (remainingQty <= 0) return null;

        return {
          soLineId: line.lineId,
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          invoicedQty: remainingQty,
          uomId: line.uomId,
          uom: line.uom,
          unitPriceDoc: line.unitPriceDoc,
          taxCodeId: line.taxCodeId,
          warehouseId: line.warehouseId,
          description: line.description,
        } as EditableLine;
      })
      .filter((line): line is EditableLine => line !== null);
  };

  const loadReferenceData = async () => {
    const [settingsResult, customerResult, itemResult, taxResult, warehouseResult, salesOrderResult] = await Promise.all([
      salesApi.getSettings(),
      sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      inventoryApi.listItems({ active: true, limit: 500 }),
      sharedApi.listTaxCodes({ active: true }),
      inventoryApi.listWarehouses({ active: true }),
      salesApi.listSOs({ limit: 500 }),
    ]);

    const currentSettings = unwrap<SalesSettingsDTO | null>(settingsResult);
    const customerList = unwrap<PartyDTO[]>(customerResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);
    const taxCodeList = unwrap<TaxCodeDTO[]>(taxResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
    const salesOrderList = unwrap<SalesOrderDTO[]>(salesOrderResult);

    setSettings(currentSettings);
    setCustomers(Array.isArray(customerList) ? customerList : []);
    setItems(Array.isArray(itemList) ? itemList : []);
    setTaxCodes(Array.isArray(taxCodeList) ? taxCodeList : []);
    setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
    setSalesOrders(Array.isArray(salesOrderList) ? salesOrderList : []);
  };

  const ensureItemUomOptions = async (itemId: string) => {
    if (!itemId || uomOptionsByItemId[itemId] || !itemById[itemId]) return;
    try {
      const result = await inventoryApi.listUomConversions(itemId);
      const conversions = unwrap<UomConversionDTO[]>(result) || [];
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], conversions),
      }));
    } catch (loadError) {
      console.error('Failed to load UOM conversions', loadError);
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], []),
      }));
    }
  };

  const loadSalesOrderLines = async (orderId: string) => {
    const trimmedOrderId = orderId.trim();
    if (!trimmedOrderId) return;

    try {
      setOrderLineLoading(true);
      setError(null);

      const orderResult = await salesApi.getSO(trimmedOrderId);
      const so = unwrap<SalesOrderDTO>(orderResult);
      const nextLines = toEditableLinesFromSalesOrder(so);

      setForm((prev) => ({
        ...prev,
        salesOrderId: trimmedOrderId,
        customerId: so.customerId,
        currency: so.currency,
        exchangeRate: so.exchangeRate,
        lines: nextLines.length ? nextLines : [createEmptyLine()],
      }));
    } catch (err: any) {
      console.error('Failed to load sales order lines', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load sales order lines.'
      );
    } finally {
      setOrderLineLoading(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      await loadReferenceData();

      if (!isCreateMode && params.id) {
        const result = await salesApi.getSI(params.id);
        const loaded = unwrap<SalesInvoiceDTO>(result);
        setInvoice(loaded);
      } else {
        setInvoice(null);
        setForm(createEmptyForm(initialSalesOrderId, initialCustomerId));
        if (initialSalesOrderId) {
          await loadSalesOrderLines(initialSalesOrderId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load sales invoice detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load sales invoice.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ids = Array.from(new Set(form.lines.map((line) => line.itemId).filter(Boolean)));
    ids.forEach((itemId) => {
      void ensureItemUomOptions(itemId);
    });
  }, [form.lines, itemById]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (index: number, patch: Partial<EditableLine>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      const current = lines[index];
      const next: EditableLine = { ...current, ...patch };

      if (patch.itemId !== undefined) {
        const item = itemById[patch.itemId];
        if (item) {
          const defaultUom = getDefaultItemUomOption(item, 'sales');
          next.itemCode = item.code;
          next.itemName = item.name;
          next.uomId = next.uomId || defaultUom?.uomId;
          next.uom = next.uom || defaultUom?.code || item.salesUom || item.baseUom;
          if (!next.warehouseId && settings?.defaultWarehouseId) {
            next.warehouseId = settings.defaultWarehouseId;
          }
          if (!next.taxCodeId && item.defaultSalesTaxCodeId) {
            const defaultTax = salesTaxCodes.find((taxCode) => taxCode.id === item.defaultSalesTaxCodeId);
            if (defaultTax) next.taxCodeId = defaultTax.id;
          }
        } else {
          next.itemCode = undefined;
          next.itemName = undefined;
          next.taxCodeId = undefined;
        }
      }

      lines[index] = next;
      return { ...prev, lines };
    });
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, createEmptyLine()] }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((_, idx) => idx !== index),
      };
    });
  };

  const validateBeforeSave = (): string | null => {
    if (!form.customerId) return 'Customer is required.';
    if (!form.invoiceDate) return 'Invoice date is required.';
    if (!form.currency.trim()) return 'Currency is required.';
    if (Number.isNaN(form.exchangeRate) || form.exchangeRate <= 0) return 'Exchange rate must be greater than 0.';
    if (!form.lines.length) return 'At least one line is required.';

    for (let i = 0; i < form.lines.length; i += 1) {
      const line = form.lines[i];
      if (!line.itemId) return `Line ${i + 1}: item is required.`;
      if (Number.isNaN(line.unitPriceDoc) || line.unitPriceDoc < 0) {
        return `Line ${i + 1}: unit price must be greater than or equal to 0.`;
      }

      const item = itemById[line.itemId];
      if (item?.trackInventory && !line.warehouseId) {
        return `Line ${i + 1}: warehouse is required for stock item ${item.name}.`;
      }
    }

    return null;
  };

  const buildLinePayload = (line: EditableLine, index: number): SalesInvoiceLineInputDTO => {
    const item = itemById[line.itemId];
    return {
      lineId: line.lineId,
      lineNo: index + 1,
      soLineId: line.soLineId || undefined,
      dnLineId: line.dnLineId || undefined,
      itemId: line.itemId || undefined,
      invoicedQty: line.invoicedQty,
      uomId: line.uomId,
      uom: line.uom || item?.salesUom || item?.baseUom || 'EA',
      unitPriceDoc: line.unitPriceDoc,
      taxCodeId: line.taxCodeId || undefined,
      warehouseId: line.warehouseId || undefined,
      description: line.description || undefined,
    };
  };

  const createDraft = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const payload: CreateSalesInvoicePayload = {
        salesOrderId: form.salesOrderId || undefined,
        customerId: form.customerId,
        customerInvoiceNumber: form.customerInvoiceNumber || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        currency: form.currency.toUpperCase(),
        exchangeRate: form.exchangeRate,
        lines: form.lines.map((line, index) => buildLinePayload(line, index)),
        notes: form.notes || undefined,
      };

      const created = await salesApi.createSI(payload);
      const dto = unwrap<SalesInvoiceDTO>(created);
      navigate(`/sales/invoices/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create sales invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to create sales invoice draft.'
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
      const posted = await salesApi.postSI(invoice.id);
      setInvoice(unwrap<SalesInvoiceDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post sales invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to post sales invoice.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Invoice</h1>
        <Card className="p-6">Loading sales invoice...</Card>
      </div>
    );
  }

  if (isCreateMode) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Sales Invoice</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => navigate('/sales/invoices')}
          >
            Back to List
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sales Order (optional)</label>
              <div className="flex gap-2">
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={form.salesOrderId}
                  onChange={(e) => setForm((prev) => ({ ...prev, salesOrderId: e.target.value }))}
                >
                  <option value="">No sales order</option>
                  {salesOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} - {order.customerName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium disabled:opacity-50"
                  onClick={() => loadSalesOrderLines(form.salesOrderId)}
                  disabled={busy || orderLineLoading || !form.salesOrderId.trim()}
                >
                  {orderLineLoading ? 'Loading...' : 'Load SO Lines'}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Customer</label>
              <PartySelector 
                value={form.customerId}
                onChange={(party) => {
                  setForm((prev) => ({
                    ...prev,
                    customerId: party?.id || '',
                    customerName: party?.displayName || '',
                    currency: party?.defaultCurrency || prev.currency,
                  }));
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Customer Invoice #</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.customerInvoiceNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, customerInvoiceNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Invoice Date</label>
              <DatePicker 
                value={form.invoiceDate}
                onChange={(val) => setForm((prev) => ({ ...prev, invoiceDate: val }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Due Date (optional)</label>
              <DatePicker 
                value={form.dueDate}
                onChange={(val) => setForm((prev) => ({ ...prev, dueDate: val }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Currency</label>
              <CurrencySelector
                value={form.currency}
                onChange={(code) => setForm((prev) => ({ ...prev, currency: code }))}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Exchange Rate</label>
              <CurrencyExchangeWidget
                currency={form.currency}
                baseCurrency={company?.baseCurrency || 'USD'}
                voucherDate={form.invoiceDate}
                value={form.exchangeRate}
                onChange={(rate) => setForm((prev) => ({ ...prev, exchangeRate: rate }))}
                disabled={busy}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="mt-4 text-xs text-slate-500">
            If a Sales Order is selected, you can load the remaining order lines into this draft.
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Line Items</h2>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              onClick={addLine}
              disabled={busy}
            >
              Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-left">UOM</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-left">Tax Code</th>
                  <th className="py-2 text-left">Warehouse</th>
                  <th className="py-2 text-right">Line Total</th>
                  <th className="py-2 text-right">Tax</th>
                  <th className="py-2 text-right">Line Base</th>
                  <th className="py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, index) => (
                  <tr key={line.lineId || `line-${index}`} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2">
                      <ItemSelector 
                        value={line.itemId}
                        onChange={(item) => {
                          if (item) {
                            const defaultUom = getDefaultItemUomOption(item, 'sales');
                            setLine(index, {
                              itemId: item.id,
                              itemCode: item.code,
                              itemName: item.name,
                              uomId: defaultUom?.uomId,
                              uom: defaultUom?.code || item.salesUom || item.baseUom,
                            });
                          } else {
                            setLine(index, { itemId: '', itemCode: '', itemName: '', uomId: undefined, uom: '' });
                          }
                        }}
                      />
                      {(line.itemCode || line.itemName) && (
                        <div className="mt-1 text-xs text-slate-500">
                          {(line.itemCode || '') + (line.itemName ? ` - ${line.itemName}` : '')}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0.000001}
                        step={0.000001}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
                        value={line.invoicedQty}
                        onChange={(e) => setLine(index, { invoicedQty: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 uppercase"
                        value={
                          findItemUomOption(uomOptionsByItemId[line.itemId] || [], line.uomId, line.uom)?.uomId ||
                          line.uomId ||
                          line.uom
                        }
                        disabled={!line.itemId}
                        onChange={(e) => {
                          const selected = (uomOptionsByItemId[line.itemId] || []).find(
                            (option) => (option.uomId || option.code) === e.target.value
                          );
                          setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' });
                        }}
                      >
                        <option value="">{line.itemId ? 'Select UOM' : 'No item'}</option>
                        {(uomOptionsByItemId[line.itemId] || []).map((option) => (
                          <option key={option.uomId || option.code} value={option.uomId || option.code}>
                            {option.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
                        value={line.unitPriceDoc}
                        onChange={(e) => setLine(index, { unitPriceDoc: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        className="w-40 rounded-lg border border-slate-300 px-2 py-1.5"
                        value={line.taxCodeId || ''}
                        onChange={(e) => setLine(index, { taxCodeId: e.target.value || undefined })}
                      >
                        <option value="">No Tax</option>
                        {salesTaxCodes.map((taxCode) => (
                          <option key={taxCode.id} value={taxCode.id}>
                            {taxCode.code} ({Math.round(taxCode.rate * 100)}%)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <WarehouseSelector 
                        value={line.warehouseId}
                        onChange={(wh) => setLine(index, { warehouseId: wh?.id || undefined })}
                      />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {form.currency} {computedLines[index]?.lineTotalDoc.toFixed(2)}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {form.currency} {computedLines[index]?.taxAmountDoc.toFixed(2)}
                    </td>
                    <td className="py-2 pr-2 text-right">{computedLines[index]?.lineTotalBase.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                        onClick={() => removeLine(index)}
                        disabled={busy || form.lines.length <= 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Totals</h3>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal ({form.currency})</span>
              <span className="font-medium">
                {form.currency} {totals.subtotalDoc.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal (Base)</span>
              <span className="font-medium">{totals.subtotalBase.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Tax ({form.currency})</span>
              <span className="font-medium">
                {form.currency} {totals.taxTotalDoc.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Tax (Base)</span>
              <span className="font-medium">{totals.taxTotalBase.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Grand Total ({form.currency})</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {form.currency} {totals.grandTotalDoc.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Grand Total (Base)</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{totals.grandTotalBase.toFixed(2)}</span>
            </div>
          </div>
        </Card>

        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={createDraft}
          disabled={busy || orderLineLoading}
        >
          {busy ? 'Creating...' : 'Create Draft Invoice'}
        </button>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Invoice</h1>
        <Card className="p-6 text-sm text-red-700">Sales invoice not found.</Card>
      </div>
    );
  }

  const canCreateReceipt = invoice.status === 'POSTED' && invoice.outstandingAmountBase > 0;
  const receiptHref = `/accounting/vouchers?mode=create&type=receipt&sourceType=SALES_INVOICE&sourceId=${invoice.id}`;
  const createReturnHref = `/sales/returns/new?salesInvoiceId=${encodeURIComponent(invoice.id)}${invoice.salesOrderId ? `&salesOrderId=${encodeURIComponent(invoice.salesOrderId)}` : ''}`;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-slate-600">
            Customer: <span className="font-medium">{customerNameById[invoice.customerId] || invoice.customerName}</span>
            {invoice.customerInvoiceNumber ? ` • Customer Ref: ${invoice.customerInvoiceNumber}` : ''}
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
            <div className="text-xs uppercase tracking-wide text-slate-500">SO Reference</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {(invoice.salesOrderId && salesOrderLabelById[invoice.salesOrderId]) || invoice.salesOrderId || '-'}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Currency</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.currency}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Exchange Rate</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{invoice.exchangeRate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Direct Invoicing</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {settings ? (settings.allowDirectInvoicing ? 'Enabled' : 'Disabled') : '-'}
            </div>
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
          onClick={() => navigate('/sales/invoices')}
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
            className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700"
            onClick={() => navigate(createReturnHref)}
          >
            Create Return
          </button>
        )}
        {invoice.status === 'POSTED' && (
          <button
            type="button"
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => navigate(receiptHref)}
            disabled={!canCreateReceipt}
          >
            Create Receipt
          </button>
        )}
      </div>
    </div>
  );
};

export default SalesInvoiceDetailPage;

