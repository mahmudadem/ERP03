import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryItemDTO, InventoryWarehouseDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreateSalesInvoicePayload,
  InvoiceableLinkedSalesSourceDTO,
  SalesInvoiceDTO,
  SalesInvoiceLineInputDTO,
  SalesOrderDTO,
  salesApi,
  SalesSettingsDTO,
} from '../../../api/salesApi';
import { PartyDTO, TaxCodeDTO, sharedApi } from '../../../api/sharedApi';
import { salesMasterDataApi, SalespersonDTO } from '../../../api/salesMasterDataApi';
import { Card } from '../../../components/ui/Card';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { CurrencyExchangeWidget } from '../../accounting/components/shared/CurrencyExchangeWidget';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { AccountSelector } from '../../accounting/components/shared/AccountSelector';
import { PartySelector, ItemSelector, WarehouseSelector } from '../../../components/shared/selectors';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';
import { isPersonaAllowedByGovernance, resolveSalesWorkflowMode } from '../../../utils/documentPolicy';

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
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
}

interface EditableCharge {
  chargeId?: string;
  code?: string;
  name: string;
  amountDoc: number;
  taxCodeId?: string;
  revenueAccountId?: string;
  description?: string;
}

interface EditableForm {
  salesOrderId: string;
  customerId: string;
  customerName?: string;
  salespersonId?: string;
  customerInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  notes: string;
  lines: EditableLine[];
  charges: EditableCharge[];
}

interface SettlementRowState {
  settlementAccountId: string;
  amountBase: number;
  paymentMethod: string;
  reference: string;
  notes: string;
  paymentDate: string;
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  invoicedQty: 1,
  uomId: undefined,
  uom: '',
  unitPriceDoc: 0,
  discountType: undefined,
  discountValue: 0,
  taxCodeId: undefined,
  warehouseId: undefined,
  description: '',
});

const createEmptyCharge = (): EditableCharge => ({
  name: '',
  amountDoc: 0,
  taxCodeId: undefined,
  revenueAccountId: undefined,
  description: '',
});

const createEmptyForm = (salesOrderId = '', customerId = ''): EditableForm => ({
  salesOrderId,
  customerId,
  salespersonId: undefined,
  customerInvoiceNumber: '',
  invoiceDate: todayIso(),
  dueDate: '',
  currency: 'USD',
  exchangeRate: 1,
  notes: '',
  lines: [createEmptyLine()],
  charges: [],
});

const SalesInvoiceDetailPage: React.FC = () => {
  const { t } = useTranslation();
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
  const [salespersons, setSalespersons] = useState<SalespersonDTO[]>([]);
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

  // Settlement state
  const [settlementMode, setSettlementMode] = useState<'DEFERRED' | 'CASH_FULL' | 'MULTI'>('DEFERRED');
  const [arAccountId, setArAccountId] = useState('');
  const [settlementRows, setSettlementRows] = useState<SettlementRowState[]>([]);
  const [showSettlement, setShowSettlement] = useState(false);
  const enabledPaymentMethodConfigs = useMemo(
    () => (settings?.paymentMethodConfigs || []).filter((config) => config.isEnabled !== false),
    [settings]
  );
  const currentInvoiceFormType = form.salesOrderId ? 'sales_invoice_linked' : 'sales_invoice_direct';
  const currentInvoicePersona = form.salesOrderId ? 'linked' : 'direct';
  const isCurrentPersonaAllowed = settings
    ? isPersonaAllowedByGovernance(
        resolveSalesWorkflowMode(settings),
        settings.governanceRules,
        currentInvoicePersona,
        { formType: currentInvoiceFormType }
      )
    : true;
  const isDirectInvoiceAllowed = settings
    ? isPersonaAllowedByGovernance(
        resolveSalesWorkflowMode(settings),
        settings.governanceRules,
        'direct',
        { formType: 'sales_invoice_direct' }
      )
    : false;

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
      const grossLineTotalDoc = roundMoney((line.invoicedQty || 0) * (line.unitPriceDoc || 0));
      const discountValue = Number(line.discountValue || 0);
      const discountAmountDoc = line.discountType === 'PERCENT'
        ? roundMoney(Math.max(0, Math.min(grossLineTotalDoc, grossLineTotalDoc * (discountValue / 100))))
        : line.discountType === 'AMOUNT'
          ? roundMoney(Math.max(0, Math.min(grossLineTotalDoc, discountValue)))
          : 0;
      const lineTotalDoc = roundMoney(grossLineTotalDoc - discountAmountDoc);
      const lineTotalBase = roundMoney(lineTotalDoc * (form.exchangeRate || 0));
      const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
      const taxAmountBase = roundMoney(lineTotalBase * taxRate);

      return {
        grossLineTotalDoc,
        discountAmountDoc,
        lineTotalDoc,
        lineTotalBase,
        taxAmountDoc,
        taxAmountBase,
      };
    });
  }, [form.exchangeRate, form.lines, taxById]);

  const computedCharges = useMemo(() => {
    return form.charges.map((charge) => {
      const taxRate = charge.taxCodeId ? taxById[charge.taxCodeId]?.rate ?? 0 : 0;
      const amountDoc = roundMoney(charge.amountDoc || 0);
      const amountBase = roundMoney(amountDoc * (form.exchangeRate || 0));
      const taxAmountDoc = roundMoney(amountDoc * taxRate);
      const taxAmountBase = roundMoney(amountBase * taxRate);
      return { amountDoc, amountBase, taxAmountDoc, taxAmountBase };
    });
  }, [form.charges, form.exchangeRate, taxById]);

  const totals = useMemo(() => {
    const subtotalDoc = roundMoney(
      computedLines.reduce((sum, line) => sum + line.lineTotalDoc, 0)
      + computedCharges.reduce((sum, charge) => sum + charge.amountDoc, 0)
    );
    const subtotalBase = roundMoney(
      computedLines.reduce((sum, line) => sum + line.lineTotalBase, 0)
      + computedCharges.reduce((sum, charge) => sum + charge.amountBase, 0)
    );
    const taxTotalDoc = roundMoney(
      computedLines.reduce((sum, line) => sum + line.taxAmountDoc, 0)
      + computedCharges.reduce((sum, charge) => sum + charge.taxAmountDoc, 0)
    );
    const taxTotalBase = roundMoney(
      computedLines.reduce((sum, line) => sum + line.taxAmountBase, 0)
      + computedCharges.reduce((sum, charge) => sum + charge.taxAmountBase, 0)
    );

    return {
      subtotalDoc,
      subtotalBase,
      taxTotalDoc,
      taxTotalBase,
      grandTotalDoc: roundMoney(subtotalDoc + taxTotalDoc),
      grandTotalBase: roundMoney(subtotalBase + taxTotalBase),
    };
  }, [computedCharges, computedLines]);

  const toEditableLinesFromLinkedSource = (source: InvoiceableLinkedSalesSourceDTO): EditableLine[] => {
    return source.lines.map((line) => ({
      soLineId: line.soLineId,
      dnLineId: line.dnLineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      invoicedQty: line.remainingQty,
      uomId: line.uomId,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      taxCodeId: line.taxCodeId,
      warehouseId: line.warehouseId,
      description: line.description,
    }));
  };

  const loadReferenceData = async () => {
    const [settingsResult, customerResult, itemResult, taxResult, warehouseResult, salesOrderResult, salespersonResult] = await Promise.all([
      salesApi.getSettings(),
      sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      inventoryApi.listItems({ active: true, limit: 500 }),
      sharedApi.listTaxCodes({ active: true }),
      inventoryApi.listWarehouses({ active: true }),
      salesApi.listSOs({ limit: 500 }),
      salesMasterDataApi.listSalespersons({ status: 'ACTIVE' }),
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
    setSalespersons(Array.isArray(salespersonResult) ? salespersonResult : []);
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

      const sourceResult = await salesApi.getInvoiceableLinkedSource(trimmedOrderId);
      const source = unwrap<InvoiceableLinkedSalesSourceDTO>(sourceResult);
      const nextLines = toEditableLinesFromLinkedSource(source);

      setForm((prev) => ({
        ...prev,
        salesOrderId: trimmedOrderId,
        customerId: source.customerId,
        customerName: source.customerName,
        currency: source.currency,
        exchangeRate: source.exchangeRate,
        lines: nextLines.length ? nextLines : [createEmptyLine()],
      }));
    } catch (err: any) {
      console.error('Failed to load invoiceable linked lines', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load invoiceable linked lines.'
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

    // Auto-pricing: after item or qty change, look up effective price.
    // The changed field comes from `patch`; the unchanged one is read from the
    // pre-patch closure (its value is identical before and after the patch).
    const shouldFetchPrice = patch.itemId !== undefined || patch.invoicedQty !== undefined;
    if (shouldFetchPrice) {
      const closureLine = form.lines[index];
      const resolvedItemId = patch.itemId !== undefined ? patch.itemId : closureLine?.itemId;
      const resolvedQty = patch.invoicedQty !== undefined ? patch.invoicedQty : closureLine?.invoicedQty ?? 1;
      if (form.customerId && resolvedItemId) {
        salesMasterDataApi
          .getEffectivePrice({ customerId: form.customerId, itemId: resolvedItemId, qty: resolvedQty })
          .then((result) => {
            if (result?.unitPrice != null) {
              setForm((latest) => {
                const updatedLines = [...latest.lines];
                if (updatedLines[index]) {
                  updatedLines[index] = { ...updatedLines[index], unitPriceDoc: result.unitPrice };
                }
                return { ...latest, lines: updatedLines };
              });
            }
          })
          .catch(() => {
            // Pricing lookup failure is non-fatal — leave price as-is
          });
      }
    }
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, createEmptyLine()] }));
  };

  const setCharge = (index: number, patch: Partial<EditableCharge>) => {
    setForm((prev) => {
      const charges = [...prev.charges];
      charges[index] = { ...charges[index], ...patch };
      return { ...prev, charges };
    });
  };

  const addCharge = () => {
    setForm((prev) => ({ ...prev, charges: [...prev.charges, createEmptyCharge()] }));
  };

  const removeCharge = (index: number) => {
    setForm((prev) => ({
      ...prev,
      charges: prev.charges.filter((_, idx) => idx !== index),
    }));
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
      if (line.discountType && (Number.isNaN(line.discountValue || 0) || (line.discountValue || 0) < 0)) {
        return `Line ${i + 1}: discount must be greater than or equal to 0.`;
      }

      const item = itemById[line.itemId];
      if (item?.trackInventory && !line.dnLineId && !line.warehouseId) {
        return `Line ${i + 1}: warehouse is required for stock item ${item.name}.`;
      }
    }

    for (let i = 0; i < form.charges.length; i += 1) {
      const charge = form.charges[i];
      if (!charge.name.trim()) return `Charge ${i + 1}: name is required.`;
      if (Number.isNaN(charge.amountDoc) || charge.amountDoc < 0) {
        return `Charge ${i + 1}: amount must be greater than or equal to 0.`;
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
      discountType: line.discountType,
      discountValue: line.discountType ? line.discountValue || 0 : undefined,
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
        source: 'native',
        salesOrderId: form.salesOrderId || undefined,
        customerId: form.customerId,
        salespersonId: form.salespersonId || undefined,
        customerInvoiceNumber: form.customerInvoiceNumber || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        currency: form.currency.toUpperCase(),
        exchangeRate: form.exchangeRate,
        lines: form.lines.map((line, index) => buildLinePayload(line, index)),
        charges: form.charges.map((charge) => ({
          chargeId: charge.chargeId,
          code: charge.code || undefined,
          name: charge.name,
          amountDoc: charge.amountDoc,
          taxCodeId: charge.taxCodeId || undefined,
          revenueAccountId: charge.revenueAccountId || undefined,
          description: charge.description || undefined,
        })),
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

  const createAndPostDraft = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const outstanding = roundMoney(totals.grandTotalBase);
      const useSettlement = settlementMode !== 'DEFERRED' && outstanding > 0.005;

      const settlementInput = useSettlement ? {
        settlementMode,
        receivablePayableAccountId: arAccountId || undefined,
        settlements: settlementRows.map(r => ({
          settlementAccountId: r.settlementAccountId || undefined,
          amountBase: r.amountBase,
          paymentMethod: r.paymentMethod as any,
          reference: r.reference || undefined,
          notes: r.notes || undefined,
          paymentDate: r.paymentDate || undefined,
        })),
      } : undefined;

      const payload: CreateSalesInvoicePayload = {
        source: 'native',
        salesOrderId: form.salesOrderId || undefined,
        customerId: form.customerId,
        salespersonId: form.salespersonId || undefined,
        customerInvoiceNumber: form.customerInvoiceNumber || undefined,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        currency: form.currency.toUpperCase(),
        exchangeRate: form.exchangeRate,
        lines: form.lines.map((line, index) => buildLinePayload(line, index)),
        charges: form.charges.map((charge) => ({
          chargeId: charge.chargeId,
          code: charge.code || undefined,
          name: charge.name,
          amountDoc: charge.amountDoc,
          taxCodeId: charge.taxCodeId || undefined,
          revenueAccountId: charge.revenueAccountId || undefined,
          description: charge.description || undefined,
        })),
        notes: form.notes || undefined,
        settlementInput,
      };

      const created = await salesApi.createAndPostSI(payload);
      const dto = unwrap<SalesInvoiceDTO>(created);
      navigate(`/sales/invoices/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create and post sales invoice', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to create and post sales invoice.'
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

      const settlementInput = settlementMode !== 'DEFERRED' ? {
        settlementMode,
        receivablePayableAccountId: arAccountId || undefined,
        settlements: settlementRows.map(r => ({
          settlementAccountId: r.settlementAccountId || undefined,
          amountBase: r.amountBase,
          paymentMethod: r.paymentMethod as any,
          reference: r.reference || undefined,
          notes: r.notes || undefined,
          paymentDate: r.paymentDate || undefined,
        })),
      } : undefined;

      const posted = await salesApi.postSI(invoice.id, settlementInput);
      setInvoice(unwrap<SalesInvoiceDTO>(posted));
      setShowSettlement(false);
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

  const handlePostClick = () => {
    if (!invoice) return;
    const outstanding = roundMoney((invoice.grandTotalBase || 0) - (invoice.paidAmountBase || 0));
    if (outstanding > 0.005) {
      setShowSettlement(true);
      setSettlementRows([{ settlementAccountId: '', amountBase: outstanding, paymentMethod: enabledPaymentMethodConfigs[0]?.method || 'CASH', reference: '', notes: '', paymentDate: todayIso() }]);
    } else {
      postDraft();
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

        {isCreateMode && settings?.workflowMode === 'OPERATIONAL' && !form.salesOrderId && !isCurrentPersonaAllowed && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {t('sales.governance.operationalWarning', 'Operational workflow: Direct invoicing is blocked by default. Select a Sales Order above to create a linked invoice, or contact your administrator to add a direct invoicing governance exception.')}
          </div>
        )}

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
                  {orderLineLoading ? 'Loading...' : 'Load Invoiceable Lines'}
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Salesperson</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.salespersonId || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, salespersonId: e.target.value || undefined }))}
              >
                <option value="">— None —</option>
                {salespersons.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
                ))}
              </select>
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
            If a Sales Order is selected, stock lines load from posted Delivery Notes and service lines load from uninvoiced Sales Order quantities.
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
                  <th className="py-2 text-left">Discount Type</th>
                  <th className="py-2 text-right">Discount</th>
                  <th className="py-2 text-left">Tax Code</th>
                  <th className="py-2 text-left">Warehouse</th>
                  <th className="py-2 text-right">Discount Amt</th>
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
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1.5"
                        value={line.discountType || ''}
                        onChange={(e) => setLine(index, { discountType: (e.target.value || undefined) as any, discountValue: 0 })}
                      >
                        <option value="">No Discount</option>
                        <option value="PERCENT">Percent</option>
                        <option value="AMOUNT">Amount</option>
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        step={line.discountType === 'PERCENT' ? 0.01 : 0.01}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
                        value={line.discountValue || 0}
                        disabled={!line.discountType}
                        onChange={(e) => setLine(index, { discountValue: Number(e.target.value) })}
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
                      {line.dnLineId ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                          Auto from Delivery Note
                        </div>
                      ) : (
                        <WarehouseSelector
                          value={line.warehouseId}
                          onChange={(wh) => setLine(index, { warehouseId: wh?.id || undefined })}
                        />
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {form.currency} {computedLines[index]?.discountAmountDoc.toFixed(2)}
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

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Charges / Additions</h3>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              onClick={addCharge}
              disabled={busy}
            >
              Add Charge
            </button>
          </div>
          <div className="space-y-3">
            {form.charges.length === 0 && (
              <div className="text-sm text-slate-500">No charges added.</div>
            )}
            {form.charges.map((charge, index) => (
              <div key={charge.chargeId || `charge-${index}`} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-6">
                <input
                  type="text"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Charge name"
                  value={charge.name}
                  onChange={(e) => setCharge(index, { name: e.target.value })}
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-right"
                  placeholder="Amount"
                  value={charge.amountDoc}
                  onChange={(e) => setCharge(index, { amountDoc: Number(e.target.value) })}
                />
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={charge.taxCodeId || ''}
                  onChange={(e) => setCharge(index, { taxCodeId: e.target.value || undefined })}
                >
                  <option value="">No Tax</option>
                  {salesTaxCodes.map((taxCode) => (
                    <option key={taxCode.id} value={taxCode.id}>
                      {taxCode.code} ({Math.round(taxCode.rate * 100)}%)
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Description (optional)"
                  value={charge.description || ''}
                  onChange={(e) => setCharge(index, { description: e.target.value })}
                />
                <div className="flex items-center justify-end text-sm font-medium text-slate-700">
                  {form.currency} {computedCharges[index]?.amountDoc.toFixed(2)} + Tax {computedCharges[index]?.taxAmountDoc.toFixed(2)}
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-red-700"
                  onClick={() => removeCharge(index)}
                  disabled={busy}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </Card>

        {showSettlement && (
          <Card className="p-5 border-blue-200 bg-blue-50">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Settlement on Save & Post</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Settlement Mode</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={settlementMode}
                  onChange={(e) => setSettlementMode(e.target.value as any)}
                >
                  <option value="DEFERRED">Deferred (No Payment)</option>
                  <option value="CASH_FULL">Cash Full Payment</option>
                  <option value="MULTI">Multiple Payments</option>
                </select>
              </div>

              {settlementMode !== 'DEFERRED' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">AR Account (Optional Override)</label>
                    <AccountSelector
                      value={arAccountId}
                      placeholder="Leave empty to use Sales default AR"
                      onChange={(account) => setArAccountId(account?.id || '')}
                    />
                  </div>

                  {settlementRows.map((row, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                      <div className="text-sm font-medium text-slate-700">Payment Row {idx + 1}</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium">Settlement Account (Optional Override)</label>
                          <AccountSelector
                            value={row.settlementAccountId}
                            placeholder="Leave empty to use payment method mapping"
                            onChange={(account) => {
                              const updated = [...settlementRows];
                              updated[idx].settlementAccountId = account?.id || '';
                              setSettlementRows(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Amount (Base)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.amountBase}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].amountBase = parseFloat(e.target.value) || 0;
                              setSettlementRows(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Payment Method</label>
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.paymentMethod}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].paymentMethod = e.target.value;
                              setSettlementRows(updated);
                            }}
                          >
                            <option value="CASH">Cash</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="CHECK">Check</option>
                            <option value="CREDIT_CARD">Credit Card</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Payment Date</label>
                          <input
                            type="date"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.paymentDate}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].paymentDate = e.target.value;
                              setSettlementRows(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Reference</label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.reference}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].reference = e.target.value;
                              setSettlementRows(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">Notes</label>
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            value={row.notes}
                            onChange={(e) => {
                              const updated = [...settlementRows];
                              updated[idx].notes = e.target.value;
                              setSettlementRows(updated);
                            }}
                          />
                        </div>
                      </div>
                      {settlementMode === 'MULTI' && (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:text-red-800"
                          onClick={() => setSettlementRows(settlementRows.filter((_, i) => i !== idx))}
                        >
                          Remove Row
                        </button>
                      )}
                    </div>
                  ))}

                  {settlementMode === 'MULTI' && (
                    <button
                      type="button"
                      className="rounded-lg border border-blue-300 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100"
                      onClick={() => setSettlementRows([...settlementRows, { settlementAccountId: '', amountBase: roundMoney(totals.grandTotalBase / (settlementRows.length + 1)), paymentMethod: enabledPaymentMethodConfigs[0]?.method || 'CASH', reference: '', notes: '', paymentDate: todayIso() }])}
                    >
                      + Add Payment Row
                    </button>
                  )}
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={createAndPostDraft}
                  disabled={busy || orderLineLoading}
                >
                  {busy ? 'Saving & Posting...' : 'Confirm Save & Post'}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                  onClick={() => setShowSettlement(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={createDraft}
            disabled={busy || orderLineLoading}
          >
            {busy ? 'Creating...' : 'Save Draft'}
          </button>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => {
              const outstanding = roundMoney(totals.grandTotalBase);
              if (outstanding > 0.005) {
                setShowSettlement(true);
                setSettlementRows([{ settlementAccountId: '', amountBase: outstanding, paymentMethod: enabledPaymentMethodConfigs[0]?.method || 'CASH', reference: '', notes: '', paymentDate: todayIso() }]);
              } else {
                setSettlementMode('DEFERRED');
                createAndPostDraft();
              }
            }}
            disabled={busy || orderLineLoading}
          >
            {busy ? 'Saving & Posting...' : 'Save & Post'}
          </button>
        </div>
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
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {t('sales.governance.directInvoicingStatusLabel', 'Direct Invoicing')}
            </div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {settings
                ? isDirectInvoiceAllowed
                  ? t('sales.governance.directAllowed', 'Allowed')
                  : t('sales.governance.directBlockedOperational', 'Blocked (Operational)')
                : '-'}
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

      {showSettlement && invoice && (
        <Card className="p-5 border-blue-200 bg-blue-50">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Settlement on Post</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Settlement Mode</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={settlementMode}
                onChange={(e) => setSettlementMode(e.target.value as any)}
              >
                <option value="DEFERRED">Deferred (No Payment)</option>
                <option value="CASH_FULL">Cash Full Payment</option>
                <option value="MULTI">Multiple Payments</option>
              </select>
            </div>

            {settlementMode !== 'DEFERRED' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">AR/AP Account (Optional Override)</label>
                  <AccountSelector
                    value={arAccountId}
                    placeholder="Leave empty to use Sales default AR"
                    onChange={(account) => setArAccountId(account?.id || '')}
                  />
                </div>

                {settlementRows.map((row, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <div className="text-sm font-medium text-slate-700">Payment Row {idx + 1}</div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                          <label className="mb-1 block text-xs font-medium">Settlement Account (Optional Override)</label>
                        <AccountSelector
                          value={row.settlementAccountId}
                          placeholder="Leave empty to use payment method mapping"
                          onChange={(account) => {
                            const updated = [...settlementRows];
                            updated[idx].settlementAccountId = account?.id || '';
                            setSettlementRows(updated);
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Amount (Base)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.amountBase}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].amountBase = parseFloat(e.target.value) || 0;
                            setSettlementRows(updated);
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Payment Method</label>
                        <select
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.paymentMethod}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].paymentMethod = e.target.value;
                            setSettlementRows(updated);
                          }}
                        >
                          {enabledPaymentMethodConfigs.length > 0 ? (
                            enabledPaymentMethodConfigs.map((config) => (
                              <option key={config.method} value={config.method}>
                                {config.label || config.method}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="CASH">Cash</option>
                              <option value="BANK_TRANSFER">Bank Transfer</option>
                              <option value="CHECK">Check</option>
                              <option value="CREDIT_CARD">Credit Card</option>
                              <option value="OTHER">Other</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Payment Date</label>
                        <input
                          type="date"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.paymentDate}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].paymentDate = e.target.value;
                            setSettlementRows(updated);
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Reference</label>
                        <input
                          type="text"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.reference}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].reference = e.target.value;
                            setSettlementRows(updated);
                          }}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Notes</label>
                        <input
                          type="text"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          value={row.notes}
                          onChange={(e) => {
                            const updated = [...settlementRows];
                            updated[idx].notes = e.target.value;
                            setSettlementRows(updated);
                          }}
                        />
                      </div>
                    </div>
                    {settlementMode === 'MULTI' && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:text-red-800"
                        onClick={() => setSettlementRows(settlementRows.filter((_, i) => i !== idx))}
                      >
                        Remove Row
                      </button>
                    )}
                  </div>
                ))}

                {settlementMode === 'MULTI' && (
                  <button
                    type="button"
                    className="rounded-lg border border-blue-300 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100"
                    onClick={() => setSettlementRows([...settlementRows, { settlementAccountId: '', amountBase: 0, paymentMethod: enabledPaymentMethodConfigs[0]?.method || 'CASH', reference: '', notes: '', paymentDate: todayIso() }])}
                  >
                    + Add Payment Row
                  </button>
                )}
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={postDraft}
                disabled={busy}
              >
                {busy ? 'Posting...' : 'Confirm & Post'}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                onClick={() => setShowSettlement(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          onClick={() => navigate('/sales/invoices')}
        >
          Back to List
        </button>
        {invoice.status === 'DRAFT' && !showSettlement && (
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={handlePostClick}
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

